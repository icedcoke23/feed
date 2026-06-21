import { NextRequest } from "next/server";
import { validateInput } from "@/lib/validations";
import { insertStudentSchema } from "@/storage/database/shared/schema";
import { handleDbError } from "@/lib/api-error";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import * as studentService from "@/lib/services/student-service";

// GET /api/students/[id] - 获取单个学生详情（含历史反馈）
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
    const data = await studentService.findById(authUser, id);
    if ("error" in data) {
      return data;
    }
    return successResponse(data);
  } catch (error) {
    return handleDbError(error, "获取学生");
  }
}

// PUT /api/students/[id] - 更新学生信息
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

  const result = validateInput(insertStudentSchema.partial(), body);
  if ("error" in result) return result.error;
  const validatedData = result.data;

  try {
    const data = await studentService.update(authUser, id, validatedData);
    if ("error" in data) {
      return data;
    }
    return successResponse(data);
  } catch (error) {
    return handleDbError(error, "更新学生");
  }
}

// DELETE /api/students/[id] - 软删除学生
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
    const result = await studentService.remove(authUser, id);
    if ("error" in result) {
      return result;
    }
    return successResponse(null, "删除成功");
  } catch (error) {
    return handleDbError(error, "删除学生");
  }
}
