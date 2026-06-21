import { NextRequest } from "next/server";
import { validateInput } from "@/lib/validations";
import { insertStudentSchema } from "@/storage/database/shared/schema";
import { handleDbError } from "@/lib/api-error";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse, paginatedResponse } from "@/lib/api-response";
import { parsePagination, buildPaginationMeta } from "@/lib/pagination";
import { withLogging } from "@/lib/api-logger";
import * as studentService from "@/lib/services/student-service";

// GET /api/students - 获取学生列表
export const GET = withLogging(async (request: NextRequest) => {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  const { searchParams } = new URL(request.url);
  const { page, limit } = parsePagination(request);

  try {
    const result = await studentService.list(authUser, {
      page,
      limit,
      teacherId: searchParams.get("teacherId") || undefined,
      classId: searchParams.get("classId") || undefined,
      search: searchParams.get("search") || undefined,
    });

    if ("error" in result) {
      return result;
    }

    return paginatedResponse(result.data, result.pagination);
  } catch (error) {
    return handleDbError(error, "获取学生列表");
  }
});

// POST /api/students - 创建学生
export const POST = withLogging(async (request: NextRequest) => {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  const body = await request.json();

  // 校验输入
  const result = validateInput(insertStudentSchema, body);
  if ("error" in result) return result.error;
  const validatedData = result.data;

  try {
    const data = await studentService.create(authUser, validatedData);
    if ("error" in data) {
      return data;
    }
    return successResponse(data);
  } catch (error) {
    return handleDbError(error, "创建学生");
  }
});
