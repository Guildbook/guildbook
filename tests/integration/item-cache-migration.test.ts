import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { describe, expect, it } from "vitest";
import * as schema from "@/db/schema";

/** Migrates a fresh database up to (not including) `tag`, runs `before`, then applies the rest. */
async function migrateAcross(tag: string, before: (db: ReturnType<typeof drizzle>) => Promise<void>) {
  const dir = mkdtempSync(path.join(tmpdir(), "guildbook-migrations-"));
  cpSync("drizzle", dir, { recursive: true });
  const journalPath = path.join(dir, "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8"));
  const full = structuredClone(journal);
  const at = journal.entries.findIndex((e: { tag: string }) => e.tag === tag);
  expect(at).toBeGreaterThan(0);
  expect(full.entries[at].when).toBeGreaterThan(full.entries[at - 1].when);
  journal.entries = journal.entries.slice(0, at);
  writeFileSync(journalPath, JSON.stringify(journal));
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: dir });
  await before(db);
  writeFileSync(journalPath, JSON.stringify(full));
  await migrate(db, { migrationsFolder: dir });
  return {
    db,
    close: async () => {
      await client.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

describe("migration 0022", () => {
  it("adds the confirmed-member settings with defaults, so inserts written before it keep working", async () => {
    const { db, close } = await migrateAcross("0022_confirmed_member_join", async (db) => {
      await db.execute(sql`insert into guilds (slug, name, region, faction, ruleset, tabard_emblem_id) values ('before', 'Before', 'us', 'alliance', 'normal', 1)`);
    });
    try {
      // What code from before the migration inserts: none of the new columns.
      await db.execute(sql`insert into guilds (slug, name, region, faction, ruleset, tabard_emblem_id) values ('during', 'During', 'us', 'alliance', 'normal', 1)`);
      expect((await db.execute(sql`select slug, auto_approve_in_guild, auto_approve_rank_id from guilds order by slug`)).rows).toEqual([
        { slug: "before", auto_approve_in_guild: true, auto_approve_rank_id: null },
        { slug: "during", auto_approve_in_guild: true, auto_approve_rank_id: null },
      ]);
    } finally {
      await close();
    }
  });
});

describe("migration 0023", () => {
  it("copies the item cache per version, and leaves wow_items working for code deployed before it", async () => {
    const day = 86_400_000;
    const fetched = new Date(Date.now() - 3 * day).toISOString();
    const { db, close } = await migrateAcross("0023_item_cache_by_version", async (db) => {
      await db.execute(sql`insert into wow_items (item_id, name, name_source, quality, icon, item_level, details_source, blizzard_fetched_at, blizzard_checked_at)
        values (100, 'Blizzard Blade', 'blizzard', 4, 'inv_sword_1', 60, 'blizzard', ${fetched}, ${fetched}),
               (200, 'Imported Helm', 'import', 3, null, null, 'import', null, null),
               (300, 'Only Forever', 'import', 2, null, null, 'import', null, null)`);
      const [{ id: guildId } = { id: "" }] = (
        await db.execute<{ id: string }>(
          sql`insert into guilds (slug, name, game_version, realm_slug, region, faction, ruleset, tabard_emblem_id)
            values ('mirkwood', 'Mirkwood', 'anniversary', 'dreamscythe', 'us', 'horde', 'normal', 1) returning id`,
        )
      ).rows;
      for (const itemId of [100, 200]) {
        await db.execute(sql`insert into loot_entries (guild_id, kind, item_id, item_name, response, awarded_at, raid_date, source)
          values (${guildId}, 'award', ${itemId}, 'x', 'disenchant', now(), '2026-12-10', 'manual')`);
      }
    });
    try {
      const rows = (
        await db.execute(sql`select game_version, item_id, name, icon, item_level, blizzard_fetched_at is not null as fetched, blizzard_checked_at is not null as checked
          from wow_version_items order by item_id, game_version`)
      ).rows;
      expect(rows).toEqual([
        { game_version: "forever", item_id: 100, name: "Blizzard Blade", icon: "inv_sword_1", item_level: 60, fetched: true, checked: true },
        // Anniversary keeps the name and icon, and the fetch time for the 30-day limit, but not the item level.
        { game_version: "anniversary", item_id: 100, name: "Blizzard Blade", icon: "inv_sword_1", item_level: null, fetched: true, checked: false },
        { game_version: "forever", item_id: 200, name: "Imported Helm", icon: null, item_level: null, fetched: false, checked: false },
        { game_version: "anniversary", item_id: 200, name: "Imported Helm", icon: null, item_level: null, fetched: false, checked: false },
        { game_version: "forever", item_id: 300, name: "Only Forever", icon: null, item_level: null, fetched: false, checked: false },
      ]);

      // Code from before the migration still upserts on wow_items' item_id key.
      await db.execute(sql`insert into wow_items (item_id, name, name_source) values (200, 'Renamed', 'manual')
        on conflict (item_id) do update set name = excluded.name`);
      expect((await db.execute(sql`select name from wow_items where item_id = 200`)).rows).toEqual([{ name: "Renamed" }]);

      // The new key: one row per version and item.
      await expect(db.execute(sql`insert into wow_version_items (game_version, item_id, name, name_source) values ('forever', 100, 'Dup', 'manual')`)).rejects.toThrow();
    } finally {
      await close();
    }
  });
});
