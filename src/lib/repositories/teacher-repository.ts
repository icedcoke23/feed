import { db as database } from "@/storage/database/drizzle-client";
import { teachers } from "@/storage/database/shared/schema";
import { eq, desc, and, like, or, count } from "drizzle-orm";
import type { Database } from "@/storage/database/types";

export interface ListTeachersOptions {
  page: number;
  limit: number;
  isActive?: boolean;
  search?: string;
  role?: string;
}

export async function list(options: ListTeachersOptions, db: Database = database) {
  const { page, limit, isActive, search, role } = options;
  const offset = (page - 1) * limit;

  const conditions = [
    isActive !== undefined ? eq(teachers.isActive, isActive) : undefined,
    role ? eq(teachers.role, role) : undefined,
    search
      ? or(
          like(teachers.name, `%${search}%`),
          like(teachers.email, `%${search}%`),
          like(teachers.phone, `%${search}%`)
        )
      : undefined,
  ].filter(Boolean);

  const where = conditions.length ? and(...conditions) : undefined;

  const [data, total] = await Promise.all([
    db
      .select()
      .from(teachers)
      .where(where)
      .orderBy(desc(teachers.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(teachers).where(where),
  ]);

  return { data, count: total[0]?.value ?? 0 };
}

export async function findById(id: string, db: Database = database) {
  const rows = await db
    .select()
    .from(teachers)
    .where(eq(teachers.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function create(payload: typeof teachers.$inferInsert, db: Database = database) {
  const rows = await db.insert(teachers).values(payload).returning();
  return rows[0];
}

export async function update(
  id: string,
  payload: Partial<typeof teachers.$inferInsert>,
  db: Database = database
) {
  const rows = await db
    .update(teachers)
    .set(payload)
    .where(eq(teachers.id, id))
    .returning();
  return rows[0] ?? null;
}

export async function remove(id: string, db: Database = database) {
  return db.delete(teachers).where(eq(teachers.id, id));
}
