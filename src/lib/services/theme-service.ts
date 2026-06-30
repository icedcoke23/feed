import * as repo from "@/lib/repositories/theme-repository";
import { forbiddenError, notFoundError } from "@/lib/api-error";
import { successResponse } from "@/lib/api-response";
import { isAdmin } from "@/lib/services/auth-utils";
import { toSnakeCaseTheme } from "@/lib/services/snake-case-mappers";
import type { AuthUserResult } from "@/lib/route-auth";

export async function list(user: AuthUserResult, options: repo.ListThemesOptions) {
  const themes = await repo.list(options);
  return themes.map(toSnakeCaseTheme);
}

export async function findById(user: AuthUserResult, id: string) {
  const theme = await repo.findById(id);
  if (!theme) return notFoundError("主题不存在");
  return toSnakeCaseTheme(theme);
}

export async function create(
  user: AuthUserResult,
  payload: Parameters<typeof repo.create>[0]
) {
  if (!isAdmin(user)) {
    return forbiddenError("权限不足");
  }
  const theme = await repo.create(payload);
  return toSnakeCaseTheme(theme);
}

export async function batchCreate(
  user: AuthUserResult,
  payloads: Parameters<typeof repo.batchCreate>[0]
) {
  if (!isAdmin(user)) {
    return forbiddenError("权限不足");
  }
  const themes = await repo.batchCreate(payloads);
  return themes.map(toSnakeCaseTheme);
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
  const theme = await repo.update(id, payload);
  if (!theme) return notFoundError("主题不存在");
  return toSnakeCaseTheme(theme);
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
