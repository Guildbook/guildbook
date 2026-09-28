import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { LEGACY_EMBLEM_MATCH } from "@/lib/tabard/crest";

describe("migration 0018", () => {
  it("moves every generic crest to the closest real emblem, leaves the Order alone and then requires an emblem", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "guildbook-migrations-"));
    try {
      cpSync("drizzle", dir, { recursive: true });
      const journalPath = path.join(dir, "meta", "_journal.json");
      const journal = JSON.parse(readFileSync(journalPath, "utf8"));
      const full = structuredClone(journal);
      const at = journal.entries.findIndex((e: { tag: string }) => e.tag === "0018_guild_crest");
      expect(at).toBeGreaterThan(0);
      expect(full.entries[at].when).toBeGreaterThan(full.entries[at - 1].when);
      journal.entries = journal.entries.slice(0, at);
      writeFileSync(journalPath, JSON.stringify(journal));

      const client = new PGlite();
      const old = drizzle(client, { schema });
      await migrate(old, { migrationsFolder: dir });
      const drawn = [...Object.keys(LEGACY_EMBLEM_MATCH), "retired-emblem"];
      for (const [i, emblem] of drawn.entries()) {
        await old.execute(
          sql`insert into guilds (slug, name, region, faction, ruleset, preset, tabard_emblem) values (${`g-${i}`}, ${`Guild ${i}`}, 'us', 'alliance', 'normal', 'standard', ${emblem})`,
        );
      }
      await old.execute(sql`insert into guilds (slug, name, region, faction, ruleset) values ('defaulted', 'Defaulted', 'us', 'horde', 'normal')`);
      await old.execute(
        sql`insert into guilds (slug, name, region, faction, ruleset, preset, theme_base, tabard_emblem) values ('osm', 'Order', 'us', 'alliance', 'normal', 'order', 'order', 'cross-pattee')`,
      );

      writeFileSync(journalPath, JSON.stringify(full));
      await migrate(old, { migrationsFolder: dir });

      const rows = (await old.execute<{ slug: string; tabard_emblem: string; tabard_emblem_id: number | null; tabard_border_id: number | null }>(
        sql`select slug, tabard_emblem, tabard_emblem_id, tabard_border_id from guilds`,
      )).rows;
      const bySlug = Object.fromEntries(rows.map((r) => [r.slug, r]));
      for (const [i, emblem] of drawn.entries()) {
        expect(bySlug[`g-${i}`], emblem).toMatchObject({ tabard_emblem_id: LEGACY_EMBLEM_MATCH[emblem] ?? 128, tabard_border_id: null });
      }
      expect(bySlug.defaulted).toMatchObject({ tabard_emblem: "star", tabard_emblem_id: LEGACY_EMBLEM_MATCH.star });
      expect(bySlug.osm).toMatchObject({ tabard_emblem_id: null, tabard_border_id: null });

      await expect(old.execute(sql`update guilds set tabard_emblem_id = null where slug = 'g-0'`)).rejects.toThrow();
      await expect(old.execute(sql`insert into guilds (slug, name, region, faction, ruleset) values ('blank', 'Blank', 'us', 'alliance', 'normal')`)).rejects.toThrow();
      await expect(old.execute(sql`update guilds set tabard_emblem_id = 97 where slug = 'osm'`)).rejects.toThrow();
      await old.execute(sql`update guilds set tabard_border_id = 12 where slug = 'g-0'`);
      await client.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
