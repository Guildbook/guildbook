import { and, asc, count, eq, isNull, max, sql } from "drizzle-orm";
import type { Db } from "@/db/types";
import { characters, guilds, memberships, ranks, users } from "@/db/schema";
import { type Actor, assertCan, AuthorizationError, canAssignRank, resolveTier } from "@/lib/authz/policy";
import { fullName, MAX_IN_GAME_RANKS } from "@/lib/game";
import { sameGuildName } from "@/lib/guild-identity";
import { assignRankInput, guildSettingsInput, rankDefaultsInput, rankInput } from "@/lib/validation";
import { recordAudit } from "@/server/audit";
import { isUniqueViolation } from "@/server/db-errors";
import { DomainError, NotFoundError } from "@/server/errors";
import { CLEARED_VERIFICATION } from "@/server/services/guild-verification";
import { findGuildByIdentity, IDENTITY_CONSTRAINT, identityTakenMessage } from "@/server/services/platform";

export async function listRanks(db: Db, guildId: string) {
  return db.select().from(ranks).where(eq(ranks.guildId, guildId)).orderBy(asc(ranks.sortOrder));
}

async function loadRank(tx: Db, guildId: string, id: string) {
  const [rank] = await tx
    .select()
    .from(ranks)
    .where(and(eq(ranks.guildId, guildId), eq(ranks.id, id)));
  if (!rank) throw new NotFoundError("Rank");
  return rank;
}

async function assertInGameLimit(tx: Db, guildId: string) {
  const [row] = await tx
    .select({ n: count() })
    .from(ranks)
    .where(and(eq(ranks.guildId, guildId), eq(ranks.inGame, true)));
  if ((row?.n ?? 0) > MAX_IN_GAME_RANKS) {
    throw new DomainError(`WoW allows at most ${MAX_IN_GAME_RANKS} in-game ranks.`);
  }
}

async function countActiveAdmins(tx: Db, guildId: string): Promise<number> {
  const [row] = await tx
    .select({ n: count() })
    .from(memberships)
    .innerJoin(ranks, eq(ranks.id, memberships.rankId))
    .where(and(eq(memberships.guildId, guildId), eq(memberships.status, "active"), eq(ranks.tier, "admin")));
  return row?.n ?? 0;
}

/** Runs `mutate` and rolls it back if it removed the guild's last active admin. */
async function guardLastAdmin<T>(tx: Db, guildId: string, mutate: () => Promise<T>): Promise<T> {
  const before = await countActiveAdmins(tx, guildId);
  const result = await mutate();
  if (before > 0 && (await countActiveAdmins(tx, guildId)) === 0) {
    throw new DomainError("The guild must keep at least one active member with Admin permissions.");
  }
  return result;
}

function rethrowRankName(err: unknown): never {
  if (isUniqueViolation(err)) throw new DomainError("A rank with that name already exists.");
  throw err;
}

export async function createRank(db: Db, actor: Actor, raw: unknown) {
  assertCan(actor, "rank.manage");
  const input = rankInput.parse(raw);
  try {
    return await db.transaction(async (tx) => {
      const [agg] = await tx
        .select({ maxSort: max(ranks.sortOrder) })
        .from(ranks)
        .where(eq(ranks.guildId, actor.guildId));
      const [rank] = await tx
        .insert(ranks)
        .values({ guildId: actor.guildId, ...input, sortOrder: (agg?.maxSort ?? 0) + 1 })
        .returning();
      await assertInGameLimit(tx, actor.guildId);
      await recordAudit(tx, actor, { action: "rank.create", targetType: "rank", targetId: rank?.id, after: input });
      return rank;
    });
  } catch (err) {
    rethrowRankName(err);
  }
}

export async function updateRank(db: Db, actor: Actor, id: string, raw: unknown) {
  assertCan(actor, "rank.manage");
  const input = rankInput.parse(raw);
  try {
    return await db.transaction(async (tx) => {
      const before = await loadRank(tx, actor.guildId, id);
      const [rank] = await guardLastAdmin(tx, actor.guildId, () =>
        tx.update(ranks).set(input).where(eq(ranks.id, id)).returning(),
      );
      await assertInGameLimit(tx, actor.guildId);
      await recordAudit(tx, actor, { action: "rank.update", targetType: "rank", targetId: id, before, after: input });
      return rank;
    });
  } catch (err) {
    rethrowRankName(err);
  }
}

