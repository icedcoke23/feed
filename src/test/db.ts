import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/storage/database/shared/schema";
import { readFileSync } from "fs";
import { join } from "path";

async function runMigrations(client: PGlite) {
  const sql = readFileSync(
    join(
      process.cwd(),
      "src",
      "storage",
      "database",
      "migrations",
      "0000_equal_harpoon.sql"
    ),
    "utf-8"
  );

  const statements = sql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await client.exec(statement);
  }
}

export async function createTestDb() {
  const client = new PGlite();

  await runMigrations(client);

  const drizzleDb = drizzle(client, { schema });

  return { client, drizzleDb };
}
