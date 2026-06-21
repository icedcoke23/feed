import { NextRequest, NextResponse } from "next/server";
import { validateInput } from "@/lib/validations";
import { insertTeacherSchema } from "@/storage/database/shared/schema";
import { z } from "zod";
import { handleDbError, forbiddenError } from "@/lib/api-error";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse, paginatedResponse } from "@/lib/api-response";
import { parsePagination } from "@/lib/pagination";
import * as teacherService from "@/lib/services/teacher-service";
import * as userService from "@/lib/services/user-service";

// 教师创建需要额外的 username 和 password 字段
const createTeacherSchema = insertTeacherSchema.extend({
  username: z.string().min(1, "请输入用户名"),
  password: z.string().min(1, "请输入密码"),
});

// GET /api/teachers - 获取教师列表（从 teachers 表查询）
export async function GET(request: NextRequest): Promise<NextResponse> {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  const { page, limit } = parsePagination(request);
  const role = request.nextUrl.searchParams.get("role") || undefined;

  try {
    const result = await teacherService.list(authUser, { page, limit, role });
    if (result instanceof NextResponse) {
      return result;
    }

    return paginatedResponse(result.data, result.pagination);
  } catch (error) {
    return handleDbError(error, "获取教师列表");
  }
}

// POST /api/teachers - 创建教师（同时创建到 users 和 teachers 表）
export async function POST(request: NextRequest): Promise<NextResponse> {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  if (authUser.userRole !== "admin") {
    return forbiddenError("仅管理员可访问");
  }

  const body = await request.json();

  // 校验输入
  const result = validateInput(createTeacherSchema, body);
  if ("error" in result) return result.error;
  const validatedData = result.data;

  try {
    // 检查用户名是否已存在
    const existingUser = await userService.findByUsername(validatedData.username);
    if (existingUser) {
      return errorResponse("用户名已存在", 400);
    }

    const data = await userService.create(authUser, {
      username: validatedData.username,
      password: validatedData.password,
      name: validatedData.name,
      phone: validatedData.phone ?? undefined,
      role: (body.role as "admin" | "teacher") || "teacher",
      teacherRole: (body.role as "admin" | "teacher") || "teacher",
    });

    if (data instanceof NextResponse) {
      return data;
    }

    return successResponse(data);
  } catch (error) {
    return handleDbError(error, "创建教师");
  }
}
