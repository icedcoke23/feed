import { db } from "@/storage/database/drizzle-client";
import { users } from "@/storage/database/shared/schema";
import { eq, desc, and, like, or, count } from "drizzle-orm";

export interface ListUsersOptions {
  page: number;
  limit: number;
  isActive?: boolean;
  search?: string;
}

export async function list(options: ListUsersOptions) {
  const { page, limit, isActive, search } = options;
  const offset = (page - 1) * limit;

  const conditions = [
    isActive !== undefined ? eq(users.isActive, isActive) : undefined,
    search
      ? or(
          like(users.username, `%${search}%`),
          like(users.name, `%${search}%`),
          like(users.phone, `%${search}%`)
        )
      : undefined,
  ].filter(Boolean);

  const where = conditions.length ? and(...conditions) : undefined;

  const [data, total] = await Promise.all([
    db
      .select()
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(users).where(where),
  ]);

  return { data, count: total[0]?.value ?? 0 };
}

export async function findById(id: string) {
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function findByUsername(username: string) {
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  return rows[0] ?? null;
}

export async function create(payload: typeof users.$inferInsert) {
  const rows = await db.insert(users).values(payload).returning();
  return rows[0];
}

export async function update(
  id: string,
  payload: Partial<typeof users.$inferInsert>
) {
  const rows = await db
    .update(users)
    .set(payload)
    .where(eq(users.id, id))
    .returning();
  return rows[0] ?? null;
}

export async function remove(id: string) {
  return db.delete(users).where(eq(users.id, id));
}
