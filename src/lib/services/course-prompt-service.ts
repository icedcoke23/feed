import * as repo from "@/lib/repositories/course-prompt-repository";
import { forbiddenError, notFoundError } from "@/lib/api-error";
import { successResponse } from "@/lib/api-response";
import type { AuthUserResult } from "@/lib/route-auth";

function isAdmin(user: AuthUserResult) {
  return user.userRole === "admin" || user.teacherRole === "admin";
}

export async function list(
  user: AuthUserResult,
  options: repo.ListCoursePromptsOptions
) {
  void user;
  return repo.list(options);
}

export async function findById(user: AuthUserResult, id: string) {
  void user;
  const prompt = await repo.findById(id);
  if (!prompt) return notFoundError("课程提示词未找到");
  return prompt;
}

export async function create(
  user: AuthUserResult,
  payload: Parameters<typeof repo.create>[0]
) {
  if (!isAdmin(user)) return forbiddenError("仅管理员可访问");
  return repo.create({
    ...payload,
    systemPrompt: payload.systemPrompt ?? "",
    reportStructure: payload.reportStructure ?? "",
    wordLimit: payload.wordLimit ?? "",
    isActive: payload.isActive ?? true,
  });
}

export async function update(
  user: AuthUserResult,
  id: string,
  payload: Parameters<typeof repo.update>[1]
) {
  if (!isAdmin(user)) return forbiddenError("仅管理员可访问");
  const existing = await repo.findById(id);
  if (!existing) return notFoundError("课程提示词未找到");
  return repo.update(id, payload);
}

export async function remove(user: AuthUserResult, id: string) {
  if (!isAdmin(user)) return forbiddenError("仅管理员可访问");
  const existing = await repo.findById(id);
  if (!existing) return notFoundError("课程提示词未找到");
  await repo.remove(id);
  return successResponse(null, "删除成功");
}
