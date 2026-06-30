import * as repo from "@/lib/repositories/teacher-repository";
import * as lookupCache from "@/lib/services/lookup-service";
import { db } from "@/storage/database/drizzle-client";
import { users, teachers } from "@/storage/database/shared/schema";
import { eq, and, count } from "drizzle-orm";
import { buildPaginationMeta } from "@/lib/pagination";
import { forbiddenError, notFoundError, badRequestError } from "@/lib/api-error";
import { maskPhone, maskEmail } from "@/lib/sensitive-mask";
import { isAdmin } from "@/lib/services/auth-utils";
import type { AuthUserResult } from "@/lib/route-auth";
import type { Teacher } from "@/storage/database/shared/schema";

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

  // 自删检查：防止管理员删除自己的账号导致会话失效
  if (id === user.userId) {
    return badRequestError("不能删除当前登录账号");
  }

  const existing = await repo.findById(id);
  if (!existing) return notFoundError("教师不存在");

  // 最后一个 admin 教师检查：防止删除最后一个管理员导致系统无法管理
  if (existing.role === "admin") {
    const adminCount = await db
      .select({ value: count() })
      .from(teachers)
      .where(and(eq(teachers.role, "admin"), eq(teachers.isActive, true)));
    if ((adminCount[0]?.value ?? 0) <= 1) {
      return badRequestError("不能删除最后一个管理员教师");
    }
  }

  // 软删除：保留记录但标记为非活跃，便于数据审计与历史关联
  await db.transaction(async (tx) => {
    await tx
      .update(teachers)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(teachers.id, id));
    await tx.update(users).set({ isActive: false }).where(eq(users.id, id));
  });

  lookupCache.invalidateTeachers();
}
