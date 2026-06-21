import { db as database } from "@/storage/database/drizzle-client";
import { feedbacks } from "@/storage/database/shared/schema";
import { eq, inArray, and, desc, count } from "drizzle-orm";
import type { Database } from "@/storage/database/types";

export interface ListFeedbacksOptions {
  page: number;
  limit: number;
  studentId?: string;
  teacherId?: string;
  status?: string;
  studentIds?: string[];
}

export async function list(options: ListFeedbacksOptions, db: Database = database) {
  const { page, limit, studentId, teacherId, status, studentIds } = options;
  const offset = (page - 1) * limit;

  const conditions = [
    studentId ? eq(feedbacks.studentId, studentId) : undefined,
    teacherId ? eq(feedbacks.teacherId, teacherId) : undefined,
    status ? eq(feedbacks.status, status) : undefined,
    studentIds?.length ? inArray(feedbacks.studentId, studentIds) : undefined,
  ].filter(Boolean);

  const where = conditions.length ? and(...conditions) : undefined;

  const [data, total] = await Promise.all([
    db
      .select()
      .from(feedbacks)
      .where(where)
      .orderBy(desc(feedbacks.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(feedbacks).where(where),
  ]);

  return { data, count: total[0]?.value ?? 0 };
}

export async function findById(id: string, db: Database = database) {
  const rows = await db.select().from(feedbacks).where(eq(feedbacks.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function create(payload: typeof feedbacks.$inferInsert, db: Database = database) {
  const rows = await db.insert(feedbacks).values(payload).returning();
  return rows[0];
}

export async function update(id: string, payload: Partial<typeof feedbacks.$inferInsert>, db: Database = database) {
  const rows = await db.update(feedbacks).set(payload).where(eq(feedbacks.id, id)).returning();
  return rows[0] ?? null;
}

export async function remove(id: string, db: Database = database) {
  return db.delete(feedbacks).where(eq(feedbacks.id, id));
}
