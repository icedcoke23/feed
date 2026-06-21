import { NextRequest } from "next/server";
import { validateInput } from "@/lib/validations";
import { z } from "zod";
import { handleDbError } from "@/lib/api-error";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse, paginatedResponse } from "@/lib/api-response";
import { parsePagination } from "@/lib/pagination";
import * as classService from "@/lib/services/class-service";
import * as teacherService from "@/lib/services/teacher-service";

// 班级创建 schema
const createClassSchema = z.object({
  name: z.string().min(1, "请输入班级名称"),
  grade: z.string().optional(),
  teacherId: z.string().min(1, "必须选择授课老师"),
  schedule: z.string().optional(),
  description: z.string().optional(),
});

// GET /api/classes - 获取班级列表
export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  const { searchParams } = new URL(request.url);
  const { page, limit } = parsePagination(request);

  try {
    const result = await classService.list(authUser, {
      page,
      limit,
      search: searchParams.get("search") || undefined,
    });

    return paginatedResponse(result.data, result.pagination);
  } catch (error) {
    return handleDbError(error, "获取班级列表");
  }
}

// POST /api/classes - 创建班级
export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  const body = await request.json();

  // 校验输入
  const result = validateInput(createClassSchema, body);
  if ("error" in result) return result.error;
  const validatedData = result.data;

  try {
    // 验证老师是否存在
    const teacher = await teacherService.findById(authUser, validatedData.teacherId);
    if (!teacher) {
      return errorResponse("选择的老师不存在", 400);
    }

    const data = await classService.create(authUser, validatedData);
    return successResponse(data);
  } catch (error) {
    return handleDbError(error, "创建班级");
  }
}
