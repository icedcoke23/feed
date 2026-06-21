import { NextRequest } from "next/server";
import { validateInput } from "@/lib/validations";
import { z } from "zod";
import { handleDbError } from "@/lib/api-error";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import * as courseStageService from "@/lib/services/course-stage-service";

// 课程阶段创建 schema
const createCourseStageSchema = z.object({
  stageCode: z.string().min(1, "请输入阶段编码"),
  stageName: z.string().min(1, "请输入阶段名称"),
  theme: z.string().min(1, "请输入主题"),
  level: z.string().min(1, "请输入级别"),
  description: z.string().optional(),
  content: z.string().optional(),
  goal: z.string().optional(),
  sortOrder: z.number().optional(),
});

// GET /api/course-stages - 获取课程阶段预设列表
export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  const { searchParams } = new URL(request.url);
  const theme = searchParams.get("theme") || undefined;
  const level = searchParams.get("level") || undefined;

  try {
    const result = await courseStageService.list(authUser, { theme, level });
    if (result instanceof Response) {
      return result;
    }

    return successResponse(result);
  } catch (error) {
    return handleDbError(error, "获取课程阶段列表");
  }
}

// POST /api/course-stages - 创建课程阶段预设
export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  const body = await request.json();

  // 校验输入
  const result = validateInput(createCourseStageSchema, body);
  if ("error" in result) return result.error;
  const validatedData = result.data;

  try {
    const data = await courseStageService.create(authUser, {
      ...validatedData,
      isActive: true,
    });
    if (data instanceof Response) {
      return data;
    }

    return successResponse(data);
  } catch (error) {
    return handleDbError(error, "创建课程阶段");
  }
}
