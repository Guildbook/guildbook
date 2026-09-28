/**
 * Host parsing for Guildbook. Pure and dependency-free so the proxy, route handlers, server components and tests
 * all agree on what a host means:
 *
 * - `guildbook.io` is the platform apex (landing, sign-in, create guild, directory); `www.` redirects to it.
 * - `{slug}.guildbook.io` is a guild. Page code still lives under app/[guild]; the proxy rewrites onto it.
 * - Alternate domains in ALT_DOMAINS (say a later `guildbook.gg`) redirect to the same name on the root domain.
 * - `localhost` behaves like the root domain in dev: bare `localhost` is the apex (where the Discord redirect URI
 *   is registered), `www.localhost` redirects to it, and `{slug}.localhost` is a guild.
 * - Any other host may be a verified custom domain (looked up in the database), else it is a fallback host
 *   (preview deployments, IPs) that serves the default guild, or the apex when there is none.
 */

export interface HostConfig {
  /** Registrable root for guild subdomains, e.g. `guildbook.io`. */
  rootDomain: string;
  /** Domains that redirect to the root domain, e.g. `guildbook.gg` if it is added later. */
  altDomains: string[];
  /** Guild served on fallback hosts (previews, IPs). Null makes those hosts serve the apex. */
  defaultGuildSlug: string | null;
  /** Cookie domain shared by the apex and guild subdomains, e.g. `guildbook.io`. Null means host-only cookies. */
  cookieDomain: string | null;
}

export const LOCAL_ROOT = "localhost";

/** Subdomains that can never be guild slugs: infrastructure, platform paths and look-alikes. */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  "www", "app", "api", "auth", "admin", "mail", "static", "assets", "docs", "status", "blog",
  "about", "account", "accounts", "billing", "cdn", "create", "dashboard", "dev", "email", "files", "ftp",
  "guild", "guildbook", "guilds", "handoff", "help", "images", "img", "imap", "legal", "localhost", "login",
  "logout", "media", "mx", "new", "ns1", "ns2", "platform", "pop", "preview", "privacy", "root", "security",
  "settings", "signin", "signout", "signup", "smtp", "staging", "support", "terms", "test", "webmail",
  // Blizzard and game names nobody should hold as a guild.
  "blizzard", "battlenet", "warcraft", "worldofwarcraft", "wow", "wowforever", "official", "moderator", "gamemaster",
  // Guild page paths, which would be ambiguous in the path-prefixed dev mode.
  "addons", "apply", "charter", "denied", "lore", "members", "progression", "roster", "vigil",
]);

export const SLUG_MIN = 3;
export const SLUG_MAX = 30;
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export type SlugProblem = "length" | "characters" | "reserved";

/** Why a slug cannot be used as a subdomain, or null when it can. */
export function slugProblem(slug: string): SlugProblem | null {
  if (slug.length < SLUG_MIN || slug.length > SLUG_MAX) return "length";
  // Double hyphens are reserved for punycode labels (xn--).
  if (!SLUG_PATTERN.test(slug) || slug.includes("--")) return "characters";
  if (RESERVED_SLUGS.has(slug)) return "reserved";
  return null;
}

export function isValidSlug(slug: string): boolean {
  return slugProblem(slug) === null;
}

/** Lowercase suggestion from a guild name: "Order of Saint Michael" becomes "order-of-saint-michael". */
export function suggestSlug(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/, "");
}

function cleanDomain(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^\./, "").replace(/\.$/, "");
}

export function hostConfigFromEnv(env: Record<string, string | undefined> = process.env): HostConfig {
  const rootDomain = cleanDomain(env.ROOT_DOMAIN) || LOCAL_ROOT;
  return {
    rootDomain,
    altDomains: (env.ALT_DOMAINS ?? "").split(",").map(cleanDomain).filter((d) => d && d !== rootDomain),
    defaultGuildSlug: env.DEFAULT_GUILD_SLUG?.trim().toLowerCase() || null,
    cookieDomain: cleanDomain(env.AUTH_COOKIE_DOMAIN) || null,
  };
}

/** Lowercase hostname without port or trailing dot. Accepts `host` header values and bracketed IPv6. */
export function normalizeHost(raw: string | null | undefined): string {
  const value = (raw ?? "").trim().toLowerCase();
  if (value.startsWith("[")) return value.slice(0, value.indexOf("]") + 1);
  return value.replace(/:\d+$/, "").replace(/\.$/, "");
}

function isIp(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith("[");
}

function isPrivateIp(host: string): boolean {
  if (host === "[::1]") return true;
  const m = /^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(host);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 127 || a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}

/** `localhost`, `*.localhost` and loopback or private IPs: plain HTTP is fine and ports vary. */
export function isLocalHost(raw: string): boolean {
  const host = normalizeHost(raw);
  return host === LOCAL_ROOT || host.endsWith(`.${LOCAL_ROOT}`) || isPrivateIp(host);
}

/** Preview deployments get their own `*.vercel.app` host and can't have guild subdomains. */
function isPlatformPreview(host: string): boolean {
  return host.endsWith(".vercel.app");
}

