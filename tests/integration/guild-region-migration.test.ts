import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { describe, expect, it } from "vitest";
import * as schema from "@/db/schema";

describe("migration 0017", () => {
  it("puts existing guilds and verified characters in the Americas and makes names unique per region", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "guildbook-migrations-"));
    try {
      cpSync("drizzle", dir, { recursive: true });
      const journalPath = path.join(dir, "meta", "_journal.json");
      const journal = JSON.parse(readFileSync(journalPath, "utf8"));
      const full = structuredClone(journal);
      const at = journal.entries.findIndex((e: { tag: string }) => e.tag === "0017_guild_region");
      expect(at).toBeGreaterThan(0);
      // Drizzle applies migrations in journal order by timestamp: 0017 must sort after everything before it.
      expect(full.entries[at].when).toBeGreaterThan(full.entries[at - 1].when);
      journal.entries = journal.entries.slice(0, at);
      writeFileSync(journalPath, JSON.stringify(journal));

      const client = new PGlite();
      const old = drizzle(client, { schema });
      await migrate(old, { migrationsFolder: dir });
      await old.execute(sql`insert into users (id) values ('u1')`);
      const [{ id: guildId } = { id: "" }] = (
        await old.execute<{ id: string }>(
          sql`insert into guilds (slug, name, faction, ruleset, preset) values ('old-guild', 'Old Guild', 'alliance', 'normal', 'standard') returning id`,
        )
      ).rows;
      const [{ id: rankId } = { id: "" }] = (
        await old.execute<{ id: string }>(sql`insert into ranks (guild_id, name, sort_order, tier) values (${guildId}, 'GM', 1, 'admin') returning id`)
      ).rows;
      const [{ id: membershipId } = { id: "" }] = (
        await old.execute<{ id: string }>(
          sql`insert into memberships (guild_id, user_id, rank_id, status) values (${guildId}, 'u1', ${rankId}, 'active') returning id`,
        )
      ).rows;
      await old.execute(sql`insert into characters (guild_id, membership_id, name, surname, faction, class, spec, role, level, verified, bnet_character_id, realm_slug)
        values (${guildId}, ${membershipId}, 'Aldric', 'Vane', 'alliance', 'paladin', 'Holy', 'healer', 60, true, '42', 'crusaders-reach'),
               (${guildId}, ${membershipId}, 'Brenna', 'Moor', 'alliance', 'priest', 'Holy', 'healer', 40, false, null, null)`);

      writeFileSync(journalPath, JSON.stringify(full));
      await migrate(old, { migrationsFolder: dir });

      const guildsAfter = (await old.execute<{ region: string }>(sql`select region from guilds`)).rows;
      expect(guildsAfter).toEqual([{ region: "us" }]);
      const chars = (await old.execute<{ name: string; region: string | null }>(sql`select name, region from characters order by name`)).rows;
      expect(chars).toEqual([
        { name: "Aldric", region: "us" },
        { name: "Brenna", region: null },
      ]);

      // No default: new guilds must say which region they are in.
      await expect(
        old.execute(sql`insert into guilds (slug, name, faction, ruleset, tabard_emblem_id) values ('no-region', 'No Region', 'alliance', 'normal', 128)`),
      ).rejects.toThrow();
      // The same name, faction and ruleset can exist once per region.
      await old.execute(sql`insert into guilds (slug, name, region, faction, ruleset, tabard_emblem_id) values ('old-guild-eu', 'OLD GUILD', 'eu', 'alliance', 'normal', 128)`);
      await expect(
        old.execute(sql`insert into guilds (slug, name, region, faction, ruleset, tabard_emblem_id) values ('old-guild-us', 'old guild', 'us', 'alliance', 'normal', 128)`),
      ).rejects.toThrow();
      await client.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
