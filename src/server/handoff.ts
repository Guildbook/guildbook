import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { encode } from "next-auth/jwt";
import { verificationTokens } from "@/db/schema";
import type { Db } from "@/db/types";
import { type HostConfig, normalizeHost, sharesSessionCookie } from "@/lib/hosts";

/**
 * One-time sign-in handoff from the apex to a host the shared session cookie can't reach (custom domains, and
 * `*.localhost` in dev, where browsers refuse `Domain=localhost` cookies).
 *
 * 1. The apex (`/api/handoff/start`) checks the session and that the target is an allowed host, then signs a
 *    60-second token `{ jti, uid, did, host, next, exp }` with an HMAC key derived from AUTH_SECRET. The jti's
 *    hash is stored in verification_tokens.
 * 2. The target (`/api/handoff/complete`) checks the signature, expiry and that the token was minted for its own
 *    host, deletes the jti row (so a token works once), and sets its own host-only Auth.js session cookie.
 */
const TTL_MS = 60_000;
const IDENTIFIER = "guildbook-handoff";
const SESSION_MAX_AGE_S = 30 * 24 * 60 * 60;

interface HandoffPayload {
  jti: string;
  uid: string;
  did: string | null;
  host: string;
  next: string;
  exp: number;
}

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET is not set");
  return value;
}

function sign(payload: string): Buffer {
  const key = createHmac("sha256", secret()).update("guildbook-handoff-v1").digest();
  return createHmac("sha256", key).update(payload).digest();
}

const jtiHash = (jti: string) => createHash("sha256").update(jti).digest("hex");

export async function issueHandoff(
  db: Db,
  input: { userId: string; discordId: string | null; target: URL },
  now = Date.now(),
): Promise<string> {
  const jti = randomBytes(18).toString("base64url");
  const payload: HandoffPayload = {
    jti,
    uid: input.userId,
    did: input.discordId,
    host: normalizeHost(input.target.host),
    next: `${input.target.pathname}${input.target.search}`,
    exp: now + TTL_MS,
  };
  await db.insert(verificationTokens).values({ identifier: IDENTIFIER, token: jtiHash(jti), expires: new Date(payload.exp) });
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body).toString("base64url")}`;
}

/** The user and destination path when the token is genuine, fresh, unused and minted for `host`. */
export async function redeemHandoff(
  db: Db,
  token: string | null,
  host: string,
  now = Date.now(),
): Promise<{ userId: string; discordId: string | null; next: string } | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const given = Buffer.from(sig, "base64url");
  const expected = sign(body);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  let payload: HandoffPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as HandoffPayload;
  } catch {
    return null;
  }
  if (payload.exp <= now || payload.host !== normalizeHost(host)) return null;
  const used = await db
    .delete(verificationTokens)
    .where(
      and(
        eq(verificationTokens.identifier, IDENTIFIER),
        eq(verificationTokens.token, jtiHash(payload.jti)),
        gt(verificationTokens.expires, new Date(now)),
      ),
    )
    .returning();
  if (used.length === 0) return null;
  const next = /^\/(?![/\\])/.test(payload.next) ? payload.next : "/";
  return { userId: payload.uid, discordId: payload.did, next };
}

/**
 * Where to send a signed-in user so their session reaches `target`: straight there when this host's cookie
 * covers it, otherwise to `/api/handoff/complete` on the target's host with a fresh token. Server actions must
 * use this rather than redirecting through `/api/handoff/start`, because a same-origin redirect from an action
 * is a client-side fetch that can't follow the hop to another host.
 */
export async function sessionReachUrl(
  db: Db,
  user: { id: string; discordId: string | null },
  target: string,
  current: { origin: string; config: HostConfig },
): Promise<string> {
  const url = new URL(target);
  if (url.origin === current.origin || sharesSessionCookie(url.host, current.config)) return url.toString();
  const token = await issueHandoff(db, { userId: user.id, discordId: user.discordId, target: url });
  const complete = new URL("/api/handoff/complete", url.origin);
  complete.searchParams.set("token", token);
  return complete.toString();
}

export function sessionCookieName(secure: boolean): string {
  return `${secure ? "__Secure-" : ""}authjs.session-token`;
}

/** An Auth.js JWT session cookie for this host, in the shape the `jwt` and `session` callbacks in auth.ts read. */
export async function sessionCookie(user: { id: string; discordId: string | null; name: string | null; image: string | null }, secure: boolean) {
  const name = sessionCookieName(secure);
  const value = await encode({
    token: { sub: user.id, uid: user.id, did: user.discordId ?? undefined, name: user.name, picture: user.image },
    secret: secret(),
    salt: name,
    maxAge: SESSION_MAX_AGE_S,
  });
  return {
    name,
    value,
    options: { httpOnly: true, sameSite: "lax" as const, path: "/", secure, maxAge: SESSION_MAX_AGE_S },
  };
}
