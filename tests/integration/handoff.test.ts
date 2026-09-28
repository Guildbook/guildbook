import { decode } from "next-auth/jwt";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { users } from "@/db/schema";
import type { Db } from "@/db/types";
import { issueHandoff, redeemHandoff, sessionCookie } from "@/server/handoff";
import { createTestDb } from "../support/db";

let db: Db;
let close: () => Promise<void>;
let userId: string;
const previousSecret = process.env.AUTH_SECRET;

beforeAll(async () => {
  process.env.AUTH_SECRET = "test-secret-for-handoff-only";
  ({ db, close } = await createTestDb());
  const [user] = await db.insert(users).values({ name: "Handoff", discordId: "handoff-1" }).returning();
  userId = user!.id;
});
afterAll(async () => {
  process.env.AUTH_SECRET = previousSecret;
  await close();
});

const target = new URL("https://orderofsaintmichael.com/admin?tab=domains");

describe("sign-in handoff", () => {
  it("redeems once, for the host it was minted for", async () => {
    const token = await issueHandoff(db, { userId, discordId: "handoff-1", target });
    expect(await redeemHandoff(db, token, "evil.com")).toBeNull();
    expect(await redeemHandoff(db, token, "orderofsaintmichael.com")).toEqual({ userId, discordId: "handoff-1", next: "/admin?tab=domains" });
    expect(await redeemHandoff(db, token, "orderofsaintmichael.com")).toBeNull();
  });

  it("rejects tampered, expired and malformed tokens", async () => {
    const token = await issueHandoff(db, { userId, discordId: null, target });
    const [body, sig] = token.split(".") as [string, string];
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, "base64url").toString()), uid: "someone-else" })).toString("base64url");
    expect(await redeemHandoff(db, `${forged}.${sig}`, target.host)).toBeNull();
    expect(await redeemHandoff(db, `${body}.AAAA`, target.host)).toBeNull();
    expect(await redeemHandoff(db, "garbage", target.host)).toBeNull();
    expect(await redeemHandoff(db, null, target.host)).toBeNull();
    expect(await redeemHandoff(db, token, target.host, Date.now() + 61_000)).toBeNull();
  });

  it("mints a session cookie Auth.js can read", async () => {
    const cookie = await sessionCookie({ id: userId, discordId: "handoff-1", name: "Handoff", image: null }, true);
    expect(cookie.name).toBe("__Secure-authjs.session-token");
    expect(cookie.options).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax", path: "/" });
    const decoded = await decode({ token: cookie.value, secret: process.env.AUTH_SECRET!, salt: cookie.name });
    expect(decoded).toMatchObject({ sub: userId, uid: userId, did: "handoff-1", name: "Handoff" });
  });
});
