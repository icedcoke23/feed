import { NextRequest, NextResponse } from "next/server";
import { validateInput } from "@/lib/validations";
import { insertUserSchema } from "@/storage/database/shared/schema";
import { z } from "zod";
import { handleDbError, forbiddenError } from "@/lib/api-error";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse, paginatedResponse } from "@/lib/api-response";
import { parsePagination } from "@/lib/pagination";
import * as userService from "@/lib/services/user-service";
import * as userRepo from "@/lib/repositories/user-repository";

// 用户创建 schema：在 insertUserSchema 基础上增加 password
const createUserSchema = insertUserSchema.extend({
  password: z.string().min(1, "请输入密码"),
});

// GET /api/users - 获取用户列表（仅管理员）
export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  if (authUser.userRole !== "admin") {
    return forbiddenError("仅管理员可访问");
  }

  const { page, limit } = parsePagination(request);
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || undefined;

  try {
    const result = await userService.list(authUser, {
      page,
      limit,
      search,
      isActive: true,
    });
    if (result instanceof NextResponse) {
      return result;
    }
    return paginatedResponse(result.data, result.pagination);
  } catch (error) {
    return handleDbError(error, "获取用户列表");
  }
}

// POST /api/users - 创建用户（仅管理员）
export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  if (authUser.userRole !== "admin") {
    return forbiddenError("仅管理员可访问");
  }

  const body = await request.json();

  // 校验输入
  const result = validateInput(createUserSchema, body);
  if ("error" in result) return result.error;
  const validatedData = result.data;

  try {
    // 检查用户名是否已存在
    const existingUser = await userRepo.findByUsername(validatedData.username);
    if (existingUser) {
      return errorResponse(
        `用户名 "${validatedData.username}" 已存在，请使用其他用户名`,
        409
      );
    }

    const data = await userService.create(authUser, {
      username: validatedData.username,
      name: validatedData.name,
      role: validatedData.role as "admin" | "teacher" | undefined,
      phone: validatedData.phone ?? undefined,
      password: validatedData.password,
      teacherRole: body.teacherRole,
    });
    if (data instanceof NextResponse) {
      return data;
    }
    return successResponse(data);
  } catch (error) {
    return handleDbError(error, "创建用户");
  }
}
