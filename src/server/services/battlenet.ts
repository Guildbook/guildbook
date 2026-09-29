import { and, asc, eq, inArray, isNotNull, isNull, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/types";
import { type BattlenetCharacterSnapshot, type BattlenetScan, battlenetLinks, characters, guilds, memberships } from "@/db/schema";
import { type Actor, assertCan } from "@/lib/authz/policy";
import { CLASS_INFO, fullName, isValidSpec } from "@/lib/game";
import { importCharacterInput } from "@/lib/validation";
import { recordAudit } from "@/server/audit";
import { type BlizzardClient, describeScanForLog, type RosterMember } from "@/server/blizzard/client";
import { battlenetEnabled, blizzardConfigFromEnv, realmSlugsFor } from "@/server/blizzard/config";
import { decryptToken, encryptToken } from "@/server/blizzard/crypto";
import { charactersForGuild, snapshotRegion, snapshotVersion } from "@/server/blizzard/filter";
import { hasSurnames } from "@/lib/game-versions";
import { isUniqueViolation } from "@/server/db-errors";
import { DomainError, NotFoundError } from "@/server/errors";

export interface BattlenetDeps {
  client: BlizzardClient;
  /** 32-byte AES key for tokens at rest (BATTLENET_TOKEN_KEY). */
  tokenKey: Buffer;
}

/** Which snapshot characters a guild accepts beyond its region, faction and ruleset. */
export interface Eligibility {
  /** BATTLENET_REALMS entries: `slug` (every region) or `region:slug`. */
  realmSlugs: readonly string[];
}

export function defaultEligibility(): Eligibility {
  return { realmSlugs: blizzardConfigFromEnv().realmSlugs };
}

/** Counts only, for the audit log: no character names. */
function scanCounts(scan: BattlenetScan) {
  return {
    namespaces: scan.namespaces.map((n) => ({ namespace: n.namespace, http: n.httpStatus, characters: n.characters })),
    excluded: scan.excluded.map((g) => ({ version: g.version, faction: g.faction, count: g.count })),
  };
}

/** Refreshing needs a minute of token life left; Blizzard tokens last about 24 hours and can't be renewed. */
const TOKEN_MARGIN_MS = 60_000;

export async function getBattlenetLink(db: Db, userId: string) {
  const [row] = await db.select().from(battlenetLinks).where(eq(battlenetLinks.userId, userId));
  if (!row) return null;
  const { accessTokenEnc, ...link } = row;
  const canRefresh = Boolean(accessTokenEnc && link.tokenExpiresAt && link.tokenExpiresAt.getTime() > Date.now() + TOKEN_MARGIN_MS);
  return { ...link, canRefresh };
}

export type BattlenetLink = NonNullable<Awaited<ReturnType<typeof getBattlenetLink>>>;

const linkCallbackInput = z.object({ code: z.string().min(1).max(2048), redirectUri: z.url() });

/**
 * Completes the OAuth code exchange, snapshots the account's characters and links the account to the
 * signed-in user. Re-linking replaces the previous link (and refreshes the snapshot and token).
 */
export async function linkBattlenetAccount(db: Db, actor: Actor, raw: unknown, deps: BattlenetDeps) {
  assertCan(actor, "battlenet.link");
  const { code, redirectUri } = linkCallbackInput.parse(raw);
  const { client, tokenKey } = deps;
  const token = await client.exchangeCode(code, redirectUri);
  const account = await client.getUserInfo(token.accessToken);
  const snapshot = await client.getAccountCharacters(token.accessToken);
  console.info(`[battlenet] link scan: ${describeScanForLog(snapshot.scan, snapshot.characters.length)}`);

  try {
    return await db.transaction(async (tx) => {
      const [other] = await tx
        .select({ userId: battlenetLinks.userId })
        .from(battlenetLinks)
        .where(and(eq(battlenetLinks.battlenetId, account.id), ne(battlenetLinks.userId, actor.userId)));
      if (other) throw new DomainError("That Battle.net account is already linked to another Discord account.");

      const now = new Date();
      const values = {
        battlenetId: account.id,
        battletag: account.battletag,
        region: client.config.region,
        accessTokenEnc: encryptToken(token.accessToken, tokenKey),
        tokenExpiresAt: token.expiresAt,
        characters: snapshot.characters,
        snapshotStatus: snapshot.status,
        scan: snapshot.scan,
        snapshotAt: now,
        linkedAt: now,
      };
      const [link] = await tx
        .insert(battlenetLinks)
        .values({ userId: actor.userId, ...values })
        .onConflictDoUpdate({ target: battlenetLinks.userId, set: values })
        .returning({ battletag: battlenetLinks.battletag, snapshotStatus: battlenetLinks.snapshotStatus });
      await recordAudit(tx, actor, {
        action: "battlenet.link",
        targetType: "user",
        targetId: actor.userId,
        after: { characters: snapshot.characters.length, status: snapshot.status, ...scanCounts(snapshot.scan) },
      });
      return { ...link!, characterCount: snapshot.characters.length };
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new DomainError("That Battle.net account is already linked to another Discord account.");
    }
    throw err;
  }
}

/** Re-reads the character list with the stored token while it is still valid; afterwards the user re-links. */
export async function refreshBattlenetSnapshot(db: Db, actor: Actor, deps: BattlenetDeps) {
  assertCan(actor, "battlenet.link");
  const [row] = await db.select().from(battlenetLinks).where(eq(battlenetLinks.userId, actor.userId));
  if (!row) throw new DomainError("Link your Battle.net account first.");
  const expired = !row.accessTokenEnc || !row.tokenExpiresAt || row.tokenExpiresAt.getTime() <= Date.now() + TOKEN_MARGIN_MS;
  if (expired) {
    throw new DomainError("Your Battle.net authorization has expired. Reconnect Battle.net to refresh your characters.");
  }
  const snapshot = await deps.client.getAccountCharacters(decryptToken(row.accessTokenEnc!, deps.tokenKey));
  console.info(`[battlenet] refresh scan: ${describeScanForLog(snapshot.scan, snapshot.characters.length)}`);
  if (snapshot.status === "forbidden") {
    await db.update(battlenetLinks).set({ accessTokenEnc: null, tokenExpiresAt: null }).where(eq(battlenetLinks.userId, actor.userId));
    throw new DomainError("Battle.net refused the request. Reconnect Battle.net to refresh your characters.");
  }
  if (snapshot.status === "error") throw new DomainError("Battle.net didn't respond. Please try again later.");

  await db.transaction(async (tx) => {
    await tx
      .update(battlenetLinks)
      .set({ characters: snapshot.characters, snapshotStatus: snapshot.status, scan: snapshot.scan, snapshotAt: new Date() })
      .where(eq(battlenetLinks.userId, actor.userId));
    await recordAudit(tx, actor, {
      action: "battlenet.refresh",
      targetType: "user",
      targetId: actor.userId,
      before: { characters: row.characters.length },
      after: { characters: snapshot.characters.length, status: snapshot.status, ...scanCounts(snapshot.scan) },
    });
  });
  return snapshot;
}

/**
 * Removes the link and its token. The user's verified characters in every guild are kept but lose verification
 * and their Battle.net character ID, so the daily sync stops reading them.
 */
export async function unlinkBattlenet(db: Db, actor: Actor) {
  assertCan(actor, "battlenet.link");
  return db.transaction(async (tx) => {
    const [removed] = await tx
      .delete(battlenetLinks)
      .where(eq(battlenetLinks.userId, actor.userId))
      .returning({ battletag: battlenetLinks.battletag });
    if (!removed) throw new NotFoundError("Battle.net link");
    const lapsed = await tx
      .update(characters)
      .set({ verified: false, bnetCharacterId: null, syncedAt: null, updatedAt: sql`now()` })
      .where(
        and(
          or(eq(characters.verified, true), isNotNull(characters.bnetCharacterId)),
          inArray(characters.membershipId, tx.select({ id: memberships.id }).from(memberships).where(eq(memberships.userId, actor.userId))),
        ),
      )
      .returning({ id: characters.id });
    await recordAudit(tx, actor, {
      action: "battlenet.unlink",
      targetType: "user",
      targetId: actor.userId,
      after: { charactersUnverified: lapsed.length },
    });
    return { ...removed, charactersUnverified: lapsed.length };
  });
}

/** The viewer's link and the snapshot characters this guild accepts (its region, faction, ruleset and configured realms). */
export async function getEligibleCharacters(db: Db, actor: Actor, eligibility: Eligibility = defaultEligibility()) {
  assertCan(actor, "battlenet.link");
  const link = await getBattlenetLink(db, actor.userId);
  if (!link) return { link: null, characters: [] as BattlenetCharacterSnapshot[] };
  const [guild] = await db
    .select({ gameVersion: guilds.gameVersion, realmSlug: guilds.realmSlug, region: guilds.region, faction: guilds.faction, ruleset: guilds.ruleset })
    .from(guilds)
    .where(eq(guilds.id, actor.guildId));
  if (!guild) throw new NotFoundError("Guild");
  const realmSlugs = guild.gameVersion === "forever" ? realmSlugsFor(eligibility, guild.region) : [];
  return { link, characters: charactersForGuild(link.characters, { ...guild, realmSlugs }) };
}

/**
 * Looks a submitted Battle.net character ID up in the actor's own stored snapshot. The client only ever
 * sends the ID; name, class, level and realm always come from the snapshot.
 */
export async function resolveVerifiedCharacter(db: Db, actor: Actor, id: string, eligibility: Eligibility) {
  const { link, characters: eligible } = await getEligibleCharacters(db, actor, eligibility);
  const character = eligible.find((c) => c.id === id);
  if (!link || !character) {
    throw new DomainError(
      "That character isn't on your linked Battle.net account. Pick one of your listed characters or enter it manually.",
    );
  }
  return { link, character };
}

/**
 * Creates or updates a verified character from the member's snapshot. Matches, in order: a character already
 * imported from the same Battle.net character, then one of the member's manual characters with the same full name.
 */
export async function importBattlenetCharacter(
  db: Db,
  actor: Actor,
  raw: unknown,
  eligibility: Eligibility = defaultEligibility(),
) {
  assertCan(actor, "character.manageOwn");
  if (!actor.membershipId) throw new DomainError("You need an active membership to manage characters.");
  const membershipId = actor.membershipId;
  const input = importCharacterInput.parse(raw);
  const { link, character: bnet } = await resolveVerifiedCharacter(db, actor, input.bnetCharacterId, eligibility);
  const surnames = hasSurnames(snapshotVersion(bnet));
  const surname = surnames ? (bnet.surname ?? input.surname ?? "") : "";
  if (surnames && !surname) throw new DomainError("Enter your character's surname.");
  if (!isValidSpec(bnet.wowClass, input.spec)) {
    throw new DomainError(`${input.spec} is not a ${CLASS_INFO[bnet.wowClass].label} spec.`);
  }

  try {
    return await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(characters)
        .where(
          and(
            eq(characters.guildId, actor.guildId),
            isNull(characters.archivedAt),
            or(
              eq(characters.bnetCharacterId, bnet.id),
              and(
                eq(characters.membershipId, membershipId),
                isNull(characters.bnetCharacterId),
                sql`lower(${characters.name}) = lower(${bnet.name})`,
                sql`lower(${characters.surname}) = lower(${surname})`,
              ),
            ),
          ),
        )
        .orderBy(sql`${characters.bnetCharacterId} is null`)
        .limit(1);
      if (existing && existing.membershipId !== membershipId) {
        throw new DomainError(`${fullName(existing.name, existing.surname)} is already registered by another member.`);
      }

      const [main] = await tx
        .select({ id: characters.id })
        .from(characters)
        .where(and(eq(characters.membershipId, membershipId), eq(characters.isMain, true), isNull(characters.archivedAt)));
      const makeMain = input.isMain || !main || main.id === existing?.id;
      if (makeMain) {
        await tx
          .update(characters)
          .set({ isMain: false })
          .where(and(eq(characters.membershipId, membershipId), eq(characters.isMain, true)));
      }

      const verifiedData = {
        name: bnet.name,
        surname,
        faction: bnet.faction,
        wowClass: bnet.wowClass,
        level: bnet.level,
        spec: input.spec,
        role: input.role,
        verified: true,
        bnetCharacterId: bnet.id,
        region: snapshotRegion(bnet),
        realmSlug: bnet.realmSlug,
        realmName: bnet.realmName,
        syncedAt: link.snapshotAt,
        isMain: makeMain,
      };
      const [saved] = existing
        ? await tx
            .update(characters)
            .set({ ...verifiedData, updatedAt: sql`now()` })
            .where(eq(characters.id, existing.id))
            .returning()
        : await tx
            .insert(characters)
            .values({ guildId: actor.guildId, membershipId, ...verifiedData })
            .returning();
      if (!saved) throw new Error("Character save failed");

      await recordAudit(tx, actor, {
        action: "character.import",
        targetType: "character",
        targetId: saved.id,
        before: existing ? { level: existing.level, wowClass: existing.wowClass, verified: existing.verified } : undefined,
        after: {
          characterName: fullName(saved.name, saved.surname),
          level: saved.level,
          wowClass: saved.wowClass,
          realm: saved.realmName,
        },
      });
      return { character: saved, created: !existing };
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new DomainError(`A character named ${fullName(bnet.name, surname)} is already registered.`);
    throw err;
  }
}

// --- Sync ------------------------------------------------------------------

export interface SyncSummary {
  checked: number;
  updated: number;
  unchanged: number;
  missing: number;
  changes: { characterName: string; level?: [number, number]; wowClass?: [string, string] }[];
}

/**
 * Refreshes level (and class) of a guild's verified characters with an app token, in the guild's region: one
 * guild-roster request when BATTLENET_GUILD_REALM/SLUG are set and the guild is in BATTLENET_GUILD_REGION, then public
 * profile lookups for anyone not on it. A character whose Blizzard ID no longer matches (deleted, renamed,
 * transferred) counts as missing and is left untouched.
 */
export async function runGuildCharacterSync(
  db: Db,
  guildId: string,
  actorUserId: string | null,
  client: BlizzardClient,
): Promise<SyncSummary> {
  const rows = await db
    .select()
    .from(characters)
    .where(
      and(
        eq(characters.guildId, guildId),
        eq(characters.verified, true),
        isNull(characters.archivedAt),
        isNotNull(characters.bnetCharacterId),
        isNotNull(characters.realmSlug),
      ),
    )
    .orderBy(asc(characters.name));
  const [guild] = await db.select({ region: guilds.region }).from(guilds).where(eq(guilds.id, guildId));
  const region = guild?.region ?? "us";

  const { guildRealmSlug, guildSlug, guildRegion } = client.config;
  let roster: Map<string, RosterMember> | null = null;
  if (rows.length > 0 && guildRealmSlug && guildSlug && guildRegion === region) {
    const members = await client.getGuildRoster(region, guildRealmSlug, guildSlug).catch(() => null);
    if (members) roster = new Map(members.map((m) => [m.id, m]));
  }

  const summary: SyncSummary = { checked: rows.length, updated: 0, unchanged: 0, missing: 0, changes: [] };
  for (const row of rows) {
    const fromRoster = roster?.get(row.bnetCharacterId!);
    const found =
      fromRoster ?? (await client.getCharacterProfile(row.region ?? region, row.realmSlug!, row.name).catch(() => null));
    if (!found || found.id !== row.bnetCharacterId || found.level < 1 || found.level > 100) {
      summary.missing++;
      continue;
    }
    const change: SyncSummary["changes"][number] = { characterName: fullName(row.name, row.surname) };
    const set: Partial<typeof characters.$inferInsert> = { syncedAt: new Date() };
    if (found.level !== row.level) {
      set.level = found.level;
      change.level = [row.level, found.level];
    }
    if (found.wowClass && found.wowClass !== row.wowClass) {
      set.wowClass = found.wowClass;
      change.wowClass = [row.wowClass, found.wowClass];
      if (!isValidSpec(found.wowClass, row.spec)) set.spec = CLASS_INFO[found.wowClass].specs[0]!;
    }
    const changed = Boolean(change.level || change.wowClass);
    await db
      .update(characters)
      .set(changed ? { ...set, updatedAt: sql`now()` } : set)
      .where(and(eq(characters.guildId, guildId), eq(characters.id, row.id)));
    if (changed) {
      summary.updated++;
      summary.changes.push(change);
    } else {
      summary.unchanged++;
    }
  }

  await recordAudit(db, { guildId, userId: actorUserId, membershipId: null, tier: "public" }, {
    action: "battlenet.sync",
    targetType: "guild",
    targetId: guildId,
    after: { ...summary, changes: summary.changes.slice(0, 50) },
  });
  return summary;
}

/** Officer "Sync now". */
export async function syncGuildCharacters(db: Db, actor: Actor, client: BlizzardClient) {
  assertCan(actor, "battlenet.sync");
  if (!battlenetEnabled(client.config)) throw new DomainError("Battle.net isn't configured on this site yet.");
  return runGuildCharacterSync(db, actor.guildId, actor.userId, client);
}

/** Cron: every guild, one after another. */
export async function syncAllGuilds(db: Db, client: BlizzardClient) {
  if (!battlenetEnabled(client.config)) throw new DomainError("Battle.net isn't configured on this site yet.");
  const all = await db.select({ id: guilds.id, slug: guilds.slug }).from(guilds).orderBy(asc(guilds.slug));
  const results: ({ slug: string } & SyncSummary)[] = [];
  for (const g of all) results.push({ slug: g.slug, ...(await runGuildCharacterSync(db, g.id, null, client)) });
  return results;
}

/** For the admin sync panel. */
export async function getSyncStatus(db: Db, actor: Actor) {
  assertCan(actor, "battlenet.sync");
  const [row] = await db
    .select({
      verified: sql<number>`count(*)::int`,
      lastSyncedAt: sql<Date | null>`max(${characters.syncedAt})`,
    })
    .from(characters)
    .where(and(eq(characters.guildId, actor.guildId), eq(characters.verified, true), isNull(characters.archivedAt)));
  const lastSyncedAt = row?.lastSyncedAt ? new Date(row.lastSyncedAt) : null;
  return { verified: row?.verified ?? 0, lastSyncedAt };
}
