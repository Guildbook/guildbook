import { randomBytes } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { battlenetEnabled, getBlizzardClient } from "@/server/blizzard";
import { OAUTH_COOKIE, OAUTH_COOKIE_PATH, redirectUriFor, withStatus } from "@/server/blizzard/oauth";
import { getGuild, getViewer } from "@/server/context";
import { guildOrigin, hostFromRequest, validateDestination } from "@/server/hosts";

/**
 * Starts linking a Battle.net account to the signed-in (Discord) user: `/api/battlenet/link?guild=osm&returnTo=/apply`.
 * Guild subdomains and custom domains bounce to the apex, where the Battle.net redirect URI is registered, with an
 * absolute `returnTo` back to the guild.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const current = await hostFromRequest(request);
  const slug =
    current.route.kind === "guild"
      ? current.route.slug
      : params.get("guild") || (current.route.kind === "fallback" ? current.route.defaultGuildSlug : null) || "osm";
  const guild = await getGuild(slug);
  const returnTo = (await validateDestination(params.get("returnTo"), current.origin)) ?? `${guildOrigin(guild.slug, current)}/apply`;

  if (current.centralSignIn) {
    const apex = new URL("/api/battlenet/link", current.apexOrigin);
    apex.searchParams.set("guild", guild.slug);
    apex.searchParams.set("returnTo", returnTo);
    return NextResponse.redirect(apex);
  }

  const viewer = await getViewer(guild.id);
  if (!viewer.user) {
    const back = new URL(returnTo);
    const login = new URL("/login", current.origin);
    // Guild login pages only accept same-origin paths; the apex login accepts absolute guild URLs.
    login.searchParams.set("callbackUrl", back.origin === current.origin ? `${back.pathname}${back.search}` : returnTo);
    return NextResponse.redirect(login);
  }

  const client = getBlizzardClient();
  if (!battlenetEnabled(client.config)) return NextResponse.redirect(withStatus(request, returnTo, "unavailable"));

  const state = randomBytes(24).toString("base64url");
  const redirectUri = redirectUriFor(current.origin);
  let target: string;
  if (client.config.mock) {
    const callback = new URL(redirectUri);
    callback.searchParams.set("code", `mock-${viewer.user.id}`);
    callback.searchParams.set("state", state);
    target = callback.toString();
  } else {
    target = client.authorizeUrl(state, redirectUri);
  }

  const response = NextResponse.redirect(target);
  response.cookies.set(OAUTH_COOKIE, JSON.stringify({ state, slug: guild.slug, returnTo }), {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    maxAge: 600,
    path: OAUTH_COOKIE_PATH,
  });
  return response;
}
