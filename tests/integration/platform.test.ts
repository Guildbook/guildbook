import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { auditLog, contentPages, guilds, memberships, ranks, users } from "@/db/schema";
import type { Db } from "@/db/types";
import { resolveTier } from "@/lib/authz/policy";
import { DomainError } from "@/server/errors";
import { checkSlugAvailability, createGuildForUser, listDirectoryGuilds, listUserGuilds } from "@/server/services/platform";
import { createGuild, createTestDb } from "../support/db";

let db: Db;
let close: () => Promise<void>;
let n = 0;

const limits = { perUser: 3, perDay: 2 };

async function newUser() {
  const [user] = await db.insert(users).values({ name: `Founder ${++n}`, discordId: `founder-${n}` }).returning();
  return user!;
}

function form(slug: string, extra: Record<string, string> = {}) {
  return { name: `Guild ${slug}`, slug, faction: "", timezone: "America/New_York", motto: "", ...extra };
}

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});
afterAll(() => close());

describe("createGuildForUser", () => {
  it("creates a standard guild with the creator as its Guild Master", async () => {
    const user = await newUser();
    const { guild } = await createGuildForUser(db, user.id, form("silver-dawn", { faction: "horde", motto: "Steel and patience", directoryListed: "on" }), limits);

    expect(guild).toMatchObject({ slug: "silver-dawn", preset: "standard", faction: "horde", motto: "Steel and patience", directoryListed: true, createdByUserId: user.id, realm: null });

    const [membership] = await db
      .select({ status: memberships.status, rankName: ranks.name, rankTier: ranks.tier })
      .from(memberships)
      .innerJoin(ranks, eq(ranks.id, memberships.rankId))
      .where(and(eq(memberships.guildId, guild.id), eq(memberships.userId, user.id)));
    expect(membership).toEqual({ status: "active", rankName: "Guild Master", rankTier: "admin" });
    expect(resolveTier({ status: membership!.status, rankTier: membership!.rankTier })).toBe("admin");

    const [audit] = await db.select().from(auditLog).where(and(eq(auditLog.guildId, guild.id), eq(auditLog.action, "guild.create")));
    expect(audit).toBeTruthy();
  });

  it("gives new guilds neutral defaults and keeps the Order's content for the Order preset", async () => {
    const user = await newUser();
    const { guild } = await createGuildForUser(db, user.id, form("neutral-test"), limits);
    const rankNames = (await db.select({ name: ranks.name }).from(ranks).where(eq(ranks.guildId, guild.id))).map((r) => r.name);
    expect(rankNames).toEqual(expect.arrayContaining(["Guild Master", "Officer", "Raider", "Member", "Trial", "Applicant"]));
    expect(rankNames).not.toContain("Chaplain");

    const pages = await db.select({ slug: contentPages.slug, title: contentPages.title, body: contentPages.bodyMd }).from(contentPages).where(eq(contentPages.guildId, guild.id));
    expect(pages.map((p) => p.slug).sort()).toEqual(["charter", "loot-policy", "lore"]);
    const text = pages.map((p) => `${p.title} ${p.body}`).join(" ");
    expect(text).toContain("Guild neutral-test");
    for (const word of ["Catholic", "Michael", "prayer", "Pax", "Deus"]) expect(text).not.toContain(word);

    const order = await createGuild(db);
    const orderRanks = (await db.select({ name: ranks.name }).from(ranks).where(eq(ranks.guildId, order.guild.id))).map((r) => r.name);
    expect(orderRanks).toContain("Postulant");
    expect(order.guild.preset).toBe("order");
  });

  it("enforces slug rules and uniqueness", async () => {
    const user = await newUser();
    for (const slug of ["ab", "Bad_Slug", "-dash", "a--b", "www", "api", "admin", "platform"]) {
      await expect(createGuildForUser(db, user.id, form(slug), limits), slug).rejects.toThrow();
    }
    await createGuildForUser(db, user.id, form("taken-slug"), limits);
    const other = await newUser();
    await expect(createGuildForUser(db, other.id, form("taken-slug"), limits)).rejects.toThrow(DomainError);
    await expect(createGuildForUser(db, other.id, form("taken-slug"), limits)).rejects.toThrow("That subdomain is taken");

    expect(await checkSlugAvailability(db, "taken-slug")).toEqual({ available: false, reason: "That subdomain is taken" });
    expect(await checkSlugAvailability(db, "www")).toMatchObject({ available: false });
    expect(await checkSlugAvailability(db, "free-slug")).toEqual({ available: true });
  });

  it("limits how many guilds one user founds, per day and in total", async () => {
    const user = await newUser();
    const day1 = new Date("2026-09-01T12:00:00Z");
    await createGuildForUser(db, user.id, form("limit-a"), limits, day1);
    await createGuildForUser(db, user.id, form("limit-b"), limits, day1);
    await expect(createGuildForUser(db, user.id, form("limit-c"), limits, day1)).rejects.toThrow(/today/);

    // createdAt is set by the database, so the rolling-day check uses the real clock; move past it.
    const later = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    await createGuildForUser(db, user.id, form("limit-c"), limits, later);
    await expect(createGuildForUser(db, user.id, form("limit-d"), limits, new Date(later.getTime() + 2 * 24 * 60 * 60 * 1000))).rejects.toThrow(/up to 3/);
    expect(await db.select().from(guilds).where(eq(guilds.slug, "limit-d"))).toHaveLength(0);
  });

  it("lists a user's guilds and the opt-in directory", async () => {
    const user = await newUser();
    await createGuildForUser(db, user.id, form("listed-one", { directoryListed: "on" }), limits);
    await createGuildForUser(db, user.id, form("hidden-one"), limits);

    const mine = await listUserGuilds(db, user.id);
    expect(mine.map((g) => g.slug).sort()).toEqual(["hidden-one", "listed-one"]);
    expect(mine[0]).toMatchObject({ rankName: "Guild Master", rankTier: "admin", status: "active", customDomain: null, main: null });

    const directory = await listDirectoryGuilds(db);
    const slugs = directory.map((g) => g.slug);
    expect(slugs).toContain("listed-one");
    expect(slugs).not.toContain("hidden-one");
    expect(directory.find((g) => g.slug === "listed-one")?.members).toBe(1);
  });
});
