import { NextRequest } from "next/server";
import { validateInput } from "@/lib/validations";
import { z } from "zod";
import { handleDbError } from "@/lib/api-error";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import * as courseStageService from "@/lib/services/course-stage-service";

const updateCourseStageSchema = z.object({
  stageName: z.string().min(1).optional(),
  theme: z.string().min(1).optional(),
  level: z.string().min(1).optional(),
  description: z.string().optional(),
  content: z.string().optional(),
  goal: z.string().optional(),
  sortOrder: z.number().optional(),
  isActive: z.boolean().optional(),
});

// GET /api/course-stages/[id] - 获取单个课程阶段
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
    const data = await courseStageService.findById(authUser, id);
    if (data instanceof Response) {
      return data;
    }

    return successResponse(data);
  } catch (error) {
    return handleDbError(error, "获取课程阶段");
  }
}

// PUT /api/course-stages/[id] - 更新课程阶段
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

  const result = validateInput(updateCourseStageSchema, body);
  if ("error" in result) return result.error;
  const validatedData = result.data;

  try {
    const data = await courseStageService.update(authUser, id, validatedData);
    if (data instanceof Response) {
      return data;
    }

    return successResponse(data);
  } catch (error) {
    return handleDbError(error, "更新课程阶段");
  }
}

// DELETE /api/course-stages/[id]
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
    const result = await courseStageService.remove(authUser, id);
    if (result instanceof Response) {
      return result;
    }

    return successResponse(null, "删除成功");
  } catch (error) {
    return handleDbError(error, "删除课程阶段");
  }
}
