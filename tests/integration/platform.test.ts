import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { auditLog, contentPages, guilds, memberships, ranks, users } from "@/db/schema";
import type { Db } from "@/db/types";
import { resolveTier } from "@/lib/authz/policy";
import { DomainError } from "@/server/errors";
import { checkSlugAvailability, createGuildForUser, listDirectoryGuilds, listUserGuilds } from "@/server/services/platform";
import { updateGuildSettings } from "@/server/services/ranks";
import { createGuild, createMember, createTestDb } from "../support/db";

let db: Db;
let close: () => Promise<void>;
let n = 0;

const limits = { perUser: 3, perDay: 2 };

async function newUser() {
  const [user] = await db.insert(users).values({ name: `Founder ${++n}`, discordId: `founder-${n}` }).returning();
  return user!;
}

function form(slug: string, extra: Record<string, string> = {}) {
  return { name: `Guild ${slug}`, slug, faction: "alliance", ruleset: "normal", timezone: "America/New_York", motto: "", ...extra };
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

describe("one faction and one ruleset per guild", () => {
  it("requires a faction and a ruleset at creation", async () => {
    const user = await newUser();
    await expect(createGuildForUser(db, user.id, form("no-faction", { faction: "" }), limits)).rejects.toThrow(/faction/);
    await expect(createGuildForUser(db, user.id, form("both-factions", { faction: "both" }), limits)).rejects.toThrow(/faction/);
    await expect(createGuildForUser(db, user.id, form("no-ruleset", { ruleset: "" }), limits)).rejects.toThrow(/ruleset/);
    const { guild } = await createGuildForUser(db, user.id, form("pvp-guild", { faction: "horde", ruleset: "pvp" }), limits);
    expect(guild).toMatchObject({ faction: "horde", ruleset: "pvp" });
  });
});

describe("guild identity uniqueness", () => {
  it("allows one guild per name, faction and ruleset, case-insensitively", async () => {
    const user = await newUser();
    await createGuildForUser(db, user.id, form("iron-oath", { name: "Iron Oath" }), limits);

    const other = await newUser();
    await expect(createGuildForUser(db, other.id, form("iron-oath-2", { name: "iron  OATH " }), limits)).rejects.toThrow(
      "A guild called Iron Oath (Alliance, Normal) is already on Guildbook",
    );
    expect(await db.select().from(guilds).where(eq(guilds.slug, "iron-oath-2"))).toHaveLength(0);

    const horde = await createGuildForUser(db, other.id, form("iron-oath-horde", { name: "Iron Oath", faction: "horde" }), limits);
    expect(horde.guild.name).toBe("Iron Oath");
    const pvp = await createGuildForUser(db, other.id, form("iron-oath-pvp", { name: "Iron Oath", ruleset: "pvp" }), limits);
    expect(pvp.guild.name).toBe("Iron Oath");
  });

  it("refuses a rename or identity change onto another guild's identity", async () => {
    const taken = await createGuild(db, { name: "Crimson Vow", faction: "horde", ruleset: "rp" });
    const mover = await createGuild(db, { name: "Crimson Vow", faction: "alliance", ruleset: "rp" });
    const gm = await createMember(db, mover, "Grand Master");
    const settings = { name: "Crimson Vow", timezone: "America/New_York", faction: "horde", ruleset: "rp" };
    await expect(updateGuildSettings(db, gm, settings)).rejects.toThrow(/Crimson Vow \(Horde, Roleplaying\) is already on Guildbook/);
    const [row] = await db.select().from(guilds).where(eq(guilds.id, mover.guild.id));
    expect(row).toMatchObject({ faction: "alliance", ruleset: "rp" });

    await expect(updateGuildSettings(db, gm, { ...settings, name: "CRIMSON VOW", faction: "alliance" })).resolves.toMatchObject({ unverified: false });
    expect(taken.guild.id).not.toBe(mover.guild.id);
  });
});

describe("directory", () => {
  it("filters by faction and ruleset and lists verified guilds first", async () => {
    const big = await createGuild(db, { slug: "dir-big", faction: "horde", ruleset: "pvp" });
    const small = await createGuild(db, { slug: "dir-small", faction: "horde", ruleset: "pvp" });
    await db.update(guilds).set({ directoryListed: true }).where(inArray(guilds.id, [big.guild.id, small.guild.id]));
    await createMember(db, big, "Knight");
    await createMember(db, big, "Knight");
    await db.update(guilds).set({ verifiedAt: new Date(), verifiedVia: "battlenet" }).where(eq(guilds.id, small.guild.id));

    const pvpHorde = await listDirectoryGuilds(db, { faction: "horde", ruleset: "pvp" });
    expect(pvpHorde.map((g) => g.slug)).toEqual(["dir-small", "dir-big"]);
    expect(pvpHorde[0]!.verifiedAt).toBeInstanceOf(Date);
    expect((await listDirectoryGuilds(db, { ruleset: "rp" })).map((g) => g.slug)).not.toContain("dir-big");
    expect((await listDirectoryGuilds(db, { faction: "alliance" })).map((g) => g.slug)).not.toContain("dir-small");
  });
});
