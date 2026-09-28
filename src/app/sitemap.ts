import type { MetadataRoute } from "next";
import { getSiteIdentity } from "@/server/site";

const GUILD_PAGES = ["/", "/charter", "/lore", "/roster", "/progression", "/addons", "/apply"];
const PLATFORM_PAGES = ["/", "/guilds", "/vigil", "/terms", "/privacy"];

/** Per host: a guild's public pages on its own host, the platform pages on the apex. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { current, guild } = await getSiteIdentity();
  return (guild ? GUILD_PAGES : PLATFORM_PAGES).map((path) => ({ url: path === "/" ? current.origin : `${current.origin}${path}` }));
}
