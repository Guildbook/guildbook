import { PGlite } from "@electric-sql/pglite";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/db/schema";
import type { Db } from "@/db/types";
import type { Actor } from "@/lib/authz/policy";
import { resolveTier } from "@/lib/authz/policy";
import type { Faction, Region, Ruleset } from "@/lib/game";
import type { GuildVersion } from "@/lib/game-versions";
import { createGuildWithDefaults } from "@/server/services/guilds";

/** A fresh in-memory Postgres with every real migration applied (including triggers). */
export async function createTestDb() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "drizzle" });
  return { db: db as unknown as Db, close: () => client.close() };
}

let counter = 0;

/**
 * A guild with the Order preset, whose rank names (Grand Master, Knight, Postulant...) the tests use. The Order preset
 * is WoW: Forever only, so guilds in other versions get the standard ranks (Guild Master, Officer...).
 */
export async function createGuild(
  db: Db,
  opts: { slug?: string; name?: string; region?: Region; faction?: Faction; ruleset?: Ruleset; gameVersion?: GuildVersion; realmSlug?: string | null } = {},
) {
  const slug = opts.slug ?? `guild-${++counter}`;
  const gameVersion = opts.gameVersion ?? "forever";
  return createGuildWithDefaults(db, {
    slug,
    name: opts.name ?? `Guild ${slug}`,
    gameVersion,
    realmSlug: opts.realmSlug ?? null,
    region: opts.region ?? "us",
    faction: opts.faction ?? "alliance",
    ruleset: opts.ruleset ?? "normal",
    preset: gameVersion === "forever" ? "order" : "standard",
  });
}

/** Creates a user with an active membership at `rankName` and returns an Actor for them. */
export async function createMember(
  db: Db,
  guild: Awaited<ReturnType<typeof createGuild>>,
  rankName: string,
  status: "active" | "applicant" | "former" = "active",
): Promise<Actor & { userId: string }> {
  const n = ++counter;
  const [user] = await db
    .insert(schema.users)
    .values({ name: `User ${n}`, discordId: `test-${n}` })
    .returning();
  const rank = guild.ranks.find((r) => r.name === rankName);
  if (!rank) throw new Error(`No rank ${rankName}`);
  const [membership] = await db
    .insert(schema.memberships)
    .values({ guildId: guild.guild.id, userId: user!.id, rankId: rank.id, status })
    .returning();
  return {
    guildId: guild.guild.id,
    userId: user!.id,
    membershipId: status === "active" ? membership!.id : null,
    tier: resolveTier({ status, rankTier: rank.tier }),
  };
}

export async function createVisitor(db: Db, guildId: string): Promise<Actor & { userId: string }> {
  const n = ++counter;
  const [user] = await db
    .insert(schema.users)
    .values({ name: `Visitor ${n}`, discordId: `visitor-${n}` })
    .returning();
  return { guildId, userId: user!.id, membershipId: null, tier: "public" };
}

/** Re-reads an actor's tier from the database, as the app does on every request. */
export async function reloadActor(db: Db, actor: Actor & { userId: string }): Promise<Actor & { userId: string }> {
  const [row] = await db
    .select({ id: schema.memberships.id, status: schema.memberships.status, rankTier: schema.ranks.tier })
    .from(schema.memberships)
    .innerJoin(schema.ranks, eq(schema.ranks.id, schema.memberships.rankId))
    .where(and(eq(schema.memberships.guildId, actor.guildId), eq(schema.memberships.userId, actor.userId)));
  return {
    ...actor,
    membershipId: row?.status === "active" ? row.id : null,
    tier: resolveTier(row ? { status: row.status, rankTier: row.rankTier } : null),
  };
}

export const validApplication = {
  characterName: "Joanofarc",
  characterSurname: "Domremy",
  faction: "alliance",
  wowClass: "warrior",
  spec: "Protection",
  role: "tank",
  level: "60",
  raidExperience: "Cleared Naxx in Classic.",
  availability: "Tue/Thu 8-11 ET",
  whyThisGuild: "Faith and raiding.",
  discordHandle: "joan",
  respectsFaith: "on",
};
