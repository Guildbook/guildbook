import { timingSafeEqual } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { getBattlenetDeps, getBlizzardClient } from "@/server/blizzard";
import {
  type LinkStatus,
  OAUTH_COOKIE,
  OAUTH_COOKIE_PATH,
  parseOAuthCookie,
  redirectUriFor,
  withStatus,
} from "@/server/blizzard/oauth";
import { getGuild, getViewer } from "@/server/context";
import { DomainError } from "@/server/errors";
import { guildOrigin, hostFromRequest, validateDestination } from "@/server/hosts";
import { linkBattlenetAccount } from "@/server/services/battlenet";
import { recheckAdminStanding } from "@/server/services/guild-verification";

function sameState(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Battle.net redirects here (on the apex in production) with `code` and `state` after the user authorizes or declines. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const current = await hostFromRequest(request);
  const saved = parseOAuthCookie(request.cookies.get(OAUTH_COOKIE)?.value);
  const state = params.get("state");

  const finish = (returnTo: string, status: LinkStatus) => {
    const response = NextResponse.redirect(withStatus(request, returnTo, status));
    response.cookies.set(OAUTH_COOKIE, "", { path: OAUTH_COOKIE_PATH, maxAge: 0 });
    return response;
  };

  if (!saved || !state || !sameState(state, saved.state)) return finish(`${current.origin}/`, "error");
  const guild = await getGuild(saved.slug);
  const home = guildOrigin(guild.slug, current);
  const returnTo = (await validateDestination(saved.returnTo, current.origin)) ?? `${home}/`;
  if (params.get("error")) return finish(returnTo, "denied");
  const code = params.get("code");
  if (!code) return finish(returnTo, "error");

  const viewer = await getViewer(guild.id);
  if (!viewer.user) return finish(`${home}/login`, "error");

  try {
    await linkBattlenetAccount(db, viewer.actor, { code, redirectUri: redirectUriFor(current.origin) }, getBattlenetDeps());
    await recheckAdminStanding(db, viewer.actor, getBlizzardClient());
    return finish(returnTo, "linked");
  } catch (err) {
    if (err instanceof DomainError) return finish(returnTo, "taken");
    console.error("Battle.net link failed", err instanceof Error ? err.message : err);
    return finish(returnTo, "error");
  }
}