export async function moveRank(db: Db, actor: Actor, id: string, direction: "up" | "down") {
  assertCan(actor, "rank.manage");
  await db.transaction(async (tx) => {
    const all = await listRanks(tx, actor.guildId);
    const index = all.findIndex((r) => r.id === id);
    if (index < 0) throw new NotFoundError("Rank");
    const swapWith = all[direction === "up" ? index - 1 : index + 1];
    const current = all[index]!;
    if (!swapWith) return;
    // Park one row on a temporary slot so the (guild_id, sort_order) unique constraint holds.
    await tx.update(ranks).set({ sortOrder: -1 }).where(eq(ranks.id, current.id));
    await tx.update(ranks).set({ sortOrder: current.sortOrder }).where(eq(ranks.id, swapWith.id));
    await tx.update(ranks).set({ sortOrder: swapWith.sortOrder }).where(eq(ranks.id, current.id));
    await recordAudit(tx, actor, {
      action: "rank.reorder",
      targetType: "rank",
      targetId: id,
      before: { sortOrder: current.sortOrder },
      after: { sortOrder: swapWith.sortOrder },
    });
  });
}

export async function deleteRank(db: Db, actor: Actor, id: string) {
  assertCan(actor, "rank.manage");
  await db.transaction(async (tx) => {
    const rank = await loadRank(tx, actor.guildId, id);
    const [inUse] = await tx.select({ n: count() }).from(memberships).where(eq(memberships.rankId, id));
    if ((inUse?.n ?? 0) > 0) throw new DomainError("Move members off this rank before deleting it.");
    const [guild] = await tx.select().from(guilds).where(eq(guilds.id, actor.guildId));
    if (guild && [guild.applicantRankId, guild.acceptRankId, guild.trialRankId].includes(id)) {
      throw new DomainError("This rank is used for applicants, trials or new members. Change that setting first.");
    }
    await tx.delete(ranks).where(eq(ranks.id, id));
    await recordAudit(tx, actor, { action: "rank.delete", targetType: "rank", targetId: id, before: rank });
  });
}

export async function setRankDefaults(db: Db, actor: Actor, raw: unknown) {
  assertCan(actor, "rank.manage");
  const input = rankDefaultsInput.parse(raw);
  await db.transaction(async (tx) => {
    const applicant = await loadRank(tx, actor.guildId, input.applicantRankId);
    const accept = await loadRank(tx, actor.guildId, input.acceptRankId);
    const trial = await loadRank(tx, actor.guildId, input.trialRankId);
    if (applicant.tier !== "applicant") throw new DomainError("The applicant rank must have the Applicant tier.");
    if (accept.tier === "applicant" || trial.tier === "applicant") {
      throw new DomainError("Accepted and trial ranks must be member ranks.");
    }
    await tx.update(guilds).set(input).where(eq(guilds.id, actor.guildId));
    await recordAudit(tx, actor, { action: "rank.defaults", targetType: "guild", targetId: actor.guildId, after: input });
  });
}

// --- Members ---------------------------------------------------------------

export async function listMembers(db: Db, actor: Actor) {
  assertCan(actor, "admin.area");
  return db
    .select({
      membershipId: memberships.id,
      status: memberships.status,
      joinedAt: memberships.joinedAt,
      rankId: ranks.id,
      rankName: ranks.name,
      rankSort: ranks.sortOrder,
      rankTier: ranks.tier,
      rankInsignia: ranks.insignia,
      userName: users.name,
      discordUsername: users.discordUsername,
      mainId: characters.id,
      mainName: characters.name,
      mainSurname: characters.surname,
      mainClass: characters.wowClass,
      mainFaction: characters.faction,
    })
    .from(memberships)
    .innerJoin(ranks, eq(ranks.id, memberships.rankId))
    .innerJoin(users, eq(users.id, memberships.userId))
    .leftJoin(
      characters,
      and(
        eq(characters.membershipId, memberships.id),
        eq(characters.isMain, true),
        sql`${characters.archivedAt} is null`,
      ),
    )
    .where(and(eq(memberships.guildId, actor.guildId), eq(memberships.status, "active")))
    .orderBy(asc(ranks.sortOrder), asc(users.name));
}

async function loadMemberWithRank(tx: Db, guildId: string, membershipId: string) {
  const [row] = await tx
    .select({
      membership: memberships,
      rankTier: ranks.tier,
      rankName: ranks.name,
      mainName: characters.name,
      mainSurname: characters.surname,
    })
    .from(memberships)
    .innerJoin(ranks, eq(ranks.id, memberships.rankId))
    .leftJoin(
      characters,
      and(eq(characters.membershipId, memberships.id), eq(characters.isMain, true), isNull(characters.archivedAt)),
    )
    .where(and(eq(memberships.guildId, guildId), eq(memberships.id, membershipId)));
  if (!row) throw new NotFoundError("Member");
  const { mainName, mainSurname, ...rest } = row;
  return { ...rest, characterName: mainName && mainSurname ? fullName(mainName, mainSurname) : null };
}

