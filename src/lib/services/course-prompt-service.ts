import * as repo from "@/lib/repositories/course-prompt-repository";
import { forbiddenError, notFoundError } from "@/lib/api-error";
import { successResponse } from "@/lib/api-response";
import { isAdmin } from "@/lib/services/auth-utils";
import type { AuthUserResult } from "@/lib/route-auth";
import type { CoursePrompt } from "@/storage/database/shared/schema";

export interface CoursePromptResponse {
  id: string;
  stage_code: string;
  system_prompt: string | null;
  report_structure: string | null;
  word_limit: string | null;
  is_active: boolean;
  created_at: Date | null;
  updated_at: Date | null;
}

function toResponse(prompt: CoursePrompt): CoursePromptResponse {
  return {
    id: prompt.id,
    stage_code: prompt.stageCode,
    system_prompt: prompt.systemPrompt,
    report_structure: prompt.reportStructure,
    word_limit: prompt.wordLimit,
    is_active: prompt.isActive,
    created_at: prompt.createdAt,
    updated_at: prompt.updatedAt,
  };
}

export interface CreateCoursePromptInput {
  stage_code: string;
  system_prompt?: string;
  report_structure?: string;
  word_limit?: string;
  is_active?: boolean;
}

export interface UpdateCoursePromptInput {
  stage_code?: string;
  system_prompt?: string;
  report_structure?: string;
  word_limit?: string;
  is_active?: boolean;
}

export async function list(
  user: AuthUserResult,
  options: repo.ListCoursePromptsOptions
) {
  void user;
  const prompts = await repo.list(options);
  return prompts.map(toResponse);
}

export async function findById(user: AuthUserResult, id: string) {
  void user;
  const prompt = await repo.findById(id);
  if (!prompt) return notFoundError("课程提示词未找到");
  return toResponse(prompt);
}

export async function create(
  user: AuthUserResult,
  payload: CreateCoursePromptInput
) {
  if (!isAdmin(user)) return forbiddenError("仅管理员可访问");
  const prompt = await repo.create({
    stageCode: payload.stage_code,
    systemPrompt: payload.system_prompt ?? "",
    reportStructure: payload.report_structure ?? "",
    wordLimit: payload.word_limit ?? "",
    isActive: payload.is_active ?? true,
  });
  return toResponse(prompt);
}

export async function update(
  user: AuthUserResult,
  id: string,
  payload: UpdateCoursePromptInput
) {
  if (!isAdmin(user)) return forbiddenError("仅管理员可访问");
  const existing = await repo.findById(id);
  if (!existing) return notFoundError("课程提示词未找到");

  const updateData: Partial<Parameters<typeof repo.update>[1]> = {};
  if (payload.stage_code !== undefined) updateData.stageCode = payload.stage_code;
  if (payload.system_prompt !== undefined) updateData.systemPrompt = payload.system_prompt;
  if (payload.report_structure !== undefined) updateData.reportStructure = payload.report_structure;
  if (payload.word_limit !== undefined) updateData.wordLimit = payload.word_limit;
  if (payload.is_active !== undefined) updateData.isActive = payload.is_active;

  const prompt = await repo.update(id, updateData);
  if (!prompt) return notFoundError("课程提示词未找到");
  return toResponse(prompt);
}

export async function remove(user: AuthUserResult, id: string) {
  if (!isAdmin(user)) return forbiddenError("仅管理员可访问");
  const existing = await repo.findById(id);
  if (!existing) return notFoundError("课程提示词未找到");
  await repo.remove(id);
  return successResponse(null, "删除成功");
}
