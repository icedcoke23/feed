import { db as database } from "@/storage/database/drizzle-client";
import { students } from "@/storage/database/shared/schema";
import { eq, inArray, and, or, desc, count, like } from "drizzle-orm";
import type { Database } from "@/storage/database/types";

export interface ListStudentsOptions {
  page: number;
  limit: number;
  isActive?: boolean;
  adminTeacherId?: string;
  classIds?: string[];
  currentTeacherId?: string;
  ids?: string[];
  search?: string;
}

export async function list(options: ListStudentsOptions, db: Database = database) {
  const { page, limit, isActive, adminTeacherId, classIds, currentTeacherId, ids, search } = options;
  const offset = (page - 1) * limit;

  const conditions = [
    isActive !== undefined ? eq(students.isActive, isActive) : undefined,
    adminTeacherId ? eq(students.adminTeacherId, adminTeacherId) : undefined,
    classIds?.length ? inArray(students.classId, classIds) : undefined,
    currentTeacherId ? eq(students.currentTeacherId, currentTeacherId) : undefined,
    ids?.length ? inArray(students.id, ids) : undefined,
    search
      ? or(
          like(students.name, `%${search}%`),
          like(students.school || "", `%${search}%`),
          like(students.grade || "", `%${search}%`)
        )
      : undefined,
  ].filter(Boolean);

  const where = conditions.length ? and(...conditions) : undefined;

  const [data, total] = await Promise.all([
    db
      .select()
      .from(students)
      .where(where)
      .orderBy(desc(students.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(students).where(where),
  ]);

  return { data, count: total[0]?.value ?? 0 };
}

export async function findById(id: string, db: Database = database) {
  const rows = await db.select().from(students).where(eq(students.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function create(payload: typeof students.$inferInsert, db: Database = database) {
  const rows = await db.insert(students).values(payload).returning();
  return rows[0];
}

export async function update(id: string, payload: Partial<typeof students.$inferInsert>, db: Database = database) {
  const rows = await db.update(students).set(payload).where(eq(students.id, id)).returning();
  return rows[0] ?? null;
}

export async function remove(id: string, db: Database = database) {
  return db.delete(students).where(eq(students.id, id));
}
