import { and, asc, eq, inArray, isNotNull, lt, sql } from "drizzle-orm";
import { wowItems } from "@/db/schema";
import type { Db } from "@/db/types";
import { type ItemDataSource, type ItemQuality, isItemQuality } from "@/lib/loot/constants";
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
    fromBlizzard: r.nameSource === "blizzard" || r.detailsSource === "blizzard",
  };
}

export interface ItemFact {
  itemId: number;
  name: string | null;
  quality: ItemQuality | null;
}

/**
 * Records item names and qualities seen in imports, the addon or officer entry. These sources win over Blizzard's
 * API: they replace a Blizzard name, but never overwrite a name another import already gave.
 */
export async function recordItemFacts(db: Db, facts: readonly ItemFact[], source: Exclude<ItemDataSource, "blizzard">) {
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
        itemId: f.itemId,
        name: f.name,
        nameSource: source,
        quality: f.quality,
        detailsSource: f.quality === null ? null : source,
      })),
    )
    .onConflictDoUpdate({
      target: wowItems.itemId,
      set: {
        name: sql`case when ${wowItems.nameSource} = 'blizzard' then excluded.name else ${wowItems.name} end`,
        nameSource: sql`case when ${wowItems.nameSource} = 'blizzard' then excluded.name_source else ${wowItems.nameSource} end`,
        quality: sql`coalesce(${wowItems.quality}, excluded.quality)`,
        detailsSource: sql`coalesce(${wowItems.detailsSource}, excluded.details_source)`,
        updatedAt: sql`now()`,
      },
    });
}

async function storeBlizzardItem(db: Db, item: Awaited<ReturnType<ItemLookupClient["getItem"]>>, itemId: number, now: Date) {
  if (item.status !== "ok") {
    await db.update(wowItems).set({ blizzardCheckedAt: now }).where(eq(wowItems.itemId, itemId));
    return;
  }
  const { name, quality, icon, itemLevel } = item.item;
  await db
    .insert(wowItems)
    .values({
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
      target: wowItems.itemId,
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
 * Names, qualities and icons for these items. With a client, items the cache doesn't know (or has no icon for) are
 * looked up on Blizzard's Game Data API, at most once a day each and a bounded number per call.
 */
export async function resolveItems(
  db: Db,
  itemIds: Iterable<number>,
  opts: { client?: ItemLookupClient | null; now?: Date } = {},
): Promise<Map<number, KnownItem>> {
  const ids = [...new Set(itemIds)].filter((id) => Number.isSafeInteger(id) && id > 0);
  if (ids.length === 0) return new Map();
  let rows = await db.select().from(wowItems).where(inArray(wowItems.itemId, ids));

  if (opts.client) {
    const now = opts.now ?? new Date();
    const byId = new Map(rows.map((r) => [r.itemId, r]));
    const stale = (r: Row | undefined) =>
      !r || (!r.icon && (!r.blizzardCheckedAt || now.getTime() - r.blizzardCheckedAt.getTime() > RECHECK_AFTER_MS));
    const wanted = ids.filter((id) => stale(byId.get(id))).slice(0, MAX_LOOKUPS_PER_CALL);
    if (wanted.length) {
      for (let i = 0; i < wanted.length; i += 5) {
        const chunk = wanted.slice(i, i + 5);
        const results = await Promise.all(chunk.map((id) => opts.client!.getItem(id)));
        for (const [j, result] of results.entries()) await storeBlizzardItem(db, result, chunk[j]!, now);
      }
      rows = await db.select().from(wowItems).where(inArray(wowItems.itemId, ids));
    }
  }
  return new Map(rows.map((r) => [r.itemId, toKnown(r)]));
}

/** Exact, case-insensitive name lookup in the cache. */
export async function findItemByName(db: Db, name: string): Promise<KnownItem | null> {
  const [row] = await db
    .select()
    .from(wowItems)
    .where(sql`lower(${wowItems.name}) = ${name.trim().toLowerCase()}`)
    .orderBy(asc(wowItems.itemId))
    .limit(1);
  return row ? toKnown(row) : null;
}

/** Items for the award form's suggestions. */
export async function listKnownItems(db: Db, limit = 1000) {
  return db
    .select({ itemId: wowItems.itemId, name: wowItems.name })
    .from(wowItems)
    .orderBy(asc(wowItems.name))
    .limit(limit);
}

/**
 * Daily: refreshes Blizzard data older than 25 days, and deletes Blizzard data that couldn't be refreshed within
 * 30 days (rows named by Blizzard go entirely; otherwise just the Blizzard details).
 */
export async function refreshItemCache(db: Db, client: ItemLookupClient | null, now = new Date()) {
  let refreshed = 0;
  if (client) {
    const due = await db
      .select({ itemId: wowItems.itemId })
      .from(wowItems)
      .where(and(isNotNull(wowItems.blizzardFetchedAt), lt(wowItems.blizzardFetchedAt, new Date(now.getTime() - REFRESH_AFTER_DAYS * DAY))))
      .orderBy(asc(wowItems.blizzardFetchedAt))
      .limit(REFRESH_BATCH);
    for (const { itemId } of due) {
      const result = await client.getItem(itemId);
      if (result.status === "ok") {
        await storeBlizzardItem(db, result, itemId, now);
        refreshed++;
      }
    }
  }

  const expired = and(isNotNull(wowItems.blizzardFetchedAt), lt(wowItems.blizzardFetchedAt, new Date(now.getTime() - BLIZZARD_TTL_DAYS * DAY)));
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
  return { refreshed, deleted: deleted.length, cleared: cleared.length };
}
