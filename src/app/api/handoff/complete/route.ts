import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { redeemHandoff, sessionCookie } from "@/server/handoff";
import { hostFromRequest } from "@/server/hosts";

/** Runs on the destination host: redeems a handoff token from the apex and sets this host's session cookie. */
export async function GET(request: NextRequest) {
  const current = await hostFromRequest(request);
  const redeemed = await redeemHandoff(db, request.nextUrl.searchParams.get("token"), current.host);
  if (!redeemed) return NextResponse.redirect(new URL("/", current.origin));

  const [user] = await db
    .select({ id: users.id, discordId: users.discordId, name: users.name, image: users.image })
    .from(users)
    .where(eq(users.id, redeemed.userId));
  if (!user) return NextResponse.redirect(new URL("/", current.origin));

  const response = NextResponse.redirect(new URL(redeemed.next, current.origin));
  const cookie = await sessionCookie(user, current.protocol === "https:");
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
