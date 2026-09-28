/** Strips a leading `/<guild>` segment so single- and multi-guild URLs compare the same way. */
function inGuildPath(path: string, guildSlug: string | undefined): string {
  const clean = path.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  if (!guildSlug) return clean;
  const prefix = `/${guildSlug}`;
  if (clean === prefix) return "/";
  return clean.startsWith(`${prefix}/`) ? clean.slice(prefix.length) : clean;
}

/**
 * Whether a nav link to `href` is the current page. Sections match their descendants
 * (`/roster` matches `/roster/abc`); `exact` links (index routes) match only themselves.
 */
export function isActivePath(pathname: string, href: string, guildSlug?: string, exact = false): boolean {
  const current = inGuildPath(pathname, guildSlug);
  const target = inGuildPath(href, guildSlug);
  if (exact || target === "/") return current === target;
  return current === target || current.startsWith(`${target}/`);
}
