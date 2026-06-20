import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { ExtractTablesWithRelations } from "drizzle-orm/relations";
import * as schema from "./shared/schema";

export type Database = PgDatabase<
  PgQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;
