import * as repo from "@/lib/repositories/theme-repository";
import { forbiddenError, notFoundError } from "@/lib/api-error";
import { successResponse } from "@/lib/api-response";
import type { AuthUserResult } from "@/lib/route-auth";

function isAdmin(user: AuthUserResult) {
  return user.userRole === "admin" || user.teacherRole === "admin";
}

export async function list(user: AuthUserResult, options: repo.ListThemesOptions) {
  return repo.list(options);
}

export async function findById(user: AuthUserResult, id: string) {
  const theme = await repo.findById(id);
  if (!theme) return notFoundError("主题不存在");
  return theme;
}

export async function create(
  user: AuthUserResult,
  payload: Parameters<typeof repo.create>[0]
) {
  if (!isAdmin(user)) {
    return forbiddenError("权限不足");
  }
  return repo.create(payload);
}

export async function batchCreate(
  user: AuthUserResult,
  payloads: Parameters<typeof repo.batchCreate>[0]
) {
  if (!isAdmin(user)) {
    return forbiddenError("权限不足");
  }
  return repo.batchCreate(payloads);
}

export async function update(
  user: AuthUserResult,
  id: string,
  payload: Parameters<typeof repo.update>[1]
) {
  if (!isAdmin(user)) {
    return forbiddenError("权限不足");
  }
  const existing = await repo.findById(id);
  if (!existing) return notFoundError("主题不存在");
  return repo.update(id, payload);
}

export async function remove(user: AuthUserResult, id: string) {
  if (!isAdmin(user)) {
    return forbiddenError("权限不足");
  }
  const existing = await repo.findById(id);
  if (!existing) return notFoundError("主题不存在");
  await repo.remove(id);
  return successResponse(null, "删除成功");
}
