import { and, asc, eq, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { legacyWowItems, wowItems } from "@/db/schema";
import type { Db } from "@/db/types";
import { type ItemDataSource, type ItemQuality, isItemQuality } from "@/lib/loot/constants";
import { type GuildVersion, isSupportedVersion } from "@/lib/game-versions";
import type { BlizzardClient } from "@/server/blizzard/client";

/** Blizzard's API terms: cached Game Data must be refreshed or deleted within 30 days. */
export const BLIZZARD_TTL_DAYS = 30;
/** Refresh a little early so a failed day or two still lands inside the TTL. */
const REFRESH_AFTER_DAYS = 25;
/** Don't ask Blizzard about an item again for a day after a lookup, found or not. */
const RECHECK_AFTER_MS = 86_400_000;
const MAX_LOOKUPS_PER_CALL = 50;
const REFRESH_BATCH = 200;

const DAY = 86_400_000;

export type ItemLookupClient = Pick<BlizzardClient, "getItem">;

export interface KnownItem {
  itemId: number;
  name: string;
  quality: ItemQuality | null;
  icon: string | null;
  itemLevel: number | null;
  /** True when the name or details shown came from Blizzard's API, which then needs attributing. */
  fromBlizzard: boolean;
}

type Row = typeof wowItems.$inferSelect;

function toKnown(r: Row): KnownItem {
  return {
    itemId: r.itemId,
    name: r.name,
    quality: isItemQuality(r.quality) ? r.quality : null,
    icon: r.icon,
    itemLevel: r.itemLevel,
    fromBlizzard: r.nameSource === "blizzard" || r.detailsSource === "blizzard",
  };
}

export interface ItemFact {
  itemId: number;
  name: string | null;
  quality: ItemQuality | null;
}

/**
 * Records item names and qualities seen in a `version` guild's imports, the addon or officer entry. These sources win
 * over Blizzard's API: they replace a Blizzard name, but never overwrite a name another import already gave.
 */
export async function recordItemFacts(
  db: Db,
  version: GuildVersion,
  facts: readonly ItemFact[],
  source: Exclude<ItemDataSource, "blizzard">,
) {
  const byId = new Map<number, ItemFact>();
  for (const f of facts) {
    const prev = byId.get(f.itemId);
    byId.set(f.itemId, { itemId: f.itemId, name: prev?.name ?? f.name, quality: prev?.quality ?? f.quality });
  }
  const rows = [...byId.values()].filter((f): f is ItemFact & { name: string } => Boolean(f.name));
  if (rows.length === 0) return;
  await db
    .insert(wowItems)
    .values(
      rows.map((f) => ({
        gameVersion: version,
        itemId: f.itemId,
        name: f.name,
        nameSource: source,
        quality: f.quality,
        detailsSource: f.quality === null ? null : source,
      })),
    )
    .onConflictDoUpdate({
      target: [wowItems.gameVersion, wowItems.itemId],
      set: {
        name: sql`case when ${wowItems.nameSource} = 'blizzard' then excluded.name else ${wowItems.name} end`,
        nameSource: sql`case when ${wowItems.nameSource} = 'blizzard' then excluded.name_source else ${wowItems.nameSource} end`,
        quality: sql`coalesce(${wowItems.quality}, excluded.quality)`,
        detailsSource: sql`coalesce(${wowItems.detailsSource}, excluded.details_source)`,
        updatedAt: sql`now()`,
      },
    });
}

const rowKey = (version: GuildVersion, itemId: number) => and(eq(wowItems.gameVersion, version), eq(wowItems.itemId, itemId));

async function storeBlizzardItem(
  db: Db,
  version: GuildVersion,
  item: Awaited<ReturnType<ItemLookupClient["getItem"]>>,
  itemId: number,
  now: Date,
) {
  if (item.status !== "ok") {
    await db.update(wowItems).set({ blizzardCheckedAt: now }).where(rowKey(version, itemId));
    return;
  }
  const { name, quality, icon, itemLevel } = item.item;
  await db
    .insert(wowItems)
    .values({
      gameVersion: version,
      itemId,
      name,
      nameSource: "blizzard",
      quality,
      icon,
      itemLevel,
      detailsSource: "blizzard",
      blizzardFetchedAt: now,
      blizzardCheckedAt: now,
    })
    .onConflictDoUpdate({
      target: [wowItems.gameVersion, wowItems.itemId],
      set: {
        name: sql`case when ${wowItems.nameSource} = 'blizzard' then excluded.name else ${wowItems.name} end`,
        // Blizzard's quality only fills a gap; icon and item level come from nowhere else yet.
        quality: sql`coalesce(${wowItems.quality}, excluded.quality)`,
        icon: sql`excluded.icon`,
        itemLevel: sql`excluded.item_level`,
        detailsSource: sql`case when ${wowItems.detailsSource} is null or ${wowItems.icon} is null then 'blizzard'::item_data_source else ${wowItems.detailsSource} end`,
        blizzardFetchedAt: now,
        blizzardCheckedAt: now,
        updatedAt: now,
      },
    });
}

/**
 * Names, qualities, icons and item levels of these items in `version` (the guild's). With a client, items the
 * version's cache doesn't know (or has no icon or item level for) are looked up in that version's Game Data static
 * namespace, at most once a day each and a bounded number per call.
 */
export async function resolveItems(
  db: Db,
  itemIds: Iterable<number>,
  opts: { version: GuildVersion; client?: ItemLookupClient | null; now?: Date },
): Promise<Map<number, KnownItem>> {
  const { version } = opts;
  const ids = [...new Set(itemIds)].filter((id) => Number.isSafeInteger(id) && id > 0);
  if (ids.length === 0) return new Map();
  const select = () => db.select().from(wowItems).where(and(eq(wowItems.gameVersion, version), inArray(wowItems.itemId, ids)));
  let rows = await select();

  if (opts.client && isSupportedVersion(version)) {
    const now = opts.now ?? new Date();
    const byId = new Map(rows.map((r) => [r.itemId, r]));
    const stale = (r: Row | undefined) =>
      !r ||
      ((!r.icon || r.itemLevel === null) && (!r.blizzardCheckedAt || now.getTime() - r.blizzardCheckedAt.getTime() > RECHECK_AFTER_MS));
    const wanted = ids.filter((id) => stale(byId.get(id))).slice(0, MAX_LOOKUPS_PER_CALL);
    if (wanted.length) {
      for (let i = 0; i < wanted.length; i += 5) {
        const chunk = wanted.slice(i, i + 5);
        const results = await Promise.all(chunk.map((id) => opts.client!.getItem(id, version)));
        for (const [j, result] of results.entries()) await storeBlizzardItem(db, version, result, chunk[j]!, now);
      }
      rows = await select();
    }
  }
  return new Map(rows.map((r) => [r.itemId, toKnown(r)]));
}

/** Exact, case-insensitive name lookup in the version's cache. */
export async function findItemByName(db: Db, version: GuildVersion, name: string): Promise<KnownItem | null> {
  const [row] = await db
    .select()
    .from(wowItems)
    .where(and(eq(wowItems.gameVersion, version), sql`lower(${wowItems.name}) = ${name.trim().toLowerCase()}`))
    .orderBy(asc(wowItems.itemId))
    .limit(1);
  return row ? toKnown(row) : null;
}

/** The version's items, for the award form's suggestions. */
export async function listKnownItems(db: Db, version: GuildVersion, limit = 1000) {
  return db
    .select({ itemId: wowItems.itemId, name: wowItems.name })
    .from(wowItems)
    .where(eq(wowItems.gameVersion, version))
    .orderBy(asc(wowItems.name))
    .limit(limit);
}

/**
 * Daily: refreshes Blizzard data older than 25 days from each row's own version namespace, fills in rows that were
 * never looked up (Anniversary copies made by migration 0023), and deletes Blizzard data that couldn't be refreshed
 * within 30 days (rows named by Blizzard go entirely; otherwise just the Blizzard details). The pre-version
 * `wow_items` table gets the same deletion until it is dropped.
 */
export async function refreshItemCache(db: Db, client: ItemLookupClient | null, now = new Date()) {
  let refreshed = 0;
  if (client) {
    const due = await db
      .select({ gameVersion: wowItems.gameVersion, itemId: wowItems.itemId })
      .from(wowItems)
      .where(
        or(
          and(isNotNull(wowItems.blizzardFetchedAt), lt(wowItems.blizzardFetchedAt, new Date(now.getTime() - REFRESH_AFTER_DAYS * DAY))),
          and(isNull(wowItems.blizzardCheckedAt), or(isNull(wowItems.icon), isNull(wowItems.itemLevel))),
        ),
      )
      .orderBy(sql`${wowItems.blizzardFetchedAt} asc nulls last`, asc(wowItems.itemId))
      .limit(REFRESH_BATCH);
    for (const { gameVersion, itemId } of due) {
      if (!isSupportedVersion(gameVersion)) continue;
      const result = await client.getItem(itemId, gameVersion);
      await storeBlizzardItem(db, gameVersion, result, itemId, now);
      if (result.status === "ok") refreshed++;
    }
  }

  const cutoff = new Date(now.getTime() - BLIZZARD_TTL_DAYS * DAY);
  const expired = and(isNotNull(wowItems.blizzardFetchedAt), lt(wowItems.blizzardFetchedAt, cutoff));
  const deleted = await db
    .delete(wowItems)
    .where(and(expired, eq(wowItems.nameSource, "blizzard")))
    .returning({ itemId: wowItems.itemId });
  const cleared = await db
    .update(wowItems)
    .set({
      icon: null,
      itemLevel: null,
      quality: sql`case when ${wowItems.detailsSource} = 'blizzard' then null else ${wowItems.quality} end`,
      detailsSource: sql`case when ${wowItems.detailsSource} = 'blizzard' then null else ${wowItems.detailsSource} end`,
      blizzardFetchedAt: null,
      updatedAt: now,
    })
    .where(expired)
    .returning({ itemId: wowItems.itemId });
  const legacy = await purgeLegacyItemCache(db, cutoff, now);
  return { refreshed, deleted: deleted.length, cleared: cleared.length, legacy };
}

/** Blizzard's 30-day limit for the pre-version `wow_items` table, which nothing refreshes any more. */
async function purgeLegacyItemCache(db: Db, cutoff: Date, now: Date) {
  const expired = and(isNotNull(legacyWowItems.blizzardFetchedAt), lt(legacyWowItems.blizzardFetchedAt, cutoff));
  const deleted = await db
    .delete(legacyWowItems)
    .where(and(expired, eq(legacyWowItems.nameSource, "blizzard")))
    .returning({ itemId: legacyWowItems.itemId });
  const cleared = await db
    .update(legacyWowItems)
    .set({
      icon: null,
      itemLevel: null,
      quality: sql`case when ${legacyWowItems.detailsSource} = 'blizzard' then null else ${legacyWowItems.quality} end`,
      detailsSource: sql`case when ${legacyWowItems.detailsSource} = 'blizzard' then null else ${legacyWowItems.detailsSource} end`,
      blizzardFetchedAt: null,
      updatedAt: now,
    })
    .where(expired)
    .returning({ itemId: legacyWowItems.itemId });
  return { deleted: deleted.length, cleared: cleared.length };
}
