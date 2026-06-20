import { db } from "@/storage/database/drizzle-client";
import { tags } from "@/storage/database/shared/schema";
import { eq, asc, and } from "drizzle-orm";

export interface ListTagsOptions {
  category?: string;
}

export type Tag = typeof tags.$inferSelect;

export async function list(options: ListTagsOptions) {
  const { category } = options;

  const conditions = [
    eq(tags.isActive, true),
    category ? eq(tags.category, category) : undefined,
  ].filter(Boolean);

  const where = conditions.length ? and(...conditions) : undefined;

  return db.select().from(tags).where(where).orderBy(asc(tags.sortOrder));
}

export async function findById(id: string) {
  const rows = await db.select().from(tags).where(eq(tags.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function create(payload: typeof tags.$inferInsert) {
  const rows = await db.insert(tags).values(payload).returning();
  return rows[0];
}

export async function update(
  id: string,
  payload: Partial<typeof tags.$inferInsert>
) {
  const rows = await db
    .update(tags)
    .set(payload)
    .where(eq(tags.id, id))
    .returning();
  return rows[0] ?? null;
}

export async function remove(id: string) {
  await db.update(tags).set({ isActive: false }).where(eq(tags.id, id));
}
