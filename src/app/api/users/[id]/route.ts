import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/storage/database/supabase-client";
import { hashPassword } from "@/lib/auth";
import { validateInput } from "@/lib/validations";
import { z } from "zod";
import { handleDbError, forbiddenError } from "@/lib/api-error";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse } from "@/lib/api-response";

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

  const client = getServerSupabaseClient();
  const { id } = await params;

  try {
    const { data, error } = await client
      .from("users")
      .select("id, username, name, role, phone, is_active, created_at")
      .eq("id", id)
      .single();

    if (error) {
      return errorResponse(error.message, 500);
    }

    if (!data) {
      return errorResponse("Not found", 404);
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

  const client = getServerSupabaseClient();
  const { id } = await params;
  const body = await request.json();

  const result = validateInput(updateUserSchema, body);
  if ("error" in result) return result.error;
  const validatedData = result.data;

  try {
    const updateData: Record<string, unknown> = {
      name: validatedData.name,
      role: validatedData.role,
      phone: validatedData.phone,
      updated_at: new Date().toISOString(),
    };

    // 只有当提供了密码时才更新密码
    if (validatedData.password) {
      updateData.password = await hashPassword(validatedData.password);
    }

    const { data, error } = await client
      .from("users")
      .update(updateData)
      .eq("id", id)
      .select("id, username, name, role, phone, is_active, created_at")
      .single();

    if (error) {
      return handleDbError(error, "更新用户");
    }

    // 同步更新 teachers 表（如果是教师）
    if (data.role === 'teacher') {
      const teacherUpdate: Record<string, unknown> = {
        name: data.name,
        phone: data.phone,
        updated_at: new Date().toISOString(),
      };

      // 如果传入了 teacherRole，更新 teachers 表的 role 字段
      if (body.teacherRole) {
        teacherUpdate.role = body.teacherRole;
      }

      const { error: teacherError } = await client
        .from("teachers")
        .update(teacherUpdate)
        .eq("id", id);

      if (teacherError) {
        console.error("Sync update to teachers table error:", teacherError);
      }
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

  const client = getServerSupabaseClient();
  const { id } = await params;

  try {
    // 防止删除最后一个管理员
    const { data: adminCount } = await client
      .from("users")
      .select("id", { count: "exact" })
      .eq("role", "admin")
      .eq("is_active", true);

    const { data: targetUser } = await client
      .from("users")
      .select("role")
      .eq("id", id)
      .single();

    if (targetUser?.role === "admin" && (adminCount?.length || 0) <= 1) {
      return errorResponse("不能删除最后一个管理员", 400);
    }

    const { error } = await client
      .from("users")
      .update({ is_active: false })
      .eq("id", id);

    if (error) {
      return handleDbError(error, "删除用户");
    }

    // 同步禁用 teachers 表记录
    await client
      .from("teachers")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id);

    return successResponse(null, "删除成功");
  } catch (error) {
    return handleDbError(error, "删除用户");
  }
}
