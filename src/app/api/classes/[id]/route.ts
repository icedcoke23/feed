import { NextRequest } from "next/server";
import { validateInput } from "@/lib/validations";
import { z } from "zod";
import { handleDbError } from "@/lib/api-error";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import * as classService from "@/lib/services/class-service";

const updateClassSchema = z.object({
  name: z.string().min(1).optional(),
  grade: z.string().optional(),
  teacherId: z.string().optional(),
  schedule: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

// GET /api/classes/[id] - 获取单个班级详情
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
    const data = await classService.findById(authUser, id);
    if (data instanceof Response) {
      return data;
    }
    return successResponse(data);
  } catch (error) {
    return handleDbError(error, "获取班级");
  }
}

// PUT /api/classes/[id] - 更新班级信息
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权", 401);
  }

  const { id } = await params;
  const body = await request.json();

  const result = validateInput(updateClassSchema, body);
  if ("error" in result) return result.error;
  const validatedData = result.data;

  try {
    const data = await classService.update(authUser, id, validatedData);
    if (data instanceof Response) {
      return data;
    }
    return successResponse(data);
  } catch (error) {
    return handleDbError(error, "更新班级");
  }
}

// DELETE /api/classes/[id] - 软删除班级
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权", 401);
  }

  const { id } = await params;

  try {
    const data = await classService.remove(authUser, id);
    if (data instanceof Response) {
      return data;
    }
    return successResponse(null, "删除成功");
  } catch (error) {
    return handleDbError(error, "删除班级");
  }
}
