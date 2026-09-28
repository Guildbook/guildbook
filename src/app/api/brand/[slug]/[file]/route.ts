import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { guilds } from "@/db/schema";
import { tabardKey } from "@/lib/tabard/config";
import { guildLook, isOrderLook } from "@/lib/tabard/look";
import { crestIcon, faviconIco, linkPreview, paddedIcon, tabardSvg } from "@/server/brand-render";
import { guildLookColumns } from "@/server/services/tabard";

const FILES = {
  "icon.svg": "image/svg+xml",
  "favicon.ico": "image/x-icon",
  "apple-icon.png": "image/png",
  "icon-192.png": "image/png",
  "icon-512.png": "image/png",
  "icon-maskable-512.png": "image/png",
  "og.png": "image/png",
  "discord-icon.png": "image/png",
} as const;
type BrandFile = keyof typeof FILES;

/** The Order's static set from `pnpm brand:assets` (its Discord icon sits one level up). */
const orderFile = (file: BrandFile) => (file === "discord-icon.png" ? "/brand/discord-icon.png" : `/brand/osm/${file}`);

/**
 * A guild's icons and link preview, generated from its tabard. URLs carry `?v=<tabard key>`; a matching version
 * is cached for a year (saving a new tabard changes every URL), anything else for five minutes.
 */
export async function GET(request: Request, { params }: RouteContext<"/api/brand/[slug]/[file]">) {
  const { slug, file } = await params;
  if (!(file in FILES)) return new NextResponse("Not found", { status: 404 });
  const kind = file as BrandFile;
  const [guild] = await db
    .select({ name: guilds.name, motto: guilds.motto, ...guildLookColumns })
    .from(guilds)
    .where(eq(guilds.slug, slug));
  if (!guild) return new NextResponse("Not found", { status: 404 });
  if (isOrderLook(guild)) return NextResponse.redirect(new URL(orderFile(kind), request.url));

  const look = guildLook(guild);
  const url = new URL(request.url);
  const current = url.searchParams.get("v") === tabardKey(look.tabard);
  const headers: Record<string, string> = {
    "content-type": FILES[kind],
    "cache-control": current ? "public, max-age=31536000, immutable" : "public, max-age=300",
  };
  if (url.searchParams.has("download")) headers["content-disposition"] = `attachment; filename="${slug}-${kind}"`;

  const body = await render(kind, look, guild);
  return new NextResponse(new Uint8Array(body), { headers });
}

async function render(file: BrandFile, look: ReturnType<typeof guildLook>, guild: { name: string; motto: string | null }): Promise<Buffer> {
  switch (file) {
    case "icon.svg":
      return Buffer.from(tabardSvg(look.tabard, 120, "mark").replace(/ width="[\d.]+" height="120"/, ""));
    case "favicon.ico":
      return faviconIco(look);
    case "apple-icon.png":
      return paddedIcon(look, 180, 0.8);
    case "icon-192.png":
      return crestIcon(look, 192);
    case "icon-512.png":
      return crestIcon(look, 512);
    case "icon-maskable-512.png":
      return paddedIcon(look, 512, 0.6);
    case "discord-icon.png":
      return paddedIcon(look, 512, 0.72);
    case "og.png":
      return linkPreview(look, guild);
  }
}
