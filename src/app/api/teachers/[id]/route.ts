import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/storage/database/supabase-client";
import { validateInput } from "@/lib/validations";
import { insertTeacherSchema } from "@/storage/database/shared/schema";
import { handleDbError, forbiddenError } from "@/lib/api-error";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse } from "@/lib/api-response";

// GET /api/teachers/[id]
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
      .from("teachers")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return handleDbError(error, "获取教师");
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
) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  const client = getServerSupabaseClient();
  const { id } = await params;
  const body = await request.json();

  const result = validateInput(insertTeacherSchema.partial(), body);
  if ("error" in result) return result.error;
  const validatedData = result.data;

  try {
    const { data, error } = await client
      .from("teachers")
      .update({
        name: validatedData.name,
        email: validatedData.email,
        phone: validatedData.phone,
        role: validatedData.role,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return handleDbError(error, "更新教师");
    }

    // 同步更新 users 表
    const { error: userError } = await client
      .from("users")
      .update({
        name: data.name,
        phone: data.phone,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (userError) {
      console.error("Sync update to users table error:", userError);
    }

    return successResponse(data);
  } catch (error) {
    return handleDbError(error, "更新教师");
  }
}

// DELETE /api/teachers/[id] - 删除教师（使用 RPC 原子操作）
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
    const { error } = await client.rpc("delete_teacher", { p_teacher_id: id });

    if (error) {
      return handleDbError(error, "删除教师");
    }

    return successResponse(null, "删除成功");
  } catch (error) {
    return handleDbError(error, "删除教师");
  }
}
