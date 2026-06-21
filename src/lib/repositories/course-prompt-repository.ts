import { db as database } from "@/storage/database/drizzle-client";
import { coursePrompts, type CoursePrompt } from "@/storage/database/shared/schema";
import { eq, and, asc } from "drizzle-orm";
import type { Database } from "@/storage/database/types";

export interface ListCoursePromptsOptions {
  full?: boolean;
}

export async function list(
  options: ListCoursePromptsOptions,
  db: Database = database
): Promise<CoursePrompt[]> {
  const { full } = options;

  if (full) {
    return db
      .select()
      .from(coursePrompts)
      .where(eq(coursePrompts.isActive, true))
      .orderBy(asc(coursePrompts.stageCode));
  }

  const briefFields = {
    id: coursePrompts.id,
    stageCode: coursePrompts.stageCode,
    wordLimit: coursePrompts.wordLimit,
    isActive: coursePrompts.isActive,
    createdAt: coursePrompts.createdAt,
    updatedAt: coursePrompts.updatedAt,
  };

  const rows = await db
    .select(briefFields)
    .from(coursePrompts)
    .where(eq(coursePrompts.isActive, true))
    .orderBy(asc(coursePrompts.stageCode));

  return rows as CoursePrompt[];
}

export async function findById(id: string, db: Database = database) {
  const rows = await db
    .select()
    .from(coursePrompts)
    .where(eq(coursePrompts.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function findByStageCode(stageCode: string, db: Database = database) {
  const rows = await db
    .select()
    .from(coursePrompts)
    .where(and(eq(coursePrompts.stageCode, stageCode), eq(coursePrompts.isActive, true)))
    .limit(1);
  return rows[0] ?? null;
}

export async function create(payload: typeof coursePrompts.$inferInsert, db: Database = database) {
  const rows = await db.insert(coursePrompts).values(payload).returning();
  return rows[0];
}

export async function update(
  id: string,
  payload: Partial<typeof coursePrompts.$inferInsert>,
  db: Database = database
) {
  const rows = await db
    .update(coursePrompts)
    .set(payload)
    .where(eq(coursePrompts.id, id))
    .returning();
  return rows[0] ?? null;
}

export async function remove(id: string, db: Database = database) {
  return db
    .update(coursePrompts)
    .set({ isActive: false })
    .where(eq(coursePrompts.id, id));
}
