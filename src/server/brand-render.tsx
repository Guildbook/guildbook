import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { detailForWidth, TabardArt } from "@/components/tabard-crest";
import type { TabardConfig } from "@/lib/tabard/config";
import type { GuildLook } from "@/lib/tabard/look";
import { computeTheme, type SelectableBase } from "@/lib/tabard/theme";
import { svgToString } from "@/lib/tabard/svg-string";

/** The crest's width over its height (its viewBox is 100 by 120). */
const ASPECT = 100 / 120;

/** The tabard as SVG markup at the detail the site would show for this rendered height. */
export function tabardSvg(tabard: TabardConfig, height: number, detail = detailForWidth(height * ASPECT)) {
  return svgToString(<TabardArt tabard={tabard} detail={detail} width={height * ASPECT} height={height} />);
}

const dataUri = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

/** The site colours the images use, so a guild's icons and preview match its theme. */
function palette(look: GuildLook) {
  const theme = computeTheme(look.tabard, look.base === "order" ? "tome" : (look.base as SelectableBase), look.overrides);
  const v = theme.vars;
  return { ink: v["--color-ink"]!, glow: v["--theme-glow"]!, gold: v["--color-gold"]!, goldDim: v["--color-gold-dim"]!, bone: v["--color-bone"]!, accent: v["--color-crimson-bright"]!, line: v["--color-line"]! };
}

type Fonts = NonNullable<ConstructorParameters<typeof ImageResponse>[1]>["fonts"];

async function png(element: React.ReactElement, width: number, height: number, fonts?: Fonts) {
  const res = new ImageResponse(element, { width, height, fonts });
  return Buffer.from(await res.arrayBuffer());
}

/** The crest filling the height of a transparent square. */
export function crestIcon(look: GuildLook, px: number) {
  const h = px;
  return png(
    <div style={{ display: "flex", width: px, height: px, alignItems: "center", justifyContent: "center" }}>
      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
      <img src={dataUri(tabardSvg(look.tabard, h))} width={h * ASPECT} height={h} />
    </div>,
    px,
    px,
  );
}

/** The crest centred on a solid tile at `fill` of its height (apple touch, maskable and Discord icons). */
export function paddedIcon(look: GuildLook, px: number, fill: number) {
  const c = palette(look);
  const h = px * fill;
  return png(
    <div
      style={{
        display: "flex",
        width: px,
        height: px,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: c.ink,
        backgroundImage: `radial-gradient(circle at 50% 50%, ${c.glow}73 0%, ${c.glow}00 70%)`,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
      <img src={dataUri(tabardSvg(look.tabard, h))} width={h * ASPECT} height={h} />
    </div>,
    px,
    px,
  );
}

/** A .ico holding PNG images (supported by every current browser). */
export function ico(images: { px: number; data: Buffer }[]) {
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ px, data }, i) => {
    const e = 6 + i * 16;
    header.writeUInt8(px >= 256 ? 0 : px, e);
    header.writeUInt8(px >= 256 ? 0 : px, e + 1);
    header.writeUInt16LE(1, e + 4);
    header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(data.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map((i) => i.data)]);
}

export async function faviconIco(look: GuildLook) {
  const images = await Promise.all([16, 32, 48].map(async (px) => ({ px, data: await crestIcon(look, px) })));
  return ico(images);
}

let fonts: Promise<{ name: string; data: Buffer; weight: 400 | 700; style: "normal" }[]> | null = null;
function cinzel() {
  fonts ??= Promise.all(
    ([["Cinzel-Regular.ttf", 400], ["Cinzel-Bold.ttf", 700]] as const).map(async ([file, weight]) => ({
      name: "Cinzel",
      data: await readFile(path.join(process.cwd(), "scripts/fonts", file)),
      weight,
      style: "normal" as const,
    })),
  );
  return fonts;
}

/** The 1200 by 630 link preview: the crest beside the guild's name and motto, in the guild's theme colours. */
export async function linkPreview(look: GuildLook, guild: { name: string; motto: string | null }) {
  const c = palette(look);
  const crestPx = 460;
  const size = guild.name.length > 22 ? 56 : guild.name.length > 14 ? 68 : 80;
  return png(
    <div
      style={{
        display: "flex",
        width: 1200,
        height: 630,
        backgroundColor: c.ink,
        backgroundImage: `radial-gradient(circle at 26% 50%, ${c.glow}66 0%, ${c.glow}00 45%)`,
        fontFamily: "Cinzel",
        padding: 24,
      }}
    >
      <div style={{ display: "flex", flex: 1, border: `2px solid ${c.line}`, borderRadius: 6, alignItems: "center", padding: "0 56px", gap: 56 }}>
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img src={dataUri(tabardSvg(look.tabard, crestPx))} width={crestPx * ASPECT} height={crestPx} />
        <div style={{ display: "flex", flexDirection: "column", flex: 1, alignItems: "center", textAlign: "center" }}>
          <div style={{ fontSize: size, fontWeight: 700, color: c.gold, lineHeight: 1.1 }}>{guild.name}</div>
          <div style={{ width: 360, height: 2, marginTop: 28, marginBottom: 28, backgroundImage: `linear-gradient(90deg, ${c.gold}00, ${c.gold}, ${c.gold}00)` }} />
          {guild.motto && <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: 8, color: c.accent, textTransform: "uppercase", marginBottom: 24 }}>{guild.motto}</div>}
          <div style={{ fontSize: 26, color: c.bone, opacity: 0.9 }}>A World of Warcraft: Forever guild</div>
          <div style={{ fontSize: 22, color: c.goldDim, marginTop: 10 }}>on Guildbook</div>
        </div>
      </div>
    </div>,
    1200,
    630,
    await cinzel(),
  );
}
