import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT, PgTransaction } from "drizzle-orm/pg-core";
import type * as schema from "./schema";

type Schema = typeof schema;

/** Any Drizzle Postgres database or transaction (node-postgres in the app, PGlite in tests). */
export type Db =
  | PgDatabase<PgQueryResultHKT, Schema>
  | PgTransaction<PgQueryResultHKT, Schema, ExtractTablesWithRelations<Schema>>;
