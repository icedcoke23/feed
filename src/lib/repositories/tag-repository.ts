import { db } from "@/storage/database/drizzle-client";
import { tags } from "@/storage/database/shared/schema";
import { eq, asc, and } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { ExtractTablesWithRelations } from "drizzle-orm/relations";
import * as schema from "@/storage/database/shared/schema";

type Database = PgDatabase<
  PgQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

export interface ListTagsOptions {
  category?: string;
}

export type Tag = typeof tags.$inferSelect;

export async function list(options: ListTagsOptions, tx: Database = db) {
  const { category } = options;

  const conditions = [
    eq(tags.isActive, true),
    category ? eq(tags.category, category) : undefined,
  ].filter(Boolean);

  const where = conditions.length ? and(...conditions) : undefined;

  return tx.select().from(tags).where(where).orderBy(asc(tags.sortOrder));
}

export async function findById(id: string, tx: Database = db) {
  const rows = await tx.select().from(tags).where(eq(tags.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function create(payload: typeof tags.$inferInsert, tx: Database = db) {
  const rows = await tx.insert(tags).values(payload).returning();
  return rows[0];
}

export async function update(
  id: string,
  payload: Partial<typeof tags.$inferInsert>,
  tx: Database = db
) {
  const rows = await tx
    .update(tags)
    .set(payload)
    .where(eq(tags.id, id))
    .returning();
  return rows[0] ?? null;
}

export async function remove(id: string, tx: Database = db) {
  await tx.update(tags).set({ isActive: false }).where(eq(tags.id, id));
}
