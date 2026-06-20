import { newDb, DataType } from "pg-mem";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@/storage/database/shared/schema";

export function createTestDb() {
  const db = newDb();

  db.public.registerFunction({
    name: "gen_random_uuid",
    returns: DataType.uuid,
    implementation: () => crypto.randomUUID(),
    impure: true,
  });

  const pg = db.adapters.createPg();
  const pool = new pg.Pool();
  const drizzleDb = drizzle(pool, { schema });

  return { db, pool, drizzleDb };
}
