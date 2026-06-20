import * as repo from "@/lib/repositories/teacher-repository";
import * as lookupCache from "@/lib/services/lookup-service";
import { buildPaginationMeta } from "@/lib/pagination";
import { forbiddenError } from "@/lib/api-error";
import type { AuthUserResult } from "@/lib/route-auth";

function isAdmin(user: AuthUserResult) {
  return user.userRole === "admin" || user.teacherRole === "admin";
}

export async function list(user: AuthUserResult, options: repo.ListTeachersOptions) {
  if (!isAdmin(user)) return forbiddenError("权限不足");
  const result = await repo.list(options);
  return {
    data: result.data,
    pagination: buildPaginationMeta(options.page, options.limit, result.count),
  };
}

export async function findById(user: AuthUserResult, id: string) {
  // 任意已登录用户均可查看单个教师信息
  void user;
  return repo.findById(id);
}

export async function create(
  user: AuthUserResult,
  payload: Parameters<typeof repo.create>[0]
) {
  if (!isAdmin(user)) return forbiddenError("权限不足");
  const result = await repo.create(payload);
  lookupCache.invalidateTeachers();
  return result;
}

export async function update(
  user: AuthUserResult,
  id: string,
  payload: Parameters<typeof repo.update>[1]
) {
  if (!isAdmin(user)) return forbiddenError("权限不足");
  const result = await repo.update(id, payload);
  lookupCache.invalidateTeachers();
  return result;
}

export async function remove(user: AuthUserResult, id: string) {
  if (!isAdmin(user)) return forbiddenError("权限不足");
  await repo.remove(id);
  lookupCache.invalidateTeachers();
}
