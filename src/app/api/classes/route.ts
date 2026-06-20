import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/storage/database/supabase-client";
import { validateInput } from "@/lib/validations";
import { z } from "zod";
import { handleDbError, unauthorizedError } from "@/lib/api-error";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse, paginatedResponse } from "@/lib/api-response";
import { parsePagination, getOffset, buildPaginationMeta } from "@/lib/pagination";

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
  const client = getServerSupabaseClient();

  // 从 JWT 验证当前用户信息
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return unauthorizedError("未授权");
  }
  const userId = authUser.userId;
  const userRole = authUser.userRole;

  // 分页参数
  const { page, limit } = parsePagination(request);
  const offset = getOffset(page, limit);

  try {
    // 基础查询，不使用外键关联（避免外键约束问题）
    let query = client
      .from("classes")
      .select("*", { count: "exact" })
      .or("is_active.eq.true,is_active.is.null")
      .order("created_at", { ascending: false });

    // 如果是教师，只显示绑定的班级
    if (userRole === "teacher" && userId) {
      query = query.eq("teacher_id", userId);
    }

    // 应用分页
    query = query.range(offset, offset + limit - 1);

    const { data: classesData, error: classesError, count } = await query;

    if (classesError) {
      console.error("[Classes GET] Query error:", classesError);
      return handleDbError(classesError, "获取班级列表");
    }

    // 如果没有班级，直接返回
    if (!classesData || classesData.length === 0) {
      return paginatedResponse([], buildPaginationMeta(page, limit, 0));
    }

    // 获取所有相关的教师ID
    const teacherIds = classesData
      .map((c: { teacher_id?: string }) => c.teacher_id)
      .filter(Boolean);

    // 如果有教师ID，从teachers表获取教师信息
    const teachersMap: Record<string, { id: string; name: string; phone?: string }> = {};
    if (teacherIds.length > 0) {
      const { data: teachersData, error: teachersError } = await client
        .from("teachers")
        .select("id, name, phone")
        .in("id", teacherIds)
        .or("is_active.eq.true,is_active.is.null");

      if (teachersError) {
        console.error("[Classes GET] Teachers query error:", teachersError);
      } else if (teachersData) {
        teachersData.forEach((t: { id: string; name: string; phone?: string }) => {
          teachersMap[t.id] = t;
        });
      }
    }

    // 合并数据
    const data = classesData.map((c: { teacher_id?: string; [key: string]: unknown }) => ({
      ...c,
      teacher: c.teacher_id ? teachersMap[c.teacher_id] || null : null,
    }));

    return paginatedResponse(data, buildPaginationMeta(page, limit, count || 0));
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

  const client = getServerSupabaseClient();
  const body = await request.json();

  // 校验输入
  const result = validateInput(createClassSchema, body);
  if ("error" in result) return result.error;
  const validatedData = result.data;

  try {
    // 验证老师是否存在
    const { data: teacherData, error: teacherError } = await client
      .from("teachers")
      .select("id, name")
      .eq("id", validatedData.teacherId)
      .single();

    if (teacherError || !teacherData) {
      console.error("[Classes POST] Teacher not found:", validatedData.teacherId, teacherError);
      return errorResponse("选择的老师不存在", 400);
    }

    const insertData = {
      name: validatedData.name,
      grade: validatedData.grade || "",
      teacher_id: validatedData.teacherId,
      schedule: validatedData.schedule || "",
      description: validatedData.description || "",
      is_active: true,
    };

    const { data, error } = await client
      .from("classes")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error("[Classes POST] Insert error:", error);
      return handleDbError(error, "创建班级");
    }

    return successResponse(data);
  } catch (error) {
    return handleDbError(error, "创建班级");
  }
}
