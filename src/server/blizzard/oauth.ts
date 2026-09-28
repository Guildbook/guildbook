import "server-only";
import type { NextRequest } from "next/server";

export const OAUTH_COOKIE = "bnet_oauth";
export const OAUTH_COOKIE_PATH = "/api/battlenet";

/** Outcome shown to the user after the OAuth round trip, via `?bnet=<status>`. */
export const LINK_STATUSES = ["linked", "denied", "taken", "error", "unavailable"] as const;
export type LinkStatus = (typeof LINK_STATUSES)[number];

export interface OAuthState {
  state: string;
  slug: string;
  returnTo: string;
}

export function parseOAuthCookie(value: string | undefined): OAuthState | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<OAuthState>;
    if (typeof parsed.state !== "string" || typeof parsed.slug !== "string" || typeof parsed.returnTo !== "string") {
      return null;
    }
    // `returnTo` may be absolute (a guild subdomain); the callback re-validates it before redirecting.
    return { state: parsed.state, slug: parsed.slug, returnTo: parsed.returnTo };
  } catch {
    return null;
  }
}

/** Must match the redirect URI registered on develop.battle.net exactly. */
export function redirectUriFor(origin: string): string {
  return process.env.BATTLENET_REDIRECT_URI?.trim() || `${origin}/api/battlenet/callback`;
}

export function withStatus(request: NextRequest, returnTo: string, status: LinkStatus): URL {
  const url = new URL(returnTo, request.nextUrl.origin);
  url.searchParams.set("bnet", status);
  return url;
}
