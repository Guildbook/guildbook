import { parseArgs } from "node:util";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/db/schema";
import { grantGuildOwner } from "../src/db/order";

config({ path: [".env.local", ".env"], quiet: true });

/** Usage: pnpm guild:grant-owner --guild osm --discord <Discord user ID or username> */
async function main() {
  const { values } = parseArgs({ options: { guild: { type: "string" }, discord: { type: "string" } } });
  if (!values.guild || !values.discord) {
    throw new Error("Usage: pnpm guild:grant-owner --guild <slug> --discord <Discord user ID or username>");
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const pool = new Pool({ connectionString: url });
  try {
    const db = drizzle(pool, { schema });
    const result = await grantGuildOwner(db, { guildSlug: values.guild, discord: values.discord });
    const who = result.user.discordUsername ?? result.user.name ?? result.user.discordId;
    console.log(
      result.changed
        ? `${who} is now ${result.rank.name} of ${result.guild.name}.`
        : `${who} is already ${result.rank.name} of ${result.guild.name}; nothing to do.`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
