import { and, asc, eq, isNotNull, ne, sql } from "drizzle-orm";
import type { Db } from "@/db/types";
import { battlenetLinks, type BattlenetCharacterSnapshot, guilds, memberships, ranks, type VerificationResult } from "@/db/schema";
import { type Actor, assertCan } from "@/lib/authz/policy";
import { FACTION_LABELS, type Faction, REGION_LABELS, type Region, RULESET_INFO, type Ruleset, WOWF_LAUNCH_DATE } from "@/lib/game";
import {
  cleanGuildName,
  describeIdentity,
  type GuildIdentity,
  sameGuildName,
  unverifiedName,
  VERIFICATION_GRACE_DAYS,
} from "@/lib/guild-identity";
import { slugProblem, suggestSlug } from "@/lib/hosts";
import { recordAudit } from "@/server/audit";
import type { BlizzardClient } from "@/server/blizzard/client";
import { battlenetEnabled } from "@/server/blizzard/config";
import { snapshotRegion } from "@/server/blizzard/filter";
import { isUniqueViolation } from "@/server/db-errors";
import { DomainError, NotFoundError } from "@/server/errors";
import { relocationSlug } from "@/server/services/slug-suggestions";

/** Why a guild isn't verified. */
export type VerificationReason =
  | "battlenet_disabled"
  | "no_link"
  | "prelaunch"
  | "no_forever_characters"
  | "region_mismatch"
  | "character_missing"
  | "not_in_guild"
  | "faction_mismatch"
  | "ruleset_mismatch"
  | "ruleset_unknown"
  | "roster_unavailable"
  | "not_guild_master"
  | "name_mismatch"
  | "gm_left"
  | "blizzard_error";

export interface InGameGuild {
  name: string;
  realmSlug: string;
  faction: Faction | null;
  ruleset: Ruleset | null;
}

interface CheckedCharacter {
  id: string;
  name: string;
  realmSlug: string;
  userId: string | null;
}

export type CharacterCheck =
  | { ok: true; character: CheckedCharacter; inGame: InGameGuild }
  | {
      ok: false;
      reason: VerificationReason;
      conclusive: boolean;
      character?: CheckedCharacter;
      inGame?: InGameGuild;
      rank?: number | null;
    };

