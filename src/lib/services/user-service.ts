import { db } from "@/storage/database/drizzle-client";
import { users, teachers } from "@/storage/database/shared/schema";
import { eq, and, count, inArray } from "drizzle-orm";
import * as repo from "@/lib/repositories/user-repository";
import { hashPassword } from "@/lib/auth";
import { buildPaginationMeta } from "@/lib/pagination";
import {
  forbiddenError,
  notFoundError,
  badRequestError,
} from "@/lib/api-error";
import { maskPhone } from "@/lib/sensitive-mask";
import type { AuthUserResult } from "@/lib/route-auth";
import type { User } from "@/storage/database/shared/schema";

function isAdmin(user: AuthUserResult) {
  return user.userRole === "admin";
}

function toSnakeCaseUser(user: User & { teacherRole?: "admin" | "teacher" }) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    phone: maskPhone(user.phone),
    is_active: user.isActive,
    created_at: user.createdAt,
    teacherRole: user.teacherRole,
  };
}

async function enrichUsers(
  rows: User[]
): Promise<Array<ReturnType<typeof toSnakeCaseUser>>> {
  if (rows.length === 0) return [];

  const teacherIds = rows
    .filter((u) => u.role === "teacher")
    .map((u) => u.id) as string[];

  let teacherRoles: Record<string, "admin" | "teacher"> = {};
  if (teacherIds.length > 0) {
    const teacherRows = await db
      .select({ id: teachers.id, role: teachers.role })
      .from(teachers)
      .where(inArray(teachers.id, teacherIds));
    teacherRoles = Object.fromEntries(
      teacherRows.map((t) => [t.id, (t.role as "admin" | "teacher") || "teacher"])
    );
  }

  return rows.map((u) =>
    toSnakeCaseUser({
      ...u,
      teacherRole: u.role === "teacher" ? teacherRoles[u.id] : undefined,
    })
  );
}

export interface ListUsersQuery {
  page: number;
  limit: number;
  search?: string;
  isActive?: boolean;
}

export async function list(user: AuthUserResult, query: ListUsersQuery) {
  if (!isAdmin(user)) return forbiddenError("权限不足");

  const options: repo.ListUsersOptions = {
    page: query.page,
    limit: query.limit,
    isActive: query.isActive,
    search: query.search,
  };

  const result = await repo.list(options);
  const data = await enrichUsers(result.data);

  return {
    data,
    pagination: buildPaginationMeta(query.page, query.limit, result.count),
  };
}

export async function findById(user: AuthUserResult, id: string) {
  if (!isAdmin(user)) return forbiddenError("权限不足");

  const existing = await repo.findById(id);
  if (!existing) return notFoundError("用户不存在");

  const [enriched] = await enrichUsers([existing]);
  return enriched;
}

export interface CreateUserInput {
  username: string;
  name: string;
  role?: "admin" | "teacher";
  phone?: string;
  password: string;
  teacherRole?: "admin" | "teacher";
}

export async function create(user: AuthUserResult, input: CreateUserInput) {
  if (!isAdmin(user)) return forbiddenError("权限不足");

  const result = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(users)
      .values({
        username: input.username,
        name: input.name,
        role: input.role || "teacher",
        phone: input.phone,
        password: await hashPassword(input.password),
        isActive: true,
      })
      .returning();

    const newUser = inserted[0];

    if (newUser.role === "teacher") {
      await tx.insert(teachers).values({
        id: newUser.id,
        name: newUser.name,
        email: `${input.username}@school.com`,
        phone: input.phone,
        role: input.teacherRole || "teacher",
        isActive: true,
      });
    }

    return newUser;
  });

  const [enriched] = await enrichUsers([result]);
  return enriched;
}

export interface UpdateUserInput {
  name?: string;
  phone?: string;
  role?: "admin" | "teacher";
  isActive?: boolean;
  password?: string;
  teacherRole?: "admin" | "teacher";
}

export async function update(
  user: AuthUserResult,
  id: string,
  input: UpdateUserInput
) {
  if (!isAdmin(user)) return forbiddenError("权限不足");

  const existing = await repo.findById(id);
  if (!existing) return notFoundError("用户不存在");

  const updateData: Partial<typeof users.$inferInsert> = {
    name: input.name,
    phone: input.phone,
    role: input.role,
    isActive: input.isActive,
  };

  if (input.password) {
    updateData.password = await hashPassword(input.password);
  }

  const result = await db.transaction(async (tx) => {
    const updated = await tx
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();

    const userRecord = updated[0];

    if (userRecord.role === "teacher") {
      const teacherUpdate: Partial<typeof teachers.$inferInsert> = {
        name: userRecord.name,
        phone: userRecord.phone,
      };
      if (input.teacherRole) {
        teacherUpdate.role = input.teacherRole;
      }
      await tx.update(teachers).set(teacherUpdate).where(eq(teachers.id, id));
    }

    return userRecord;
  });

  const [enriched] = await enrichUsers([result]);
  return enriched;
}

export async function remove(user: AuthUserResult, id: string) {
  if (!isAdmin(user)) return forbiddenError("权限不足");

  const existing = await repo.findById(id);
  if (!existing) return notFoundError("用户不存在");

  if (existing.role === "admin") {
    const adminCount = await db
      .select({ value: count() })
      .from(users)
      .where(and(eq(users.role, "admin"), eq(users.isActive, true)));
    if ((adminCount[0]?.value ?? 0) <= 1) {
      return badRequestError("不能删除最后一个管理员");
    }
  }

  await db.transaction(async (tx) => {
    await tx.update(users).set({ isActive: false }).where(eq(users.id, id));
    await tx.update(teachers).set({ isActive: false }).where(eq(teachers.id, id));
  });
}

export interface ResetPasswordInput {
  newPassword: string;
}

export async function resetPassword(
  user: AuthUserResult,
  id: string,
  input: ResetPasswordInput
) {
  if (!isAdmin(user)) return forbiddenError("权限不足");

  const existing = await repo.findById(id);
  if (!existing) return notFoundError("用户不存在");

  if (!input.newPassword || input.newPassword.length < 6) {
    return badRequestError("新密码至少6个字符");
  }

  await repo.update(id, { password: await hashPassword(input.newPassword) });

  return { success: true };
}
