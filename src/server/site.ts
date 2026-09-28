import "server-only";
import { db } from "@/db";
import { type BrandAssets, guildBrand, staticBrand } from "@/lib/brand";
import { type RequestHost, getRequestHost } from "@/server/hosts";
import { eq } from "drizzle-orm";
import { guilds } from "@/db/schema";
import { guildLookColumns } from "@/server/services/tabard";

export interface SiteIdentity {
  current: RequestHost;
  /** Null on the platform apex. */
  guild: { slug: string; name: string; description: string; publishedAt: Date | null } | null;
  brand: BrandAssets;
}

/** Which site this request is for, for host-level files (manifest, robots, sitemap, favicon). */
export async function getSiteIdentity(): Promise<SiteIdentity> {
  const current = await getRequestHost();
  const route = current.route;
  const slug = route.kind === "guild" ? route.slug : route.kind === "fallback" ? route.defaultGuildSlug : null;
  if (!slug) return { current, guild: null, brand: staticBrand("guildbook") };
  const [guild] = await db
    .select({ slug: guilds.slug, name: guilds.name, description: guilds.description, publishedAt: guilds.publishedAt, ...guildLookColumns })
    .from(guilds)
    .where(eq(guilds.slug, slug));
  if (!guild) return { current, guild: null, brand: staticBrand("guildbook") };
  return { current, guild, brand: guildBrand(guild) };
}
