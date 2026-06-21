import { NextRequest, NextResponse } from "next/server";
import { validateInput } from "@/lib/validations";
import { z } from "zod";
import { handleDbError, forbiddenError } from "@/lib/api-error";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import * as userService from "@/lib/services/user-service";

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  role: z.enum(["admin", "teacher"]).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(6, "密码至少6个字符").optional(),
});

// GET /api/users/[id] - 获取单个用户（仅管理员）
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  if (authUser.userRole !== "admin") {
    return forbiddenError("仅管理员可访问");
  }

  const { id } = await params;

  try {
    const data = await userService.findById(authUser, id);
    if (data instanceof NextResponse) {
      return data;
    }
    return successResponse(data);
  } catch (error) {
    return handleDbError(error, "获取用户");
  }
}

// PUT /api/users/[id] - 更新用户（仅管理员）
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  if (authUser.userRole !== "admin") {
    return forbiddenError("仅管理员可访问");
  }

  const { id } = await params;
  const body = await request.json();

  const result = validateInput(updateUserSchema, body);
  if ("error" in result) return result.error;
  const validatedData = result.data;

  try {
    const data = await userService.update(authUser, id, {
      name: validatedData.name,
      phone: validatedData.phone,
      role: validatedData.role,
      isActive: validatedData.isActive,
      password: validatedData.password,
      teacherRole: body.teacherRole,
    });
    if (data instanceof NextResponse) {
      return data;
    }
    return successResponse(data);
  } catch (error) {
    return handleDbError(error, "更新用户");
  }
}

// DELETE /api/users/[id] - 删除用户（软删除，仅管理员）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  if (authUser.userRole !== "admin") {
    return forbiddenError("仅管理员可访问");
  }

  const { id } = await params;

  try {
    const result = await userService.remove(authUser, id);
    if (result instanceof NextResponse) {
      return result;
    }
    return successResponse(null, "删除成功");
  } catch (error) {
    return handleDbError(error, "删除用户");
  }
}
