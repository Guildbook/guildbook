import { config } from "dotenv";
import { eq, like, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/db/schema";
import { seedDemoGuild } from "../src/db/seed";

config({ path: [".env.local", ".env"], quiet: true });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const slug = process.env.DEFAULT_GUILD_SLUG ?? "osm";
  const reset = process.argv.includes("--reset");
  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool, { schema });

  const [existing] = await db.select().from(schema.guilds).where(eq(schema.guilds.slug, slug));
  if (existing && !reset) {
    console.log(`Guild "${slug}" already exists. Re-run with --reset to wipe and reseed it.`);
    await pool.end();
    return;
  }

  await db.transaction(async (tx) => {
    if (existing) {
      // The audit log is append-only; the demo reset is the one sanctioned exception.
      await tx.execute(sql`alter table audit_log disable trigger audit_log_append_only`);
      // The loot ledger's guard lets a guild's own rows go only under this setting.
      await tx.execute(sql`select set_config('guildbook.audit_purge_guild', ${existing.id}, true)`);
      await tx.delete(schema.guilds).where(eq(schema.guilds.id, existing.id));
      await tx.execute(sql`alter table audit_log enable trigger audit_log_append_only`);
      await tx.delete(schema.users).where(like(schema.users.discordId, "seed-%"));
    }
    await seedDemoGuild(tx, slug);
  });

  console.log(`Seeded demo guild "${slug}".`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
