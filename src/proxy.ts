import { type NextRequest, NextResponse } from "next/server";
import { apexOrigin, hostConfigFromEnv, isLocalHost, parseHost } from "@/lib/hosts";
import { LOCAL_REDIRECT_HEADER } from "@/lib/local-redirect";
import { lookupCustomDomainSlug } from "@/server/domain-lookup";

/** Platform pages live under app/platform and are served on the apex (and the path-prefixed dev fallback). */
const PLATFORM_PREFIX = "/platform";
const PLATFORM_PATHS = ["/create", "/guilds", "/login", "/terms", "/privacy", "/account", "/vigil"];
/** Platform-wide pages that guild hosts redirect to on the apex. */
const APEX_ONLY_PATHS = ["/terms", "/privacy", "/account"];
const PATH_PREFIXED = process.env.NEXT_PUBLIC_MULTI_GUILD === "true";

function rewrite(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  return NextResponse.rewrite(url);
}

function requestHost(request: NextRequest) {
  return request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host;
}

/**
 * Next turns a proxy redirect into a relative one when its origin matches `request.nextUrl`, which in dev is the
 * server's own `localhost:<port>` whatever the Host header says. A redirect from another local host to the bare
 * localhost apex would then loop on the requesting host, so those go through a route handler instead.
 */
function redirectTo(request: NextRequest, target: URL, status = 307) {
  if (isLocalHost(target.host) && target.host === request.nextUrl.host && target.host !== requestHost(request)) {
    const headers = new Headers(request.headers);
    headers.set(LOCAL_REDIRECT_HEADER, target.toString());
    return NextResponse.rewrite(new URL("/api/local-redirect", request.nextUrl.origin), { request: { headers } });
  }
  return NextResponse.redirect(target, status);
}

function withPrefix(prefix: string, pathname: string) {
  return pathname === "/" ? prefix : `${prefix}${pathname}`;
}

function isPlatformPath(pathname: string) {
  return pathname === "/" || PLATFORM_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Serves `slug`'s pages at the root of this host. Slug-prefixed links (from the path-prefixed dev mode) redirect,
 * and the platform's legal pages redirect to the apex.
 */
function serveGuild(request: NextRequest, slug: string, apex: string) {
  const { pathname } = request.nextUrl;
  if (APEX_ONLY_PATHS.includes(pathname)) {
    // A preview serving a default guild is its own apex; render the page rather than redirect to itself.
    const target = new URL(pathname, apex);
    const selfHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    return target.host === selfHost ? rewrite(request, withPrefix(PLATFORM_PREFIX, pathname)) : redirectTo(request, target);
  }
  if (PATH_PREFIXED && (pathname === `/${slug}` || pathname.startsWith(`/${slug}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(slug.length + 1) || "/";
    return NextResponse.redirect(url);
  }
  return rewrite(request, withPrefix(`/${slug}`, pathname));
}

/**
 * Maps the request host onto the app: the apex onto app/platform, guild subdomains and verified custom domains
 * onto app/[guild], alt domains and www onto the canonical host. See lib/hosts.ts for the host rules.
 */
export async function proxy(request: NextRequest) {
  const config = hostConfigFromEnv();
  // Prefer the forwarded host, as server components do: Vercel sets it, and Next's internal render of a
  // server-action redirect keeps it while its fetch replaces `host` with the server's own origin.
  const host = requestHost(request);
  const route = parseHost(host, config);
  const { pathname } = request.nextUrl;
  const forwarded = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const apex = apexOrigin(config, { protocol: forwarded ? `${forwarded}:` : request.nextUrl.protocol, host });

  switch (route.kind) {
    case "redirect": {
      const url = request.nextUrl.clone();
      url.hostname = route.host;
      if (isLocalHost(route.host)) {
        url.port = /:(\d+)$/.exec(host)?.[1] ?? "";
        url.protocol = request.nextUrl.protocol;
      } else {
        url.port = "";
        url.protocol = "https:";
      }
      return redirectTo(request, new URL(url.toString()), 308);
    }
    case "reserved":
      return redirectTo(request, new URL("/", apex));
    case "apex":
      return rewrite(request, withPrefix(PLATFORM_PREFIX, pathname));
    case "guild":
      return serveGuild(request, route.slug, apex);
    case "custom": {
      const slug = await lookupCustomDomainSlug(route.host);
      if (slug) return serveGuild(request, slug, apex);
      return config.defaultGuildSlug ? serveGuild(request, config.defaultGuildSlug, apex) : rewrite(request, withPrefix(PLATFORM_PREFIX, pathname));
    }
    case "fallback": {
      if (route.defaultGuildSlug) return serveGuild(request, route.defaultGuildSlug, apex);
      if (!PATH_PREFIXED || isPlatformPath(pathname)) return rewrite(request, withPrefix(PLATFORM_PREFIX, pathname));
      return NextResponse.next();
    }
  }
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)"],
};
