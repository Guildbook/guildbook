import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { describe, expect, it } from "vitest";
import * as schema from "@/db/schema";

describe("migration 0020", () => {
  it("makes existing guilds WoW: Forever, tags 2.x reports as Anniversary and scopes identity by version and realm", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "guildbook-migrations-"));
    try {
      cpSync("drizzle", dir, { recursive: true });
      const journalPath = path.join(dir, "meta", "_journal.json");
      const journal = JSON.parse(readFileSync(journalPath, "utf8"));
      const full = structuredClone(journal);
      const at = journal.entries.findIndex((e: { tag: string }) => e.tag === "0020_game_version");
      expect(at).toBeGreaterThan(0);
      expect(full.entries[at].when).toBeGreaterThan(full.entries[at - 1].when);
      journal.entries = journal.entries.slice(0, at);
      writeFileSync(journalPath, JSON.stringify(journal));

      const client = new PGlite();
      const db = drizzle(client, { schema });
      await migrate(db, { migrationsFolder: dir });
      await db.execute(sql`insert into users (id) values ('u1')`);
      const [{ id: guildId } = { id: "" }] = (
        await db.execute<{ id: string }>(
          sql`insert into guilds (slug, name, region, faction, ruleset, tabard_emblem_id) values ('mirkwood', 'Mirkwood', 'us', 'horde', 'normal', 128) returning id`,
        )
      ).rows;
      const [{ id: rankId } = { id: "" }] = (
        await db.execute<{ id: string }>(sql`insert into ranks (guild_id, name, sort_order, tier) values (${guildId}, 'GM', 1, 'admin') returning id`)
      ).rows;
      const [{ id: membershipId } = { id: "" }] = (
        await db.execute<{ id: string }>(
          sql`insert into memberships (guild_id, user_id, rank_id, status) values (${guildId}, 'u1', ${rankId}, 'active') returning id`,
        )
      ).rows;
      const report = (label: string, build: string) =>
        db.execute(sql`insert into vigil_reports (guild_id, membership_id, fight_label, fight_kind, player_name, fight_started_at, duration_ms, score, summary)
          values (${guildId}, ${membershipId}, ${label}, 'trash', 'Aldric', now(), 1000, 50, ${JSON.stringify({ log: { build } })}::jsonb)`);
      await report("tbc", "2.5.5");
      await report("classic", "1.15.8");

      writeFileSync(journalPath, JSON.stringify(full));
      await migrate(db, { migrationsFolder: dir });

      expect((await db.execute(sql`select game_version, realm_slug from guilds`)).rows).toEqual([{ game_version: "forever", realm_slug: null }]);
      expect(
        (await db.execute(sql`select fight_label, game_version, version_mismatch from vigil_reports order by fight_label`)).rows,
      ).toEqual([
        { fight_label: "classic", game_version: null, version_mismatch: false },
        { fight_label: "tbc", game_version: "anniversary", version_mismatch: true },
      ]);

      const insert = (slug: string, version: string, realm: string | null, preset = "standard") =>
        db.execute(sql`insert into guilds (slug, name, game_version, realm_slug, region, faction, ruleset, preset, tabard_emblem_id)
          values (${slug}, 'MIRKWOOD', ${version}::game_version, ${realm}, 'us', 'horde', 'normal', ${preset}::guild_preset, 128)`);
      // Code deployed before this migration inserts guilds without a version; they are WoW: Forever.
      await db.execute(sql`insert into guilds (slug, name, region, faction, ruleset, tabard_emblem_id) values ('legacy', 'Legacy', 'us', 'horde', 'normal', 128)`);
      expect((await db.execute(sql`select game_version from guilds where slug = 'legacy'`)).rows).toEqual([{ game_version: "forever" }]);
      // The same name can exist once per version, and once per realm within a version.
      await insert("mirkwood-dreamscythe", "anniversary", "dreamscythe");
      await insert("mirkwood-nightslayer", "anniversary", "nightslayer");
      await expect(insert("mirkwood-2", "anniversary", "dreamscythe")).rejects.toThrow();
      await expect(insert("mirkwood-3", "forever", null)).rejects.toThrow();
      // Forever guilds have no realm; guilds on other versions need one.
      await expect(insert("realmful", "forever", "dreamscythe")).rejects.toThrow();
      await expect(insert("realmless", "anniversary", null)).rejects.toThrow();
      // The Order preset stays on WoW: Forever.
      await expect(
        db.execute(sql`insert into guilds (slug, name, game_version, realm_slug, region, faction, ruleset, preset)
          values ('osm-tbc', 'Order TBC', 'anniversary', 'dreamscythe', 'us', 'alliance', 'normal', 'order')`),
      ).rejects.toMatchObject({ cause: { constraint: "guilds_order_forever" } });
      await client.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
