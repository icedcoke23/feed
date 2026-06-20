import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/storage/database/supabase-client";
import { validateInput } from "@/lib/validations";
import { insertUserSchema } from "@/storage/database/shared/schema";
import { hashPassword } from "@/lib/auth";
import { z } from "zod";
import { handleDbError, forbiddenError } from "@/lib/api-error";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse } from "@/lib/api-response";

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

  const client = getServerSupabaseClient();

  try {
    const { data, error } = await client
      .from("users")
      .select("id, username, name, role, phone, is_active, created_at")
      .or("is_active.eq.true,is_active.is.null")
      .order("created_at", { ascending: false });

    if (error) {
      return handleDbError(error, "获取用户列表");
    }

    interface UserRow {
      id: string;
      username: string;
      name: string;
      role: string;
      phone?: string;
      is_active?: boolean;
      created_at?: string;
    }

    const users = (data || []) as UserRow[];

    // 为 teacher 角色的用户补充 teacherRole
    const teacherIds = users.filter((u) => u.role === "teacher").map((u) => u.id);
    let teacherRoles: Record<string, string> = {};
    if (teacherIds.length > 0) {
      const { data: teachersData } = await client
        .from("teachers")
        .select("id, role")
        .in("id", teacherIds);
      if (teachersData) {
        teacherRoles = Object.fromEntries(teachersData.map((t: { id: string; role: string }) => [t.id, t.role]));
      }
    }

    const enrichedUsers = users.map((u) => ({
      ...u,
      teacherRole: u.role === "teacher" ? (teacherRoles[u.id] || "teacher") : undefined,
    }));

    return successResponse(enrichedUsers);
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

  const client = getServerSupabaseClient();
  const body = await request.json();

  // 校验输入
  const result = validateInput(createUserSchema, body);
  if ("error" in result) return result.error;
  const validatedData = result.data;

  try {
    // 0. 检查用户名是否已存在
    const { data: existingUser, error: checkError } = await client
      .from("users")
      .select("id, username")
      .eq("username", validatedData.username)
      .maybeSingle();

    if (checkError) {
      return handleDbError(checkError, "检查用户名");
    }

    if (existingUser) {
      return errorResponse(`用户名 "${validatedData.username}" 已存在，请使用其他用户名`, 409);
    }

    // 1. 在 users 表创建用户
    const { data, error } = await client
      .from("users")
      .insert({
        username: validatedData.username,
        password: await hashPassword(validatedData.password),
        name: validatedData.name,
        role: validatedData.role || "teacher",
        phone: validatedData.phone,
        is_active: true,
      })
      .select("id, username, name, role, phone, is_active, created_at")
      .single();

    if (error) {
      return errorResponse(error.message, 500);
    }

    // 2. 如果创建的是教师，自动同步到 teachers 表
    if (data.role === 'teacher') {
      const { error: teacherError } = await client
        .from("teachers")
        .insert({
          id: data.id,
          name: data.name,
          email: data.username ? `${data.username}@school.com` : `${data.name}@school.com`,
          phone: data.phone,
          role: body.teacherRole || "teacher",
          is_active: true,
        });

      if (teacherError) {
        console.error("Sync teacher to teachers table error:", teacherError);
        // 如果同步失败，删除已创建的 user 以保持数据一致
        await client.from("users").delete().eq("id", data.id);
        return handleDbError(teacherError, "同步教师");
      }
    }

    return successResponse(data);
  } catch (error) {
    return handleDbError(error, "创建用户");
  }
}
