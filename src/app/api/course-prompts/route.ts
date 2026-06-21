import { NextRequest } from "next/server";
import { validateInput } from "@/lib/validations";
import { z } from "zod";
import { handleDbError } from "@/lib/api-error";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import * as coursePromptService from "@/lib/services/course-prompt-service";

// 课程提示词创建 schema（字段名与前端一致）
const createCoursePromptSchema = z.object({
  stage_code: z.string().min(1, "请输入阶段编码"),
  system_prompt: z.string().optional(),
  report_structure: z.string().optional(),
  word_limit: z.string().optional(),
  is_active: z.boolean().optional(),
});

// GET /api/course-prompts - 获取启用的课程提示词列表（已登录用户可访问）
export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  const { searchParams } = new URL(request.url);
  const isFull = searchParams.get("full") === "true";

  try {
    const data = await coursePromptService.list(authUser, { full: isFull });
    return successResponse(data);
  } catch (error) {
    return handleDbError(error, "获取课程提示词");
  }
}

// POST /api/course-prompts - 创建课程提示词（仅 admin）
export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  const body = await request.json();

  // 校验输入
  const result = validateInput(createCoursePromptSchema, body);
  if ("error" in result) return result.error;

  try {
    const data = await coursePromptService.create(authUser, result.data);
    if (data instanceof Response) {
      return data;
    }

    return successResponse(data);
  } catch (error) {
    return handleDbError(error, "创建课程提示词");
  }
}
