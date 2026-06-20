import { db } from "@/storage/database/drizzle-client";
import { teachingThemes } from "@/storage/database/shared/schema";
import { eq, and, asc, or, isNull } from "drizzle-orm";

export interface ListThemesOptions {
  category?: string;
}

export async function list(options: ListThemesOptions): Promise<typeof teachingThemes.$inferSelect[]> {
  const { category } = options;

  const conditions = [
    or(eq(teachingThemes.isActive, true), isNull(teachingThemes.isActive)),
    category ? eq(teachingThemes.category, category) : undefined,
  ].filter(Boolean);

  const where = conditions.length ? and(...conditions) : undefined;

  return db
    .select()
    .from(teachingThemes)
    .where(where)
    .orderBy(asc(teachingThemes.sortOrder));
}

export async function findById(id: string): Promise<typeof teachingThemes.$inferSelect | null> {
  const rows = await db.select().from(teachingThemes).where(eq(teachingThemes.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function create(payload: typeof teachingThemes.$inferInsert) {
  const rows = await db.insert(teachingThemes).values(payload).returning();
  return rows[0];
}

export async function update(id: string, payload: Partial<typeof teachingThemes.$inferInsert>) {
  const rows = await db.update(teachingThemes).set(payload).where(eq(teachingThemes.id, id)).returning();
  return rows[0] ?? null;
}

export async function remove(id: string): Promise<void> {
  await db.update(teachingThemes).set({ isActive: false }).where(eq(teachingThemes.id, id));
}
