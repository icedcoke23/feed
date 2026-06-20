import { db } from "@/storage/database/drizzle-client";
import { courseStages } from "@/storage/database/shared/schema";
import { eq, and, asc } from "drizzle-orm";
import type { CourseStage } from "@/storage/database/shared/schema";

export interface ListCourseStagesOptions {
  theme?: string;
  level?: string;
}

export async function list(options: ListCourseStagesOptions): Promise<CourseStage[]> {
  const { theme, level } = options;

  const conditions = [
    eq(courseStages.isActive, true),
    theme ? eq(courseStages.theme, theme) : undefined,
    level ? eq(courseStages.level, level) : undefined,
  ].filter(Boolean);

  const where = conditions.length ? and(...conditions) : undefined;

  return db
    .select()
    .from(courseStages)
    .where(where)
    .orderBy(asc(courseStages.sortOrder));
}

export async function findById(id: string): Promise<CourseStage | null> {
  const rows = await db.select().from(courseStages).where(eq(courseStages.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function create(payload: typeof courseStages.$inferInsert): Promise<CourseStage> {
  const rows = await db.insert(courseStages).values(payload).returning();
  return rows[0];
}

export async function update(
  id: string,
  payload: Partial<typeof courseStages.$inferInsert>
): Promise<CourseStage | null> {
  const rows = await db.update(courseStages).set(payload).where(eq(courseStages.id, id)).returning();
  return rows[0] ?? null;
}

export async function remove(id: string): Promise<void> {
  await db.update(courseStages).set({ isActive: false }).where(eq(courseStages.id, id));
}