export const CLEARED_VERIFICATION = {
  verifiedAt: null,
  verifiedUserId: null,
  verifiedCharacterId: null,
  verifiedCharacterName: null,
  verifiedRealmSlug: null,
  verifiedVia: null,
  verificationFailingSince: null,
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;
/** Characters checked against Blizzard per on-demand verification, to bound API calls. */
const MAX_CHARACTERS_CHECKED = 10;

export function isPreLaunch(now: Date): boolean {
  return now.toISOString().slice(0, 10) < WOWF_LAUNCH_DATE;
}

/**
 * Checks one character against a guild's identity: its in-game guild (character profile summary), that guild's
 * realm ruleset (Game Data realm type) and the character's rank (guild roster, rank 0 = Guild Master). Every lookup
 * is in the guild's region: a character in another region can never match. All lookups use the app token; the
 * member's own token isn't needed.
 */
export async function checkCharacter(
  client: BlizzardClient,
  identity: GuildIdentity,
  character: CheckedCharacter,
): Promise<CharacterCheck> {
  const fail = (reason: VerificationReason, conclusive: boolean, extra: Partial<Extract<CharacterCheck, { ok: false }>> = {}) =>
    ({ ok: false, reason, conclusive, character, ...extra }) as const;

  const lookup = await client.lookupCharacterProfile(identity.region, character.realmSlug, character.name);
  if (lookup.status === "error") return fail("blizzard_error", false);
  if (lookup.status === "missing" || lookup.profile.id !== character.id) return fail("character_missing", true);
  const guild = lookup.profile.guild;
  if (!guild) return fail("not_in_guild", true);

  const realm = await client.getRealmRuleset(identity.region, guild.realmSlug);
  if (realm.status === "error") return fail("blizzard_error", false);
  const inGame: InGameGuild = {
    name: guild.name,
    realmSlug: guild.realmSlug,
    faction: guild.faction ?? lookup.profile.faction,
    ruleset: realm.ruleset,
  };
  if (inGame.faction && inGame.faction !== identity.faction) return fail("faction_mismatch", true, { inGame });
  if (!inGame.ruleset) return fail("ruleset_unknown", false, { inGame });
  if (inGame.ruleset !== identity.ruleset) return fail("ruleset_mismatch", true, { inGame });

  const roster = await client.lookupGuildRoster(identity.region, guild.realmSlug, guild.nameSlug);
  if (roster.status !== "ok") return fail("roster_unavailable", false, { inGame });
  const member = roster.members.find((m) => m.id === character.id);
  if (!member || member.rank !== 0) return fail("not_guild_master", true, { inGame, rank: member?.rank ?? null });
  if (!sameGuildName(guild.name, identity.name)) return fail("name_mismatch", true, { inGame, rank: 0 });
  return { ok: true, character, inGame };
}

/** Lower is closer to verified; picks which failure to explain when several characters were checked. */
function relevance(check: CharacterCheck, identity: GuildIdentity): number {
  if (check.ok) return -1;
  const sameName = check.inGame ? sameGuildName(check.inGame.name, identity.name) : false;
  const order: VerificationReason[] = [
    "not_guild_master",
    "roster_unavailable",
    "ruleset_mismatch",
    "faction_mismatch",
    "ruleset_unknown",
  ];
  if (sameName && order.includes(check.reason)) return order.indexOf(check.reason);
  const rest: VerificationReason[] = [
    "name_mismatch",
    "not_guild_master",
    "roster_unavailable",
    "ruleset_unknown",
    "ruleset_mismatch",
    "faction_mismatch",
    "not_in_guild",
    "character_missing",
    "blizzard_error",
  ];
  return 10 + Math.max(0, rest.indexOf(check.reason));
}

export function pickBestCheck(checks: CharacterCheck[], identity: GuildIdentity): CharacterCheck | null {
  return [...checks].sort((a, b) => relevance(a, identity) - relevance(b, identity))[0] ?? null;
}

/** The user-facing explanation of a check. */
export function describeCheck(
  check: CharacterCheck | { ok: false; reason: VerificationReason; conclusive: boolean },
  identity: GuildIdentity,
): string {
  if (check.ok) {
    return `Verified: ${check.character.name} is Guild Master of ${check.inGame.name} (${describeIdentity(identity)}).`;
  }
  const who = "character" in check && check.character ? check.character.name : "The character";
  const inGame = "inGame" in check ? check.inGame : undefined;
  const guildName = inGame?.name ?? "its guild";
  switch (check.reason) {
    case "battlenet_disabled":
      return "Battle.net isn't configured on this site yet, so guilds can't be verified.";
    case "no_link":
      return "No admin of this guild has linked a Battle.net account. The Guild Master links theirs from My Characters, then checks again.";
    case "prelaunch":
      return `Verification opens once WoW: Forever characters exist. Forever launches on Nov 4, 2026, and Blizzard doesn't publish Forever characters yet. After launch, found the guild in game, refresh your Battle.net characters on My Characters and check again.`;
    case "no_forever_characters":
      return `No WoW: Forever characters in the ${REGION_LABELS[identity.region]} region were found on the admins' linked Battle.net accounts. Refresh your characters on My Characters (or reconnect Battle.net), then check again.`;
    case "region_mismatch":
      return `The admins' WoW: Forever characters are in another region, but this guild is in the ${REGION_LABELS[identity.region]} region. Regions are separate worlds; if the guild is in the wrong region, change it under Guild Settings.`;
    case "character_missing":
      return `${who} wasn't found on Battle.net (renamed, deleted, transferred, or not visible yet: profiles update after the character logs out).`;
    case "not_in_guild":
      return `${who} isn't in a guild in game.`;
    case "faction_mismatch":
      return `${who}'s guild, ${guildName}, is ${inGame?.faction ? FACTION_LABELS[inGame.faction] : "another faction"}, but this guild is ${FACTION_LABELS[identity.faction]}.`;
    case "ruleset_mismatch":
      return `${who}'s guild, ${guildName}, is on the ${inGame?.ruleset ? RULESET_INFO[inGame.ruleset].label : "another"} ruleset, but this guild is ${RULESET_INFO[identity.ruleset].label}.`;
    case "ruleset_unknown":
      return `Guildbook couldn't tell which ruleset ${who}'s realm (${inGame?.realmSlug ?? "unknown"}) belongs to. Try again later, or ask the Guildbook team to map it.`;
    case "roster_unavailable":
      return `Battle.net didn't return ${guildName}'s roster, so the Guild Master rank couldn't be confirmed. Try again later.`;
    case "not_guild_master": {
      const rank = "rank" in check && check.rank != null ? ` (rank ${check.rank})` : "";
      return `${who} is in ${guildName} but isn't its Guild Master${rank}. Link the Guild Master's character, then check again.`;
    }
    case "name_mismatch":
      return `${who} is Guild Master of ${guildName}, but this guild is called ${identity.name}.`;
    case "gm_left":
      return "The admin who verified this guild is no longer one of its admins.";
    case "blizzard_error":
      return "Battle.net didn't respond. Try again later.";
  }
}

interface Candidate extends CheckedCharacter {
  region: Region;
  faction: Faction;
  snapshotGuildName: string | null;
}

/** Forever characters, in every region, on the linked Battle.net accounts of the guild's active admin-tier members. */
export async function adminCandidates(db: Db, guildId: string) {
  const rows = await db
    .select({ userId: memberships.userId, characters: battlenetLinks.characters })
    .from(memberships)
    .innerJoin(ranks, eq(ranks.id, memberships.rankId))
    .innerJoin(battlenetLinks, eq(battlenetLinks.userId, memberships.userId))
    .where(and(eq(memberships.guildId, guildId), eq(memberships.status, "active"), eq(ranks.tier, "admin")))
    .orderBy(asc(memberships.joinedAt));
  const candidates: Candidate[] = rows.flatMap((r) =>
    (r.characters as BattlenetCharacterSnapshot[]).map((c) => ({
      id: c.id,
      name: c.name,
      realmSlug: c.realmSlug,
      userId: r.userId,
      region: snapshotRegion(c),
      faction: c.faction,
      snapshotGuildName: c.guildName,
    })),
  );
  return { links: rows.length, candidates };
}

function orderCandidates(candidates: Candidate[], identity: GuildIdentity, preferUserId: string | null): Candidate[] {
  const score = (c: Candidate) =>
    (c.snapshotGuildName && sameGuildName(c.snapshotGuildName, identity.name) ? 0 : 4) +
    (c.faction === identity.faction ? 0 : 2) +
    (c.userId === preferUserId ? 0 : 1);
  return [...candidates].sort((a, b) => score(a) - score(b));
}

export interface VerificationRun {
  check: CharacterCheck | { ok: false; reason: VerificationReason; conclusive: boolean };
  message: string;
}

/** Runs the Blizzard checks for a guild's admins without writing anything. */
export async function runVerificationCheck(
  db: Db,
  guild: GuildIdentity & { id: string },
  client: BlizzardClient,
  opts: { preferUserId?: string | null; now?: Date } = {},
): Promise<VerificationRun> {
  const now = opts.now ?? new Date();
  const identity = { name: guild.name, region: guild.region, faction: guild.faction, ruleset: guild.ruleset };
  const done = (check: VerificationRun["check"]): VerificationRun => ({ check, message: describeCheck(check, identity) });
  if (!battlenetEnabled(client.config)) return done({ ok: false, reason: "battlenet_disabled", conclusive: false });

  const { links, candidates: everywhere } = await adminCandidates(db, guild.id);
  if (links === 0) return done({ ok: false, reason: "no_link", conclusive: true });
  const candidates = everywhere.filter((c) => c.region === identity.region);
  if (candidates.length === 0) {
    if (everywhere.length > 0) return done({ ok: false, reason: "region_mismatch", conclusive: true });
    return done({ ok: false, reason: isPreLaunch(now) ? "prelaunch" : "no_forever_characters", conclusive: true });
  }

  const checks: CharacterCheck[] = [];
  for (const c of orderCandidates(candidates, identity, opts.preferUserId ?? null).slice(0, MAX_CHARACTERS_CHECKED)) {
    const check = await checkCharacter(client, identity, { id: c.id, name: c.name, realmSlug: c.realmSlug, userId: c.userId });
    checks.push(check);
    if (check.ok) break;
  }
  return done(pickBestCheck(checks, identity)!);
}

/** For a Guild Master of a same-region, same-faction, same-ruleset guild with another name: who holds that name on Guildbook. */
async function claimInfo(db: Db, guild: GuildIdentity & { id: string }, check: VerificationRun["check"]) {
  if (check.ok || check.reason !== "name_mismatch" || !("inGame" in check) || !check.inGame) return null;
  const name = cleanGuildName(check.inGame.name);
  const [holder] = await db
    .select({ id: guilds.id, name: guilds.name, verifiedAt: guilds.verifiedAt })
    .from(guilds)
    .where(
      and(
        sql`lower(${guilds.name}) = lower(${name})`,
        eq(guilds.region, guild.region),
        eq(guilds.faction, guild.faction),
        eq(guilds.ruleset, guild.ruleset),
        ne(guilds.id, guild.id),
      ),
    );
  return { name, holderName: holder?.name ?? null, holderVerified: Boolean(holder?.verifiedAt) };
}

function toResult(run: VerificationRun, claim: VerificationResult["claim"]): VerificationResult {
  const { check } = run;
  return {
    verified: check.ok,
    reason: check.ok ? null : check.reason,
    message: run.message,
    conclusive: check.ok ? true : check.conclusive,
    characterName: "character" in check && check.character ? check.character.name : null,
    inGameGuildName: "inGame" in check && check.inGame ? check.inGame.name : null,
    claim,
  };
}

type GuildRow = typeof guilds.$inferSelect;

/**
 * Records a check. Success (re)verifies. A conclusive failure of a verified guild starts, or continues, a grace
 * period; after VERIFICATION_GRACE_DAYS the badge is removed. Inconclusive failures (Blizzard down, roster hidden)
 * never count.
 */
async function applyRun(tx: Db, guild: GuildRow, run: VerificationRun, result: VerificationResult, actor: Actor, now: Date) {
  const { check } = run;
  const base = { verificationCheckedAt: now, verificationResult: result };
  if (check.ok) {
    const same = guild.verifiedAt && guild.verifiedCharacterId === check.character.id;
    await tx
      .update(guilds)
      .set({
        ...base,
        verifiedAt: same ? guild.verifiedAt : now,
        verifiedUserId: check.character.userId,
        verifiedCharacterId: check.character.id,
        verifiedCharacterName: check.character.name,
        verifiedRealmSlug: check.character.realmSlug,
        verifiedVia: "battlenet",
        verificationFailingSince: null,
      })
      .where(eq(guilds.id, guild.id));
    if (!same) {
      await recordAudit(tx, actor, {
        action: "guild.verify",
        targetType: "guild",
        targetId: guild.id,
        after: { character: check.character.name, realm: check.character.realmSlug, via: "battlenet", ruleset: guild.ruleset },
      });
    }
    return "verified" as const;
  }

  if (!guild.verifiedAt || !check.conclusive) {
    await tx.update(guilds).set(base).where(eq(guilds.id, guild.id));
    return guild.verifiedAt ? ("verified" as const) : ("unverified" as const);
  }

  const failingSince = guild.verificationFailingSince ?? now;
  if (now.getTime() - failingSince.getTime() >= VERIFICATION_GRACE_DAYS * DAY_MS) {
    await tx
      .update(guilds)
      .set({ ...base, ...CLEARED_VERIFICATION })
      .where(eq(guilds.id, guild.id));
    await recordAudit(tx, actor, {
      action: "guild.verification.lapse",
      targetType: "guild",
      targetId: guild.id,
      before: { character: guild.verifiedCharacterName, failingSince },
      after: { reason: check.reason },
    });
    return "lapsed" as const;
  }
  await tx
    .update(guilds)
    .set({ ...base, verificationFailingSince: failingSince })
    .where(eq(guilds.id, guild.id));
  if (!guild.verificationFailingSince) {
    await recordAudit(tx, actor, {
      action: "guild.verification.failing",
      targetType: "guild",
      targetId: guild.id,
      after: { reason: check.reason, graceDays: VERIFICATION_GRACE_DAYS },
    });
  }
  return "failing" as const;
}

async function loadGuild(db: Db, guildId: string) {
  const [guild] = await db.select().from(guilds).where(eq(guilds.id, guildId));
  if (!guild) throw new NotFoundError("Guild");
  return guild;
}

/** Admin "Check verification": runs the check now and records it. */
export async function verifyGuild(db: Db, actor: Actor, client: BlizzardClient, now = new Date()) {
  assertCan(actor, "guild.settings");
  const guild = await loadGuild(db, actor.guildId);
  const run = await runVerificationCheck(db, guild, client, { preferUserId: actor.userId, now });
  const result = toResult(run, await claimInfo(db, guild, run.check));
  const state = await db.transaction((tx) => applyRun(tx, guild, run, result, actor, now));
  return { state, result };
}

async function freeUnverifiedName(tx: Db, identity: GuildIdentity): Promise<string> {
  for (let attempt = 1; attempt < 100; attempt++) {
    const candidate = unverifiedName(identity.name, attempt);
    const [taken] = await tx
      .select({ id: guilds.id })
      .from(guilds)
      .where(
        and(
          sql`lower(${guilds.name}) = lower(${candidate})`,
          eq(guilds.region, identity.region),
          eq(guilds.faction, identity.faction),
          eq(guilds.ruleset, identity.ruleset),
        ),
      );
    if (!taken) return candidate;
  }
  throw new DomainError("Couldn't find a free name for the unverified guild. Please contact the Guildbook team.");
}

function appendNotice(existing: string | null, notice: string): string {
  return existing ? `${notice}\n\n${existing}` : notice;
}

/**
 * The in-game Guild Master takes their guild's name. Only the admin whose own linked character is Guild Master of
 * the in-game guild may do this, and the Blizzard check runs again first. If an unverified guild holds the name (same
 * region, faction and ruleset), it is renamed "Name (unverified)" and its admins get a notice; a verified holder is never
 * touched. Custom domains and subdomains don't move.
 */
export async function claimGuildName(db: Db, actor: Actor, client: BlizzardClient, now = new Date()) {
  assertCan(actor, "guild.settings");
  const guild = await loadGuild(db, actor.guildId);
  if (guild.verifiedAt) throw new DomainError("This guild is already verified.");
  const run = await runVerificationCheck(db, guild, client, { preferUserId: actor.userId, now });
  const { check } = run;
  if (check.ok) {
    await db.transaction((tx) => applyRun(tx, guild, run, toResult(run, null), actor, now));
    return { renamedHolder: null, name: guild.name };
  }
  if (check.reason !== "name_mismatch" || !("inGame" in check) || !check.inGame || !check.character) {
    throw new DomainError(run.message);
  }
  if (check.character.userId !== actor.userId) {
    throw new DomainError(`Only the Guild Master (the owner of ${check.character.name}) can claim the guild name.`);
  }
  const name = cleanGuildName(check.inGame.name);
  const identity = { name, region: guild.region, faction: guild.faction, ruleset: guild.ruleset };

  try {
    return await db.transaction(async (tx) => {
      const [holder] = await tx
        .select()
        .from(guilds)
        .where(
          and(
            sql`lower(${guilds.name}) = lower(${name})`,
            eq(guilds.region, guild.region),
            eq(guilds.faction, guild.faction),
            eq(guilds.ruleset, guild.ruleset),
            ne(guilds.id, guild.id),
          ),
        )
        .for("update");
      let renamedHolder: string | null = null;
      if (holder) {
        if (holder.verifiedAt) {
          throw new DomainError(`${holder.name} is a verified guild on Guildbook. A verified guild's name can't be claimed.`);
        }
        renamedHolder = await freeUnverifiedName(tx, identity);
        const notice = `A verified guild claimed the name "${holder.name}" (${describeIdentity(identity)}) on ${now.toISOString().slice(0, 10)}: its Guild Master proved through Battle.net that they lead the in-game guild with that name. This guild was renamed "${renamedHolder}". Your subdomain, custom domains, members and content are unchanged. You can rename the guild under Guild Settings.`;
        await tx
          .update(guilds)
          .set({ name: renamedHolder, adminNotice: appendNotice(holder.adminNotice, notice) })
          .where(eq(guilds.id, holder.id));
        await recordAudit(tx, { guildId: holder.id, userId: actor.userId, membershipId: null, tier: "public" }, {
          action: "guild.name_claimed",
          targetType: "guild",
          targetId: holder.id,
          before: { name: holder.name },
          after: { name: renamedHolder, claimedByGuild: guild.slug },
        });
      }
      await tx
        .update(guilds)
        .set({
          name,
          verifiedAt: now,
          verifiedUserId: check.character!.userId,
          verifiedCharacterId: check.character!.id,
          verifiedCharacterName: check.character!.name,
          verifiedRealmSlug: check.character!.realmSlug,
          verifiedVia: "battlenet",
          verificationCheckedAt: now,
          verificationFailingSince: null,
          verificationResult: {
            verified: true,
            reason: null,
            message: `Verified: ${check.character!.name} is Guild Master of ${name} (${describeIdentity(identity)}).`,
            conclusive: true,
            characterName: check.character!.name,
            inGameGuildName: check.inGame!.name,
            claim: null,
          },
        })
        .where(eq(guilds.id, guild.id));
      await recordAudit(tx, actor, {
        action: "guild.claim_name",
        targetType: "guild",
        targetId: guild.id,
        before: { name: guild.name },
        after: { name, renamedHolder: holder ? { slug: holder.slug, from: holder.name, to: renamedHolder } : null },
      });
      await recordAudit(tx, actor, {
        action: "guild.verify",
        targetType: "guild",
        targetId: guild.id,
        after: { character: check.character!.name, realm: check.character!.realmSlug, via: "battlenet", ruleset: guild.ruleset },
      });
      return { renamedHolder, name };
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new DomainError("Another guild took that name at the same moment. Check again.");
    throw err;
  }
}

/** The subdomain a verified guild may claim: its name as a slug. Null when it has it already or it can't be one. */
export function claimableSlug(guild: { name: string; slug: string }): string | null {
  const desired = suggestSlug(guild.name);
  if (!desired || desired === guild.slug || slugProblem(desired)) return null;
  return desired;
}

/** Who holds the subdomain a verified guild could claim, and where that guild would move, for the admin panel. */
export async function getSlugClaim(
  db: Db,
  guild: { id: string; name: string; slug: string; verifiedAt: Date | null; region: Region; faction: Faction; ruleset: Ruleset },
) {
  if (!guild.verifiedAt) return null;
  const slug = claimableSlug(guild);
  if (!slug) return null;
  const [holder] = await db
    .select({ name: guilds.name, verifiedAt: guilds.verifiedAt, region: guilds.region, faction: guilds.faction, ruleset: guilds.ruleset })
    .from(guilds)
    .where(eq(guilds.slug, slug));
  if (holder?.verifiedAt) return null;
  const holderMovesTo = holder ? await relocationSlug(db, slug, holder, guild) : null;
  return { slug, holderName: holder?.name ?? null, holderMovesTo };
}

/**
 * A verified guild moves to the subdomain matching its name. If an unverified guild holds it, that guild moves to
 * a free subdomain naming what sets it apart (`slug-pvp`, `slug-horde`, `slug-eu`), else the first free `slug-2`,
 * and its admins get a notice. There are no redirects: the old subdomain now
 * belongs to the verified guild, and the verified guild's previous subdomain is released. Custom domains stay put.
 */
export async function claimGuildSlug(db: Db, actor: Actor, now = new Date()) {
  assertCan(actor, "guild.settings");
  try {
    return await db.transaction(async (tx) => {
      const [guild] = await tx.select().from(guilds).where(eq(guilds.id, actor.guildId)).for("update");
      if (!guild) throw new NotFoundError("Guild");
      if (!guild.verifiedAt) throw new DomainError("Only verified guilds can claim a subdomain.");
      const slug = claimableSlug(guild);
      if (!slug) throw new DomainError("Your guild already uses the subdomain that matches its name, or its name can't be a subdomain.");
      const [holder] = await tx.select().from(guilds).where(eq(guilds.slug, slug)).for("update");
      let movedHolderTo: string | null = null;
      if (holder) {
        if (holder.verifiedAt) throw new DomainError("A verified guild uses that subdomain. It can't be claimed.");
        movedHolderTo = await relocationSlug(tx, slug, holder, guild);
        const notice = `A verified guild claimed the subdomain "${slug}" on ${now.toISOString().slice(0, 10)}: its Guild Master proved through Battle.net that they lead the in-game guild "${guild.name}". This guild's subdomain is now "${movedHolderTo}". Update any links you've shared. Your custom domains, members and content are unchanged.`;
        await tx
          .update(guilds)
          .set({ slug: movedHolderTo, adminNotice: appendNotice(holder.adminNotice, notice) })
          .where(eq(guilds.id, holder.id));
        await recordAudit(tx, { guildId: holder.id, userId: actor.userId, membershipId: null, tier: "public" }, {
          action: "guild.slug_claimed",
          targetType: "guild",
          targetId: holder.id,
          before: { slug },
          after: { slug: movedHolderTo, claimedByGuild: guild.name },
        });
      }
      await tx.update(guilds).set({ slug }).where(eq(guilds.id, guild.id));
      await recordAudit(tx, actor, {
        action: "guild.claim_slug",
        targetType: "guild",
        targetId: guild.id,
        before: { slug: guild.slug },
        after: { slug, movedHolder: holder ? { name: holder.name, to: movedHolderTo } : null },
      });
      return { slug, previousSlug: guild.slug, movedHolderTo };
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new DomainError("That subdomain was taken at the same moment. Try again.");
    throw err;
  }
}

export async function dismissAdminNotice(db: Db, actor: Actor) {
  assertCan(actor, "guild.settings");
  await db.transaction(async (tx) => {
    const [before] = await tx.select({ adminNotice: guilds.adminNotice }).from(guilds).where(eq(guilds.id, actor.guildId));
    if (!before?.adminNotice) return;
    await tx.update(guilds).set({ adminNotice: null }).where(eq(guilds.id, actor.guildId));
    await recordAudit(tx, actor, {
      action: "guild.notice.dismiss",
      targetType: "guild",
      targetId: actor.guildId,
      before: { notice: before.adminNotice },
    });
  });
}

// --- Daily re-check ----------------------------------------------------------

export interface RecheckSummary {
  checked: number;
  verified: number;
  failing: number;
  lapsed: number;
  inconclusive: number;
}

/** Whether the member who verified the guild is still one of its active admins. */
async function verifierStillAdmin(db: Db, guild: GuildRow): Promise<boolean> {
  if (!guild.verifiedUserId) return false;
  const [row] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .innerJoin(ranks, eq(ranks.id, memberships.rankId))
    .where(
      and(
        eq(memberships.guildId, guild.id),
        eq(memberships.userId, guild.verifiedUserId),
        eq(memberships.status, "active"),
        eq(ranks.tier, "admin"),
      ),
    );
  return Boolean(row);
}

/**
 * Cron: re-checks every verified guild's Guild Master character, in the guild's region (still rank 0 of an in-game
 * guild with the same name, faction and ruleset). Failures get VERIFICATION_GRACE_DAYS before the badge is removed; each step is audited.
 */
export async function recheckVerifiedGuilds(db: Db, client: BlizzardClient, now = new Date()): Promise<RecheckSummary> {
  const summary: RecheckSummary = { checked: 0, verified: 0, failing: 0, lapsed: 0, inconclusive: 0 };
  if (!battlenetEnabled(client.config)) return summary;
  const verified = await db.select().from(guilds).where(isNotNull(guilds.verifiedAt)).orderBy(asc(guilds.slug));
  for (const guild of verified) {
    summary.checked++;
    const identity = { name: guild.name, region: guild.region, faction: guild.faction, ruleset: guild.ruleset };
    let check: VerificationRun["check"];
    if (!(await verifierStillAdmin(db, guild))) {
      check = { ok: false, reason: "gm_left", conclusive: true };
    } else if (!guild.verifiedCharacterId || !guild.verifiedCharacterName || !guild.verifiedRealmSlug) {
      check = { ok: false, reason: "character_missing", conclusive: true };
    } else {
      check = await checkCharacter(client, identity, {
        id: guild.verifiedCharacterId,
        name: guild.verifiedCharacterName,
        realmSlug: guild.verifiedRealmSlug,
        userId: guild.verifiedUserId,
      });
    }
    const run = { check, message: describeCheck(check, identity) };
    const actor: Actor = { guildId: guild.id, userId: null, membershipId: null, tier: "public" };
    const state = await db.transaction((tx) => applyRun(tx, guild, run, toResult(run, null), actor, now));
    if (!check.ok && !check.conclusive) summary.inconclusive++;
    else if (state === "verified") summary.verified++;
    else if (state === "failing") summary.failing++;
    else if (state === "lapsed") summary.lapsed++;
  }
  return summary;
}
