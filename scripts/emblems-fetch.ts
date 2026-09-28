/**
 * Downloads Blizzard's guild tabard emblems into the repo, so the site never loads them from Blizzard:
 *   public/tabard/emblems/{id}.png   125 by 125 grayscale masks (tinted with the emblem colour when drawn)
 *   src/lib/tabard/crest-manifest.ts ids, image hashes and the official colour palettes
 * Blizzard's borders aren't bundled: crests draw Guildbook's own banner trim in the border colour.
 *
 *   pnpm emblems:fetch
 *
 * With BATTLENET_CLIENT_ID and BATTLENET_CLIENT_SECRET set, the emblem ids, image URLs and palettes come from the Game Data
 * API's guild crest index (`/data/wow/guild-crest/index`), trying the Classic Era namespace first, then Classic, then
 * retail. Without them, ids are found by probing Blizzard's render CDN (render.worldofwarcraft.com/us/guild/tabards/
 * emblem_{nn}.png, zero-padded to two digits) and the palettes are the client's tabard colour tables already in
 * src/lib/tabard/palette.ts (the same RGBA values the API returns).
 *
 * Images are re-encoded as 8-bit grayscale plus alpha PNGs with their levels stretched: Blizzard's masks sit around
 * 40 to 85 percent gray, so the darkest 1 percent of each image's opaque pixels become black and the brightest 1
 * percent white, leaving the gray as pure relative shading for the tint curve (src/lib/tabard/crest-tone.ts). Output is deterministic: running it again with the same inputs changes no bytes.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import sharp from "sharp";
import { BACKGROUND_COLORS, BORDER_COLORS, EMBLEM_COLORS, type Swatch } from "../src/lib/tabard/palette";

config({ path: [".env.local", ".env"], quiet: true });

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "public/tabard");
const MANIFEST = path.join(ROOT, "src/lib/tabard/crest-manifest.ts");
const CDN = "https://render.worldofwarcraft.com/us/guild/tabards";
const NAMESPACES = ["static-classic1x-us", "static-classic-us", "static-us"];
const EMBLEM_SIZE = [125, 125] as const;

type Rgba = [number, number, number, number];
interface Part {
  id: number;
  url: string;
}
interface Source {
  source: "game-data-api" | "render-cdn";
  namespace: string | null;
  emblems: Part[];
  palettes: { background: { id: number; rgba: Rgba }[]; border: { id: number; rgba: Rgba }[]; emblem: { id: number; rgba: Rgba }[] };
  paletteSource: "game-data-api" | "client-tables";
}

const cdnUrl = (id: number) => `${CDN}/emblem_${String(id).padStart(2, "0")}.png`;

function fromSwatches(list: readonly Swatch[]) {
  return list.map((s) => {
    const n = parseInt(s.raw.slice(1), 16);
    return { id: s.id, rgba: [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1] as Rgba };
  });
}

async function get(url: string, init?: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.status < 500 || attempt >= 2) return res;
    } catch (err) {
      if (attempt >= 2) throw err;
    }
    await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
  }
}

async function exists(url: string) {
  const res = await get(url, { method: "HEAD" });
  return res.ok;
}

/** Ids from 0 upward until `gap` misses in a row. */
async function probe(gap: number): Promise<Part[]> {
  const found: Part[] = [];
  let misses = 0;
  for (let id = 0; misses < gap; id += 8) {
    const batch = Array.from({ length: 8 }, (_, i) => id + i);
    const hits = await Promise.all(batch.map((n) => exists(cdnUrl(n))));
    for (const [i, hit] of hits.entries()) {
      if (hit) {
        found.push({ id: batch[i]!, url: cdnUrl(batch[i]!) });
        misses = 0;
      } else misses++;
    }
  }
  return found;
}

