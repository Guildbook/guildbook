import { and, asc, count, eq, gte, inArray, isNull, ne } from "drizzle-orm";
import { characters, guildDomains, guilds, memberships, ranks } from "@/db/schema";
import type { Db } from "@/db/types";
import { slugProblem } from "@/lib/hosts";
import { createGuildInput, SLUG_MESSAGES } from "@/lib/validation";
import { recordAudit } from "@/server/audit";
import { isUniqueViolation } from "@/server/db-errors";
import { DomainError } from "@/server/errors";
import { createGuildWithDefaults } from "@/server/services/guilds";
import { guildLookColumns } from "@/server/services/tabard";

export interface CreationLimits {
  /** Guilds one user may found in total. */
  perUser: number;
  /** Guilds one user may found in a rolling day. */
  perDay: number;
}

function positiveInt(value: string | undefined, fallback: number): number {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function creationLimitsFromEnv(env: Record<string, string | undefined> = process.env): CreationLimits {
  return { perUser: positiveInt(env.GUILD_CREATE_LIMIT, 3), perDay: positiveInt(env.GUILD_CREATE_DAILY_LIMIT, 2) };
}

const DAY_MS = 24 * 60 * 60 * 1000;

export type SlugAvailability = { available: true } | { available: false; reason: string };

export async function checkSlugAvailability(db: Db, raw: string): Promise<SlugAvailability> {
  const slug = raw.trim().toLowerCase();
  const problem = slugProblem(slug);
  if (problem) return { available: false, reason: SLUG_MESSAGES[problem] };
  const [taken] = await db.select({ id: guilds.id }).from(guilds).where(eq(guilds.slug, slug));
  return taken ? { available: false, reason: "That subdomain is taken" } : { available: true };
}

/**
 * Founds a guild on Guildbook: neutral "standard" preset (ranks, charter, loot policy, story page), with the
 * creator as an active member at the top rank (Guild Master, an admin).
 */
export async function createGuildForUser(
  db: Db,
  userId: string,
  raw: unknown,
  limits: CreationLimits = creationLimitsFromEnv(),
  now = new Date(),
) {
  const input = createGuildInput.parse(raw);

  const [{ total } = { total: 0 }] = await db.select({ total: count() }).from(guilds).where(eq(guilds.createdByUserId, userId));
  if (total >= limits.perUser) {
    throw new DomainError(`You can found up to ${limits.perUser} guilds. Ask the Guildbook team if you need more.`);
  }
  const [{ recent } = { recent: 0 }] = await db
    .select({ recent: count() })
    .from(guilds)
    .where(and(eq(guilds.createdByUserId, userId), gte(guilds.createdAt, new Date(now.getTime() - DAY_MS))));
  if (recent >= limits.perDay) throw new DomainError("You have founded several guilds today. Please try again tomorrow.");

  const availability = await checkSlugAvailability(db, input.slug);
  if (!availability.available) throw new DomainError(availability.reason);

  try {
    return await db.transaction(async (tx) => {
      const created = await createGuildWithDefaults(tx, {
        slug: input.slug,
        name: input.name,
        motto: input.motto,
        timezone: input.timezone,
        faction: input.faction,
        directoryListed: input.directoryListed,
        preset: "standard",
        createdByUserId: userId,
      });
      const top = [...created.ranks].sort((a, b) => a.sortOrder - b.sortOrder)[0]!;
      const [membership] = await tx
        .insert(memberships)
        .values({ guildId: created.guild.id, userId, rankId: top.id, status: "active", joinedAt: now })
        .returning();
      await recordAudit(
        tx,
        { guildId: created.guild.id, userId, membershipId: membership!.id, tier: "admin" },
        { action: "guild.create", targetType: "guild", targetId: created.guild.id, after: { slug: input.slug, name: input.name } },
      );
      return { guild: created.guild, founderRank: top };
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new DomainError("That subdomain is taken");
    throw err;
  }
}

/** Guilds the user belongs to or has applied to, with their rank and main, for "Your guilds" on the apex. */
export async function listUserGuilds(db: Db, userId: string) {
  const rows = await db
    .select({
      slug: guilds.slug,
      name: guilds.name,
      motto: guilds.motto,
      preset: guilds.preset,
      ...guildLookColumns,
      faction: guilds.faction,
      status: memberships.status,
      rankName: ranks.name,
      rankTier: ranks.tier,
      rankInsignia: ranks.insignia,
      main: {
        id: characters.id,
        name: characters.name,
        surname: characters.surname,
        wowClass: characters.wowClass,
        spec: characters.spec,
        level: characters.level,
      },
    })
    .from(memberships)
    .innerJoin(guilds, eq(guilds.id, memberships.guildId))
    .innerJoin(ranks, eq(ranks.id, memberships.rankId))
    .leftJoin(
      characters,
      and(
        eq(characters.membershipId, memberships.id),
        eq(characters.isMain, true),
        isNull(characters.archivedAt),
        eq(memberships.status, "active"),
      ),
    )
    .where(and(eq(memberships.userId, userId), ne(memberships.status, "former")))
    .orderBy(asc(guilds.name));
  return attachDomains(db, rows);
}

/** Guilds that opted in to the public directory, with active member counts, largest first. */
export async function listDirectoryGuilds(db: Db) {
  const rows = await db
    .select({
      id: guilds.id,
      slug: guilds.slug,
      name: guilds.name,
      motto: guilds.motto,
      description: guilds.description,
      preset: guilds.preset,
      ...guildLookColumns,
      faction: guilds.faction,
      recruitmentOpen: guilds.recruitmentOpen,
      timezone: guilds.timezone,
    })
    .from(guilds)
    .where(eq(guilds.directoryListed, true))
    .orderBy(asc(guilds.name));
  if (rows.length === 0) return [];
  const counts = await db
    .select({ guildId: memberships.guildId, members: count() })
    .from(memberships)
    .where(and(eq(memberships.status, "active"), inArray(memberships.guildId, rows.map((r) => r.id))))
    .groupBy(memberships.guildId);
  const withCounts = rows
    .map((r) => ({ ...r, members: counts.find((c) => c.guildId === r.id)?.members ?? 0 }))
    .sort((a, b) => b.members - a.members || a.name.localeCompare(b.name));
  return attachDomains(db, withCounts);
}

/** Adds each guild's first verified custom domain, used for its public link. */
async function attachDomains<T extends { slug: string }>(db: Db, rows: T[]): Promise<(T & { customDomain: string | null })[]> {
  if (rows.length === 0) return [];
  const domains = await db
    .select({ slug: guilds.slug, domain: guildDomains.domain })
    .from(guildDomains)
    .innerJoin(guilds, eq(guilds.id, guildDomains.guildId))
    .where(and(eq(guildDomains.status, "verified"), inArray(guilds.slug, rows.map((r) => r.slug))))
    .orderBy(asc(guildDomains.createdAt));
  return rows.map((r) => ({ ...r, customDomain: domains.find((d) => d.slug === r.slug)?.domain ?? null }));
}
