import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { asc, count, eq } from "drizzle-orm";
import type { Db } from "@/db/types";
import * as schema from "@/db/schema";
import { bootstrapOrderGuild, CHARTER_CONTENT, grantGuildOwner } from "@/db/order";
import { seedDemoGuild } from "@/db/seed";
import { DEFAULT_RANKS } from "@/server/services/guilds";
import { createTestDb } from "../support/db";

let db: Db;
let close: () => Promise<void>;

beforeEach(async () => {
  ({ db, close } = await createTestDb());
});
afterEach(async () => close());

const PEOPLE_TABLES = {
  users: schema.users,
  memberships: schema.memberships,
  characters: schema.characters,
  characterProfessions: schema.characterProfessions,
  applications: schema.applications,
  bossKills: schema.bossKills,
  lootEntries: schema.lootEntries,
  wowItems: schema.wowItems,
  vigilReports: schema.vigilReports,
  auditLog: schema.auditLog,
  battlenetLinks: schema.battlenetLinks,
};

async function rowCount(table: (typeof PEOPLE_TABLES)[keyof typeof PEOPLE_TABLES] | typeof schema.guilds) {
  const [row] = await db.select({ n: count() }).from(table);
  return row!.n;
}

/** The guild's content, without IDs or timestamps, to compare two guilds. */
async function guildContent(guildId: string) {
  const [ranks, pages, schedule, recruitment, instances, bosses, addons] = await Promise.all([
    db.select().from(schema.ranks).where(eq(schema.ranks.guildId, guildId)).orderBy(asc(schema.ranks.sortOrder)),
    db.select().from(schema.contentPages).where(eq(schema.contentPages.guildId, guildId)).orderBy(asc(schema.contentPages.sortOrder)),
    db.select().from(schema.raidScheduleSlots).where(eq(schema.raidScheduleSlots.guildId, guildId)),
    db.select().from(schema.recruitmentNeeds).where(eq(schema.recruitmentNeeds.guildId, guildId)),
    db.select().from(schema.instances).where(eq(schema.instances.guildId, guildId)).orderBy(asc(schema.instances.sortOrder)),
    db.select().from(schema.bosses).where(eq(schema.bosses.guildId, guildId)),
    db.select().from(schema.addons).where(eq(schema.addons.guildId, guildId)).orderBy(asc(schema.addons.sortOrder)),
  ]);
  return {
    ranks: ranks.map((r) => [r.name, r.tier, r.insignia, r.inGame, r.sortOrder]),
    pages: pages.map((p) => [p.slug, p.title, p.bodyMd]),
    schedule: schedule.map((s) => [s.dayOfWeek, s.startTime, s.endTime, s.label, s.faction]).sort(),
    recruitment: recruitment.map((r) => [r.wowClass, r.role, r.priority, r.note]).sort(),
    instances: instances.map((i) => [i.name, i.shortName, i.size]),
    bosses: bosses.map((b) => b.name).sort(),
    addons: addons.map((a) => [a.slug, a.name, a.status, a.version]),
  };
}

