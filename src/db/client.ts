import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import type { Db } from "./types";

/**
 * The shared pool, without the `server-only` guard so the proxy can import it too.
 * Application code imports `@/db` instead.
 */
const globalForDb = globalThis as unknown as { pgPool?: Pool };

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  return new Pool({ connectionString, max: 5 });
}

const pool = globalForDb.pgPool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForDb.pgPool = pool;

export const db: Db = drizzle(pool, { schema });