async function fromCdn(): Promise<Source> {
  return {
    source: "render-cdn",
    namespace: null,
    emblems: await probe(24),
    palettes: { background: fromSwatches(BACKGROUND_COLORS), border: fromSwatches(BORDER_COLORS), emblem: fromSwatches(EMBLEM_COLORS) },
    paletteSource: "client-tables",
  };
}

type Json = Record<string, unknown>;
const rgbaOf = (c: unknown): Rgba => {
  const v = ((c as Json)?.rgba ?? {}) as Json;
  return [Number(v.r ?? 0), Number(v.g ?? 0), Number(v.b ?? 0), Number(v.a ?? 1)];
};

async function fromApi(clientId: string, clientSecret: string): Promise<Source | null> {
  const tokenRes = await get("https://oauth.battle.net/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });
  if (!tokenRes.ok) throw new Error(`Battle.net token request failed (${tokenRes.status})`);
  const token = ((await tokenRes.json()) as Json).access_token as string;
  const api = (p: string, namespace: string) =>
    get(`https://us.api.blizzard.com${p}?namespace=${namespace}&locale=en_US`, { headers: { Authorization: `Bearer ${token}` } });

  for (const namespace of NAMESPACES) {
    const res = await api("/data/wow/guild-crest/index", namespace);
    if (!res.ok) {
      console.log(`  ${namespace}: ${res.status}`);
      continue;
    }
    const index = (await res.json()) as Json;
    const palettes = (index.palettes ?? {}) as Json;
    const media = async (id: number): Promise<Part> => {
      const m = await api(`/data/wow/media/guild-crest/emblem/${id}`, namespace);
      const assets = m.ok ? (((await m.json()) as Json).assets as { key: string; value: string }[] | undefined) : undefined;
      return { id, url: assets?.find((a) => a.key === "image")?.value ?? cdnUrl(id) };
    };
    const ids = (list: unknown) => ((list ?? []) as Json[]).map((e) => Number(e.id)).sort((a, b) => a - b);
    const colors = (list: unknown) => ((list ?? []) as Json[]).map((c) => ({ id: Number(c.id), rgba: rgbaOf(c) })).sort((a, b) => a.id - b.id);
    console.log(`  ${namespace}: guild crest index found`);
    return {
      source: "game-data-api",
      namespace,
      emblems: await Promise.all(ids(index.emblems).map(media)),
      palettes: { background: colors(palettes.backgrounds), border: colors(palettes.borders), emblem: colors(palettes.emblems) },
      paletteSource: "game-data-api",
    };
  }
  return null;
}

/** Downloads one image and re-encodes it as a grayscale plus alpha PNG, checking its size and that it is a mask. */
async function mask(part: Part): Promise<Buffer> {
  const res = await get(part.url);
  if (!res.ok) throw new Error(`${part.url}: ${res.status}`);
  const input = Buffer.from(await res.arrayBuffer());
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== EMBLEM_SIZE[0] || info.height !== EMBLEM_SIZE[1]) {
    throw new Error(`${part.url}: ${info.width}x${info.height}, expected ${EMBLEM_SIZE.join("x")}`);
  }
  let spread = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    spread = Math.max(spread, Math.abs(data[i]! - data[i + 1]!), Math.abs(data[i + 1]! - data[i + 2]!));
  }
  if (spread > 24) throw new Error(`${part.url}: not a grayscale mask (channel spread ${spread})`);
  const body: number[] = [];
  for (let i = 0; i < data.length; i += 4) if (data[i + 3]! > 128) body.push(data[i]!);
  body.sort((a, b) => a - b);
  const lo = body[Math.floor((body.length - 1) * 0.01)]!;
  const hi = Math.max(lo + 1, body[Math.floor((body.length - 1) * 0.99)]!);
  const gray = Buffer.alloc(info.width * info.height * 2);
  for (let i = 0, j = 0; i < data.length; i += 4, j += 2) {
    gray[j] = Math.max(0, Math.min(255, Math.round(((data[i]! - lo) / (hi - lo)) * 255)));
    gray[j + 1] = data[i + 3]!;
  }
  return sharp(gray, { raw: { width: info.width, height: info.height, channels: 2 } })
    .toColourspace("b-w")
    .png({ compressionLevel: 9, adaptiveFiltering: true, palette: false })
    .toBuffer();
}

