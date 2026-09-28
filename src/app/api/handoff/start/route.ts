import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { getSessionUser } from "@/server/context";
import { sessionReachUrl } from "@/server/handoff";
import { hostFromRequest, validateDestination } from "@/server/hosts";

/** Apex only: `/api/handoff/start?to=<url>` sends the signed-in user to `to` with a one-time sign-in token. */
export async function GET(request: NextRequest) {
  const current = await hostFromRequest(request);
  if (current.route.kind !== "apex") {
    return NextResponse.redirect(new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, current.apexOrigin));
  }
  const target = await validateDestination(request.nextUrl.searchParams.get("to"), current.origin);
  if (!target) return NextResponse.redirect(new URL("/", current.origin));

  const user = await getSessionUser();
  if (!user) {
    const login = new URL("/login", current.origin);
    login.searchParams.set("callbackUrl", target);
    return NextResponse.redirect(login);
  }
  return NextResponse.redirect(await sessionReachUrl(db, user, target, current));
}
