import { NextRequest, NextResponse } from "next/server";
import { validateInput } from "@/lib/validations";
import { insertTeacherSchema } from "@/storage/database/shared/schema";
import { handleDbError, forbiddenError } from "@/lib/api-error";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import * as teacherService from "@/lib/services/teacher-service";

// GET /api/teachers/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  const { id } = await params;

  try {
    const data = await teacherService.findById(authUser, id);
    if (!data) {
      return errorResponse("教师不存在", 404);
    }

    return successResponse(data);
  } catch (error) {
    return handleDbError(error, "获取教师");
  }
}

// PUT /api/teachers/[id] - 更新教师（同时同步到 users 表）
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  const { id } = await params;
  const body = await request.json();

  const result = validateInput(insertTeacherSchema.partial(), body);
  if ("error" in result) return result.error;
  const validatedData = result.data;

  try {
    const data = await teacherService.update(authUser, id, {
      name: validatedData.name,
      email: validatedData.email,
      phone: validatedData.phone,
      role: validatedData.role,
    });

    if (data instanceof NextResponse) {
      return data;
    }

    if (!data) {
      return errorResponse("教师不存在", 404);
    }

    return successResponse(data);
  } catch (error) {
    return handleDbError(error, "更新教师");
  }
}

// DELETE /api/teachers/[id] - 删除教师
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  if (authUser.userRole !== "admin") {
    return forbiddenError("仅管理员可访问");
  }

  const { id } = await params;

  try {
    const result = await teacherService.remove(authUser, id);
    if (result instanceof Response) {
      return result;
    }
    return successResponse(null, "删除成功");
  } catch (error) {
    return handleDbError(error, "删除教师");
  }
}
