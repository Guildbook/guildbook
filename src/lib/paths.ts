/**
 * Path-prefixed guild URLs (`/<slug>/roster`) are only for the local-dev fallback host when no default guild is
 * set. Guild subdomains, custom domains and the default-guild host all serve unprefixed paths.
 */
const PATH_PREFIXED = process.env.NEXT_PUBLIC_MULTI_GUILD === "true";

/**
 * Build an in-app URL for a guild. The slug is omitted everywhere except the path-prefixed dev fallback;
 * the proxy maps the host (or the default guild) back onto app/[guild]. A guild host that receives a
 * slug-prefixed path redirects to the unprefixed one, so links stay valid on every host.
 */
export function guildHref(guildSlug: string, path: string = "/"): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (!PATH_PREFIXED) return normalized;
  return normalized === "/" ? `/${guildSlug}` : `/${guildSlug}${normalized}`;
}

/** Public character page. */
export function characterHref(guildSlug: string, characterId: string): string {
  return guildHref(guildSlug, `/roster/${characterId}`);
}
