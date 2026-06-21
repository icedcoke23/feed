import { db as database } from "@/storage/database/drizzle-client";
import { classes } from "@/storage/database/shared/schema";
import { eq, desc, and, like, count } from "drizzle-orm";
import type { Database } from "@/storage/database/types";

export interface ListClassesOptions {
  page: number;
  limit: number;
  isActive?: boolean;
  teacherId?: string;
  search?: string;
}

export async function list(options: ListClassesOptions, db: Database = database) {
  const { page, limit, isActive, teacherId, search } = options;
  const offset = (page - 1) * limit;

  const conditions = [
    isActive !== undefined ? eq(classes.isActive, isActive) : undefined,
    teacherId ? eq(classes.teacherId, teacherId) : undefined,
    search ? like(classes.name, `%${search}%`) : undefined,
  ].filter(Boolean);

  const where = conditions.length ? and(...conditions) : undefined;

  const [data, total] = await Promise.all([
    db
      .select()
      .from(classes)
      .where(where)
      .orderBy(desc(classes.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(classes).where(where),
  ]);

  return { data, count: total[0]?.value ?? 0 };
}

export async function findById(id: string, db: Database = database) {
  const rows = await db.select().from(classes).where(eq(classes.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function create(payload: typeof classes.$inferInsert, db: Database = database) {
  const rows = await db.insert(classes).values(payload).returning();
  return rows[0];
}

export async function update(id: string, payload: Partial<typeof classes.$inferInsert>, db: Database = database) {
  const rows = await db.update(classes).set(payload).where(eq(classes.id, id)).returning();
  return rows[0] ?? null;
}

export async function remove(id: string, db: Database = database) {
  return db.delete(classes).where(eq(classes.id, id));
}
