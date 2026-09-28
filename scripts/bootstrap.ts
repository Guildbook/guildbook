import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/db/schema";
import { bootstrapOrderGuild } from "../src/db/order";

config({ path: [".env.local", ".env"], quiet: true });

/** Creates the Order of Saint Michael (and nothing else) if it doesn't exist yet. Usage: pnpm db:bootstrap [--slug osm] */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const slugArg = process.argv.indexOf("--slug");
  const slug = slugArg >= 0 ? process.argv[slugArg + 1] : "osm";
  if (!slug) throw new Error("--slug needs a value");

  const pool = new Pool({ connectionString: url });
  try {
    const db = drizzle(pool, { schema });
    const { guild, created } = await bootstrapOrderGuild(db, slug);
    const host = new URL(url).hostname;
    console.log(created ? `Created "${guild.name}" (${guild.slug}) on ${host}.` : `Guild "${guild.slug}" already exists on ${host}; nothing to do.`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
