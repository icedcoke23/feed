import * as repo from "@/lib/repositories/tag-repository";
import { forbiddenError, notFoundError } from "@/lib/api-error";
import { successResponse } from "@/lib/api-response";
import { isAdmin } from "@/lib/services/auth-utils";
import { toSnakeCaseTag } from "@/lib/services/snake-case-mappers";
import type { AuthUserResult } from "@/lib/route-auth";

export async function list(user: AuthUserResult, options: repo.ListTagsOptions) {
  const tags = await repo.list(options);
  return tags.map(toSnakeCaseTag);
}

export async function findById(user: AuthUserResult, id: string) {
  const tag = await repo.findById(id);
  if (!tag) return notFoundError("标签不存在");
  return toSnakeCaseTag(tag);
}

export async function create(
  user: AuthUserResult,
  payload: Parameters<typeof repo.create>[0]
) {
  if (!isAdmin(user)) {
    return forbiddenError("权限不足");
  }
  const tag = await repo.create(payload);
  return toSnakeCaseTag(tag);
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
  if (!existing) return notFoundError("标签不存在");
  const tag = await repo.update(id, payload);
  if (!tag) return notFoundError("标签不存在");
  return toSnakeCaseTag(tag);
}

export async function remove(user: AuthUserResult, id: string) {
  if (!isAdmin(user)) {
    return forbiddenError("权限不足");
  }
  const existing = await repo.findById(id);
  if (!existing) return notFoundError("标签不存在");
  await repo.remove(id);
  return successResponse(null, "删除成功");
}
