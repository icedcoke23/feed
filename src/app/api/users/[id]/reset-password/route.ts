import { NextRequest } from "next/server";
import { getServerSupabaseClient } from "@/storage/database/supabase-client";
import { getAuthUser } from "@/lib/route-auth";
import { hashPassword } from "@/lib/auth";
import { validateInput } from "@/lib/validations";
import { successResponse, errorResponse } from "@/lib/api-response";
import { z } from "zod";

const resetPasswordSchema = z.object({
  newPassword: z.string().min(6, "新密码至少6个字符"),
});

// POST /api/users/[id]/reset-password - 管理员重置用户密码
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  // 验证当前用户是管理员
  if (authUser.userRole !== "admin") {
    return errorResponse("权限不足，仅管理员可重置密码", 403);
  }

  const { id: targetUserId } = await params;

  const body = await request.json();
  const result = validateInput(resetPasswordSchema, body);
  if ("error" in result) return result.error;
  const { newPassword } = result.data;

  const client = getServerSupabaseClient();

  try {
    // 检查目标用户是否存在
    const { data: targetUser, error: findError } = await client
      .from("users")
      .select("id")
      .eq("id", targetUserId)
      .single();

    if (findError || !targetUser) {
      return errorResponse("用户不存在", 404);
    }

    // 加密新密码
    const newPasswordHash = await hashPassword(newPassword);

    // 更新密码
    const { error: updateError } = await client
      .from("users")
      .update({ password: newPasswordHash })
      .eq("id", targetUserId);

    if (updateError) {
      return errorResponse("密码重置失败", 500);
    }

    return successResponse(null, "密码重置成功");
  } catch (error) {
    console.error("Reset password error:", error);
    return errorResponse("密码重置失败", 500);
  }
}