export type HostRoute =
  | { kind: "apex" }
  | { kind: "guild"; slug: string }
  /** Canonical redirect (alt domain, www). `host` replaces the hostname; port and path are kept. */
  | { kind: "redirect"; host: string }
  /** A reserved or malformed subdomain of the root. */
  | { kind: "reserved"; label: string }
  /** Might be a verified custom domain; the caller looks it up and falls back when it isn't. */
  | { kind: "custom"; host: string }
  | { kind: "fallback"; defaultGuildSlug: string | null };

function subdomainOf(host: string, root: string): string | null {
  return host.endsWith(`.${root}`) ? host.slice(0, -(root.length + 1)) : null;
}

function routeUnderRoot(label: string): HostRoute {
  if (label.includes(".") || !isValidSlug(label)) return { kind: "reserved", label };
  return { kind: "guild", slug: label };
}

export function parseHost(raw: string | null | undefined, config: HostConfig): HostRoute {
  const host = normalizeHost(raw);
  const { rootDomain, defaultGuildSlug } = config;

  for (const alt of config.altDomains) {
    if (host === alt) return { kind: "redirect", host: rootDomain };
    const label = subdomainOf(host, alt);
    if (label) return { kind: "redirect", host: label === "www" ? rootDomain : `${label}.${rootDomain}` };
  }

  if (host === LOCAL_ROOT) return { kind: "apex" };
  const localLabel = subdomainOf(host, LOCAL_ROOT);
  if (localLabel !== null) return localLabel === "www" ? { kind: "redirect", host: LOCAL_ROOT } : routeUnderRoot(localLabel);

  if (rootDomain !== LOCAL_ROOT) {
    if (host === rootDomain) return { kind: "apex" };
    const label = subdomainOf(host, rootDomain);
    if (label === "www") return { kind: "redirect", host: rootDomain };
    if (label !== null) return routeUnderRoot(label);
  }

  if (!host || isIp(host) || isPlatformPreview(host)) return { kind: "fallback", defaultGuildSlug };
  return { kind: "custom", host };
}

/** Whether the shared session cookie reaches this host, so no handoff is needed after signing in on the apex. */
export function sharesSessionCookie(raw: string, config: HostConfig): boolean {
  const host = normalizeHost(raw);
  const domain = config.cookieDomain;
  return Boolean(domain && (host === domain || host.endsWith(`.${domain}`)));
}

interface Origin {
  protocol: string;
  /** Hostname with port, as in `URL.host`. */
  host: string;
}

function portSuffix(origin: Origin): string {
  const match = /:(\d+)$/.exec(origin.host);
  return match && isLocalHost(origin.host) ? `:${match[1]}` : "";
}

/**
 * Where the platform pages (and all OAuth) live, seen from the current request. Local hosts use `localhost`
 * on the same port. Previews stay on their own host.
 */
export function apexOrigin(config: HostConfig, current: Origin): string {
  const host = normalizeHost(current.host);
  if (isLocalHost(host)) return `${current.protocol}//${LOCAL_ROOT}${portSuffix(current)}`;
  if (config.rootDomain !== LOCAL_ROOT && (host === config.rootDomain || host.endsWith(`.${config.rootDomain}`))) {
    return `https://${config.rootDomain}`;
  }
  if (config.rootDomain !== LOCAL_ROOT && !isPlatformPreview(host)) return `https://${config.rootDomain}`;
  return `${current.protocol}//${current.host}`;
}

/** A guild's subdomain origin, seen from the current request (local hosts stay local). */
export function guildSubdomainOrigin(slug: string, config: HostConfig, current: Origin): string {
  if (isLocalHost(current.host)) return `${current.protocol}//${slug}.${LOCAL_ROOT}${portSuffix(current)}`;
  return `https://${slug}.${config.rootDomain}`;
}

export interface RedirectRules {
  config: HostConfig;
  /** Verified custom domains. Only needed where custom-domain targets are allowed. */
  isVerifiedCustomDomain?: (host: string) => boolean;
}

/**
 * Validates a post-sign-in or post-link destination. Relative paths resolve against `base`. Absolute URLs must
 * point at the root domain, one of its guild subdomains, a local dev host, or a verified custom domain.
 * Returns the absolute URL, or null when the destination is not allowed.
 */
export function validateRedirectTarget(raw: string | null | undefined, base: string, rules: RedirectRules): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (value.startsWith("/")) {
    if (value.startsWith("//") || value.startsWith("/\\")) return null;
    try {
      const url = new URL(value, base);
      return url.origin === new URL(base).origin ? url.toString() : null;
    } catch {
      return null;
    }
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.username || url.password) return null;
  const host = normalizeHost(url.hostname);
  const local = isLocalHost(host);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) return null;
  if (url.port && !local) return null;
  if (local) {
    // Local targets only make sense from a local request; production never redirects to localhost.
    if (!isLocalHost(new URL(base).host)) return null;
    const route = parseHost(host, { ...rules.config, altDomains: [] });
    return route.kind === "reserved" || route.kind === "custom" ? null : url.toString();
  }
  const { rootDomain } = rules.config;
  if (rootDomain !== LOCAL_ROOT) {
    if (host === rootDomain) return url.toString();
    const label = subdomainOf(host, rootDomain);
    if (label !== null) return routeUnderRoot(label).kind === "guild" ? url.toString() : null;
  }
  return rules.isVerifiedCustomDomain?.(host) ? url.toString() : null;
}
