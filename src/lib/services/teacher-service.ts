import * as repo from "@/lib/repositories/teacher-repository";
import * as lookupCache from "@/lib/services/lookup-service";
import { db } from "@/storage/database/drizzle-client";
import { users } from "@/storage/database/shared/schema";
import { eq } from "drizzle-orm";
import { buildPaginationMeta } from "@/lib/pagination";
import { forbiddenError } from "@/lib/api-error";
import { maskPhone, maskEmail } from "@/lib/sensitive-mask";
import type { AuthUserResult } from "@/lib/route-auth";
import type { Teacher } from "@/storage/database/shared/schema";

function isAdmin(user: AuthUserResult) {
  return user.userRole === "admin" || user.teacherRole === "admin";
}

function toResponse(teacher: Teacher) {
  return {
    id: teacher.id,
    name: teacher.name,
    email: maskEmail(teacher.email),
    phone: maskPhone(teacher.phone),
    role: teacher.role,
    is_active: teacher.isActive,
    created_at: teacher.createdAt,
    updated_at: teacher.updatedAt,
  };
}

export async function list(user: AuthUserResult, options: repo.ListTeachersOptions) {
  if (!isAdmin(user)) return forbiddenError("权限不足");
  const result = await repo.list(options);
  return {
    data: result.data.map(toResponse),
    pagination: buildPaginationMeta(options.page, options.limit, result.count),
  };
}

export async function findById(user: AuthUserResult, id: string) {
  // 任意已登录用户均可查看单个教师信息
  void user;
  const teacher = await repo.findById(id);
  if (!teacher) return null;
  return toResponse(teacher);
}

export async function create(
  user: AuthUserResult,
  payload: Parameters<typeof repo.create>[0]
) {
  if (!isAdmin(user)) return forbiddenError("权限不足");
  const result = await repo.create(payload);
  lookupCache.invalidateTeachers();
  return toResponse(result);
}

export async function update(
  user: AuthUserResult,
  id: string,
  payload: Parameters<typeof repo.update>[1]
) {
  if (!isAdmin(user)) return forbiddenError("权限不足");

  const result = await db.transaction(async (tx) => {
    const updated = await repo.update(id, payload, tx);
    if (!updated) return null;

    // 同步更新 users 表的 name 和 phone
    await tx
      .update(users)
      .set({
        name: payload.name,
        phone: payload.phone,
      })
      .where(eq(users.id, id));

    return updated;
  });

  if (!result) return null;
  lookupCache.invalidateTeachers();
  return toResponse(result);
}

export async function remove(user: AuthUserResult, id: string) {
  if (!isAdmin(user)) return forbiddenError("权限不足");

  await db.transaction(async (tx) => {
    await tx.delete(users).where(eq(users.id, id));
    await repo.remove(id, tx);
  });

  lookupCache.invalidateTeachers();
}
