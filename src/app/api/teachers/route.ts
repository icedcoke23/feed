import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/storage/database/supabase-client";
import { validateInput } from "@/lib/validations";
import { insertTeacherSchema } from "@/storage/database/shared/schema";
import { hashPassword } from "@/lib/auth";
import { z } from "zod";
import { handleDbError, forbiddenError } from "@/lib/api-error";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse, paginatedResponse } from "@/lib/api-response";
import { parsePagination, getOffset, buildPaginationMeta } from "@/lib/pagination";

// 教师创建需要额外的 username 和 password 字段
const createTeacherSchema = insertTeacherSchema.extend({
  username: z.string().min(1, "请输入用户名"),
  password: z.string().min(1, "请输入密码"),
});

// GET /api/teachers - 获取教师列表（从 teachers 表查询）
export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  const client = getServerSupabaseClient();

  // 分页参数
  const { page, limit } = parsePagination(request);
  const offset = getOffset(page, limit);

  // role 过滤参数
  const role = request.nextUrl.searchParams.get("role");

  try {
    let query = client
      .from("teachers")
      .select("id, name, phone, email, role", { count: "exact" })
      .or("is_active.eq.true,is_active.is.null")
      .order("name", { ascending: true });

    if (role) {
      query = query.eq("role", role);
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) {
      console.error("Teachers query error:", error);
      return handleDbError(error, "获取教师列表");
    }

    return paginatedResponse(data || [], buildPaginationMeta(page, limit, count || 0));
  } catch (error) {
    return handleDbError(error, "获取教师列表");
  }
}

// POST /api/teachers - 创建教师（同时创建到 users 和 teachers 表）
export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  if (authUser.userRole !== "admin") {
    return forbiddenError("仅管理员可访问");
  }

  const client = getServerSupabaseClient();
  const body = await request.json();

  // 校验输入
  const result = validateInput(createTeacherSchema, body);
  if ("error" in result) return result.error;
  const validatedData = result.data;

  try {
    // 检查用户名是否已存在
    const { data: existingUser, error: checkError } = await client
      .from("users")
      .select("id")
      .eq("username", validatedData.username)
      .maybeSingle();

    if (checkError) {
      return handleDbError(checkError, "检查用户名");
    }

    if (existingUser) {
      return errorResponse("用户名已存在", 400);
    }

    // 使用 RPC 原子创建教师（users + teachers 表同时插入）
    const { data: newUserId, error: rpcError } = await client.rpc("create_teacher", {
      p_username: validatedData.username,
      p_password: await hashPassword(validatedData.password),
      p_name: validatedData.name,
      p_phone: validatedData.phone || null,
      p_role: body.role || "teacher",
    });

    if (rpcError) {
      return handleDbError(rpcError, "创建教师");
    }

    // 查询创建的用户数据用于返回
    const { data: userData, error: fetchError } = await client
      .from("users")
      .select("id, username, name, role, phone, is_active, created_at")
      .eq("id", newUserId)
      .single();

    if (fetchError) {
      return handleDbError(fetchError, "获取创建的教师");
    }

    return successResponse(userData);
  } catch (error) {
    return handleDbError(error, "创建教师");
  }
}
