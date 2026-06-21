import { NextRequest } from "next/server";
import { validateInput } from "@/lib/validations";
import { z } from "zod";
import { handleDbError } from "@/lib/api-error";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import * as coursePromptService from "@/lib/services/course-prompt-service";

const updateCoursePromptSchema = z.object({
  stage_code: z.string().min(1).optional(),
  system_prompt: z.string().optional(),
  report_structure: z.string().optional(),
  word_limit: z.string().optional(),
  is_active: z.boolean().optional(),
});

// GET /api/course-prompts/[id] - 获取单个课程提示词（已登录用户可访问，返回完整字段）
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  const { id } = await params;

  try {
    const data = await coursePromptService.findById(authUser, id);
    if (data instanceof Response) {
      return data;
    }

    return successResponse(data);
  } catch (error) {
    return handleDbError(error, "获取课程提示词");
  }
}

// PUT /api/course-prompts/[id] - 更新课程提示词（仅 admin）
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  const { id } = await params;
  const body = await request.json();

  const result = validateInput(updateCoursePromptSchema, body);
  if ("error" in result) return result.error;

  try {
    const data = await coursePromptService.update(authUser, id, result.data);
    if (data instanceof Response) {
      return data;
    }

    return successResponse(data);
  } catch (error) {
    return handleDbError(error, "更新课程提示词");
  }
}

// DELETE /api/course-prompts/[id] - 软删除（仅 admin）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  const { id } = await params;

  try {
    const result = await coursePromptService.remove(authUser, id);
    if (result instanceof Response) {
      return result;
    }

    return successResponse(null, "删除成功");
  } catch (error) {
    return handleDbError(error, "删除课程提示词");
  }
}