const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex").slice(0, 12);

async function writeEmblems(parts: Part[]) {
  rmSync(path.join(OUT, "borders"), { recursive: true, force: true });
  const dir = path.join(OUT, "emblems");
  mkdirSync(dir, { recursive: true });
  const keep = new Set(parts.map((p) => `${p.id}.png`));
  for (const f of readdirSync(dir)) if (!keep.has(f)) rmSync(path.join(dir, f));
  const out: { id: number; sha: string }[] = [];
  for (let i = 0; i < parts.length; i += 12) {
    const batch = parts.slice(i, i + 12);
    const images = await Promise.all(batch.map(mask));
    for (const [j, png] of images.entries()) {
      writeFileSync(path.join(dir, `${batch[j]!.id}.png`), png);
      out.push({ id: batch[j]!.id, sha: sha(png) });
    }
  }
  return out;
}

const NOTICE = `Guild tabard emblems are World of Warcraft artwork by Blizzard Entertainment, Inc., downloaded once from Blizzard's render CDN (render.worldofwarcraft.com/us/guild/tabards) by \`pnpm emblems:fetch\` and re-encoded as grayscale masks.
World of Warcraft and Blizzard Entertainment are trademarks or registered trademarks of Blizzard Entertainment, Inc. Used on this non-commercial fan site; not affiliated with or endorsed by Blizzard. Not covered by Guildbook's AGPL-3.0 licence.
`;

async function main() {
  const id = process.env.BATTLENET_CLIENT_ID?.trim();
  const secret = process.env.BATTLENET_CLIENT_SECRET?.trim();
  let src: Source | null = null;
  if (id && secret) {
    console.log("Reading the guild crest index from the Game Data API");
    src = await fromApi(id, secret);
  }
  if (!src) {
    console.log("Probing Blizzard's render CDN for emblem ids (no Battle.net credentials, or no index)");
    src = await fromCdn();
  }
  if (src.emblems.length === 0) throw new Error("No emblems found");

  const emblems = await writeEmblems(src.emblems);
  writeFileSync(path.join(OUT, "NOTICE"), NOTICE);

  const row = (o: Record<string, unknown>) =>
    `    { ${Object.entries(o)
      .map(([k, v]) => `${k}: ${JSON.stringify(v).replace(/,/g, ", ")}`)
      .join(", ")} },`;
  const palette = (list: { id: number; rgba: Rgba }[]) => list.map((c) => row({ id: c.id, rgba: c.rgba })).join("\n");
  const body = `// Generated by \`pnpm emblems:fetch\`; do not edit.
/**
 * Blizzard's guild tabard emblems bundled under public/tabard: emblem ids with a hash of each image, and the official
 * colour palettes (RGBA, alpha 0 to 1) indexed by the game's colour ids.
 */
export const CREST_MANIFEST = {
  source: ${JSON.stringify(src.source)},
  namespace: ${JSON.stringify(src.namespace)},
  paletteSource: ${JSON.stringify(src.paletteSource)},
  emblemSize: [${EMBLEM_SIZE.join(", ")}],
  emblems: [
${emblems.map(row).join("\n")}
  ],
  palettes: {
    background: [
${palette(src.palettes.background).replace(/^ {4}/gm, "      ")}
    ],
    border: [
${palette(src.palettes.border).replace(/^ {4}/gm, "      ")}
    ],
    emblem: [
${palette(src.palettes.emblem).replace(/^ {4}/gm, "      ")}
    ],
  },
} as const;
`;
  writeFileSync(MANIFEST, body);
  console.log(`Wrote ${emblems.length} emblems to public/tabard, and ${path.relative(ROOT, MANIFEST)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
