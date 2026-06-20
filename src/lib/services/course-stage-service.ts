import * as repo from "@/lib/repositories/course-stage-repository";
import { forbiddenError, notFoundError } from "@/lib/api-error";
import { successResponse } from "@/lib/api-response";
import { DEFAULT_COURSE_STAGES } from "@/lib/constants/course-stages";
import type { AuthUserResult } from "@/lib/route-auth";
import type { CourseStage as CourseStageRow } from "@/storage/database/shared/schema";
import type { CourseStage } from "@/types/settings";

function isAdmin(user: AuthUserResult) {
  return user.userRole === "admin";
}

function toResponse(stage: CourseStageRow): CourseStage {
  return {
    id: stage.id,
    stage_code: stage.stageCode,
    stage_name: stage.stageName,
    theme: stage.theme,
    level: stage.level,
    description: stage.description ?? "",
    content: stage.content ?? "",
    goal: stage.goal ?? "",
    sort_order: stage.sortOrder ?? 0,
    is_active: stage.isActive,
  };
}

function filterDefaults(options: { theme?: string; level?: string }): CourseStage[] {
  let stages = DEFAULT_COURSE_STAGES as CourseStage[];

  if (options.theme) {
    stages = stages.filter((s) => s.theme === options.theme);
  }
  if (options.level) {
    stages = stages.filter((s) => s.level === options.level);
  }

  return stages;
}

export async function list(
  user: AuthUserResult,
  options: { theme?: string; level?: string }
): Promise<CourseStage[] | Response> {
  void user;

  try {
    const stages = await repo.list(options);
    if (stages.length > 0) {
      return stages.map(toResponse);
    }
  } catch (error) {
    console.error("[courseStageService.list] fallback after error:", error);
  }

  return filterDefaults(options);
}

export async function findById(
  user: AuthUserResult,
  id: string
): Promise<CourseStage | Response> {
  void user;

  const stage = await repo.findById(id);
  if (!stage) return notFoundError("课程阶段不存在");
  return toResponse(stage);
}

export async function create(
  user: AuthUserResult,
  payload: Parameters<typeof repo.create>[0]
): Promise<CourseStage | Response> {
  if (!isAdmin(user)) {
    return forbiddenError("仅管理员可访问");
  }

  const stage = await repo.create({ ...payload, isActive: payload.isActive ?? true });
  return toResponse(stage);
}

export async function update(
  user: AuthUserResult,
  id: string,
  payload: Parameters<typeof repo.update>[1]
): Promise<CourseStage | Response> {
  if (!isAdmin(user)) {
    return forbiddenError("仅管理员可访问");
  }

  const existing = await repo.findById(id);
  if (!existing) return notFoundError("课程阶段不存在");

  const stage = await repo.update(id, payload);
  if (!stage) return notFoundError("课程阶段不存在");
  return toResponse(stage);
}

export async function remove(user: AuthUserResult, id: string): Promise<Response> {
  if (!isAdmin(user)) {
    return forbiddenError("仅管理员可访问");
  }

  const existing = await repo.findById(id);
  if (!existing) return notFoundError("课程阶段不存在");

  await repo.remove(id);
  return successResponse(null, "删除成功");
}