describe("production bootstrap", () => {
  it("creates only the Order: its preset, charter, lore, look, schedule and raids, with no people", async () => {
    const { guild, created } = await bootstrapOrderGuild(db);
    expect(created).toBe(true);
    expect(guild).toMatchObject({ slug: "osm", name: "Order of Saint Michael", preset: "order", themeBase: "order", faction: "alliance" });
    expect(await rowCount(schema.guilds)).toBe(1);

    const content = await guildContent(guild.id);
    expect(content.ranks.map((r) => r[0])).toEqual(DEFAULT_RANKS.map((r) => r.name));
    for (const [slug, body] of Object.entries(CHARTER_CONTENT)) {
      expect(content.pages.find((p) => p[0] === slug)?.[2]).toBe(body);
    }
    expect(content.pages.find((p) => p[0] === "lore")?.[2]).toBeTruthy();
    expect(content.schedule).toHaveLength(3);
    expect(content.instances.map((i) => i[1])).toEqual(["MC", "Ony", "BWL", "ZG", "AQ20", "AQ40", "Naxx"]);
    expect(content.addons.map((a) => a[0])).toEqual(["order-assist", "vigil", "compline"]);

    const [withRanks] = await db.select().from(schema.guilds).where(eq(schema.guilds.id, guild.id));
    expect(withRanks!.applicantRankId).toBeTruthy();

    for (const [name, table] of Object.entries(PEOPLE_TABLES)) {
      expect(await rowCount(table), name).toBe(0);
    }
  });

  it("is idempotent", async () => {
    const first = await bootstrapOrderGuild(db);
    const before = await guildContent(first.guild.id);
    const second = await bootstrapOrderGuild(db);
    expect(second).toMatchObject({ created: false, guild: { id: first.guild.id } });
    expect(await rowCount(schema.guilds)).toBe(1);
    expect(await guildContent(first.guild.id)).toEqual(before);
  });

  it("builds the same guild content as the demo seed", async () => {
    const { guild } = await bootstrapOrderGuild(db);
    const demo = await seedDemoGuild(db, "demo");
    expect(await guildContent(guild.id)).toEqual(await guildContent(demo.id));
  });
});

describe("grantGuildOwner", () => {
  async function signIn(discordId: string, discordUsername: string | null) {
    const [user] = await db.insert(schema.users).values({ name: discordUsername, discordId, discordUsername }).returning();
    return user!;
  }

  it("makes a signed-in user Grand Master by Discord ID and writes one audit entry", async () => {
    const { guild } = await bootstrapOrderGuild(db);
    const user = await signIn("123456789012345678", "mattr");
    const result = await grantGuildOwner(db, { guildSlug: "osm", discord: "123456789012345678" });
    expect(result).toMatchObject({ changed: true, rank: { name: "Grand Master", tier: "admin" } });

    const [membership] = await db.select().from(schema.memberships).where(eq(schema.memberships.userId, user.id));
    expect(membership).toMatchObject({ guildId: guild.id, status: "active", rankId: result.rank.id });
    expect(membership!.joinedAt).toBeInstanceOf(Date);

    const audit = await db.select().from(schema.auditLog);
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ guildId: guild.id, action: "member.grantOwner", targetId: membership!.id, before: null });

    const again = await grantGuildOwner(db, { guildSlug: "osm", discord: "123456789012345678" });
    expect(again.changed).toBe(false);
    expect(await rowCount(schema.auditLog)).toBe(1);
    expect(await rowCount(schema.memberships)).toBe(1);
  });

  it("finds the user by username, case-insensitively, and promotes an existing applicant", async () => {
    const { guild } = await bootstrapOrderGuild(db);
    const user = await signIn("999", "MattR");
    const [postulant] = await db.select().from(schema.ranks).where(eq(schema.ranks.id, guild.applicantRankId!));
    await db.insert(schema.memberships).values({ guildId: guild.id, userId: user.id, rankId: postulant!.id, status: "applicant" });

    const result = await grantGuildOwner(db, { guildSlug: "osm", discord: "@mattr" });
    expect(result.changed).toBe(true);
    const [membership] = await db.select().from(schema.memberships).where(eq(schema.memberships.userId, user.id));
    expect(membership).toMatchObject({ status: "active", rankId: result.rank.id });
    const [audit] = await db.select().from(schema.auditLog);
    expect(audit!.before).toMatchObject({ rankName: "Postulant", status: "applicant" });
  });

  it("refuses unknown users, ambiguous usernames and unknown guilds", async () => {
    await bootstrapOrderGuild(db);
    await expect(grantGuildOwner(db, { guildSlug: "osm", discord: "nobody" })).rejects.toThrow(/Sign in with Discord once/);
    await signIn("1", "twin");
    await signIn("2", "Twin");
    await expect(grantGuildOwner(db, { guildSlug: "osm", discord: "twin" })).rejects.toThrow(/Several users/);
    await expect(grantGuildOwner(db, { guildSlug: "nope", discord: "1" })).rejects.toThrow(/No guild/);
    expect(await rowCount(schema.memberships)).toBe(0);
    expect(await rowCount(schema.auditLog)).toBe(0);
  });
});
