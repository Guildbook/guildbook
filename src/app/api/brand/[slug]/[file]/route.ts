import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { guilds } from "@/db/schema";
import { isPreviewPage, PREVIEW_PAGES, previewVersion } from "@/lib/brand";
import { tabardKey } from "@/lib/tabard/config";
import { guildLook, isOrderLook } from "@/lib/tabard/look";
import { crestIcon, faviconIco, linkPreview, paddedIcon, tabardSvg } from "@/server/brand-render";
import { guildOrigin, hostFromRequest } from "@/server/hosts";
import { primaryCustomDomain } from "@/server/services/domains";
import { guildLookColumns } from "@/server/services/tabard";
import { crestImages } from "@/server/tabard-tint";

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
 * A guild's icons and link preview, generated from its tabard. Icon URLs carry `?v=<tabard key>`, the preview
 * `?v=<previewVersion>` (tabard, name, motto and facts); a matching version is cached for a year (any change gives
 * a new URL), anything else for five minutes. The Order's icons are its static set; its preview is drawn here too.
 */
export async function GET(request: Request, { params }: RouteContext<"/api/brand/[slug]/[file]">) {
  const { slug, file } = await params;
  if (!(file in FILES)) return new NextResponse("Not found", { status: 404 });
  const kind = file as BrandFile;
  const [guild] = await db
    .select({
      id: guilds.id,
      slug: guilds.slug,
      name: guilds.name,
      motto: guilds.motto,
      region: guilds.region,
      faction: guilds.faction,
      ruleset: guilds.ruleset,
      gameVersion: guilds.gameVersion,
      realmSlug: guilds.realmSlug,
      recruitmentOpen: guilds.recruitmentOpen,
      verifiedAt: guilds.verifiedAt,
      ...guildLookColumns,
    })
    .from(guilds)
    .where(eq(guilds.slug, slug));
  if (!guild) return new NextResponse("Not found", { status: 404 });
  if (isOrderLook(guild) && kind !== "og.png") return NextResponse.redirect(new URL(orderFile(kind), request.url));

  const look = guildLook(guild);
  const url = new URL(request.url);
  const version = url.searchParams.get("v");
  let body: Buffer;
  let current: boolean;
  if (kind === "og.png") {
    const [requestHost, customDomain] = await Promise.all([hostFromRequest(request), primaryCustomDomain(db, guild.id)]);
    const host = new URL(guildOrigin(slug, requestHost, customDomain)).host;
    const page = url.searchParams.get("page");
    current = version === previewVersion(guild, host);
    body = await linkPreview(look, {
      name: guild.name,
      motto: guild.motto,
      region: guild.region,
      faction: guild.faction,
      ruleset: guild.ruleset,
      gameVersion: guild.gameVersion,
      realmSlug: guild.realmSlug,
      recruiting: guild.recruitmentOpen,
      verified: Boolean(guild.verifiedAt),
      host,
      eyebrow: isPreviewPage(page) ? PREVIEW_PAGES[page] : null,
    });
  } else {
    current = version === tabardKey(look.tabard);
    body = await render(kind, look);
  }
  const headers: Record<string, string> = {
    "content-type": FILES[kind],
    "cache-control": current ? "public, max-age=31536000, immutable" : "public, max-age=300",
  };
  if (url.searchParams.has("download")) headers["content-disposition"] = `attachment; filename="${slug}-${kind}"`;
  return new NextResponse(new Uint8Array(body), { headers });
}

async function render(file: Exclude<BrandFile, "og.png">, look: ReturnType<typeof guildLook>): Promise<Buffer> {
  switch (file) {
    case "icon.svg":
      return Buffer.from(tabardSvg(look.tabard, 120, await crestImages(look.tabard), "mark").replace(/ width="[\d.]+" height="120"/, ""));
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
  }
}