export async function assignRank(db: Db, actor: Actor, raw: unknown) {
  assertCan(actor, "member.assignRank");
  const { membershipId, rankId } = assignRankInput.parse(raw);
  return db.transaction(async (tx) => {
    const target = await loadMemberWithRank(tx, actor.guildId, membershipId);
    const newRank = await loadRank(tx, actor.guildId, rankId);
    if (target.membership.status !== "active") throw new DomainError("Only active members can be assigned a rank.");
    if (newRank.tier === "applicant") throw new DomainError("Use application review for applicants.");
    const targetTier = resolveTier({ status: target.membership.status, rankTier: target.rankTier });
    if (!canAssignRank(actor, targetTier, newRank.tier)) {
      throw new AuthorizationError("You cannot grant that rank or change this member's rank.");
    }
    await guardLastAdmin(tx, actor.guildId, () =>
      tx
        .update(memberships)
        .set({ rankId, updatedAt: sql`now()` })
        .where(eq(memberships.id, membershipId)),
    );
    await recordAudit(tx, actor, {
      action: "member.assignRank",
      targetType: "membership",
      targetId: membershipId,
      before: { rankId: target.membership.rankId, rankName: target.rankName },
      after: { rankId, rankName: newRank.name, characterName: target.characterName },
    });
    return { characterName: target.characterName, rankName: newRank.name };
  });
}

export async function removeMember(db: Db, actor: Actor, membershipId: string) {
  assertCan(actor, "member.assignRank");
  return db.transaction(async (tx) => {
    const target = await loadMemberWithRank(tx, actor.guildId, membershipId);
    const targetTier = resolveTier({ status: target.membership.status, rankTier: target.rankTier });
    if (!canAssignRank(actor, targetTier, "public")) {
      throw new AuthorizationError("You cannot remove a member at or above your own tier.");
    }
    await guardLastAdmin(tx, actor.guildId, () =>
      tx
        .update(memberships)
        .set({ status: "former", leftAt: new Date(), updatedAt: sql`now()` })
        .where(eq(memberships.id, membershipId)),
    );
    await recordAudit(tx, actor, {
      action: "member.remove",
      targetType: "membership",
      targetId: membershipId,
      before: { characterName: target.characterName },
    });
    return { characterName: target.characterName };
  });
}

// --- Guild settings --------------------------------------------------------

/**
 * Saves guild settings. Name, region, faction and ruleset are the guild's identity: they must be unique together, and
 * changing any of them on a verified guild removes the verification (the in-game guild no longer matches).
 */
export async function updateGuildSettings(db: Db, actor: Actor, raw: unknown) {
  assertCan(actor, "guild.settings");
  const input = guildSettingsInput.parse(raw);
  const holder = await findGuildByIdentity(db, input, actor.guildId);
  if (holder) throw new DomainError(identityTakenMessage({ ...input, name: holder.name }), { field: "name" });
  try {
    return await db.transaction(async (tx) => {
      const [before] = await tx.select().from(guilds).where(eq(guilds.id, actor.guildId));
      if (!before) throw new NotFoundError("Guild");
      const identityChanged =
        !sameGuildName(before.name, input.name) ||
        before.region !== input.region ||
        before.faction !== input.faction ||
        before.ruleset !== input.ruleset;
      const unverify = Boolean(before.verifiedAt) && identityChanged;
      await tx
        .update(guilds)
        .set({ ...input, ...(unverify ? CLEARED_VERIFICATION : {}) })
        .where(eq(guilds.id, actor.guildId));
      await recordAudit(tx, actor, {
        action: "guild.settings",
        targetType: "guild",
        targetId: actor.guildId,
        before: {
          name: before.name,
          motto: before.motto,
          timezone: before.timezone,
          region: before.region,
          faction: before.faction,
          ruleset: before.ruleset,
          discordInviteUrl: before.discordInviteUrl,
          recruitmentOpen: before.recruitmentOpen,
          directoryListed: before.directoryListed,
          lootPublic: before.lootPublic,
        },
        after: input,
      });
      if (unverify) {
        await recordAudit(tx, actor, {
          action: "guild.verification.remove",
          targetType: "guild",
          targetId: actor.guildId,
          before: {
            name: before.name,
            region: before.region,
            faction: before.faction,
            ruleset: before.ruleset,
            character: before.verifiedCharacterName,
          },
          after: { reason: "identity_changed" },
        });
      }
      return { unverified: unverify };
    });
  } catch (err) {
    if (isUniqueViolation(err, IDENTITY_CONSTRAINT)) throw new DomainError(identityTakenMessage(input));
    throw err;
  }
}

export async function setRecruitmentOpen(db: Db, actor: Actor, open: boolean) {
  assertCan(actor, "recruitment.edit");
  await db.transaction(async (tx) => {
    await tx.update(guilds).set({ recruitmentOpen: open }).where(eq(guilds.id, actor.guildId));
    await recordAudit(tx, actor, {
      action: "recruitment.toggle",
      targetType: "guild",
      targetId: actor.guildId,
      after: { recruitmentOpen: open },
    });
  });
}
