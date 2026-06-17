import { NextRequest } from "next/server";
import { getServerSupabaseClient } from "@/storage/database/supabase-client";
import { getAuthUser } from "@/lib/route-auth";
import { comparePassword, hashPassword } from "@/lib/auth";
import { validateInput } from "@/lib/validations";
import { successResponse, errorResponse } from "@/lib/api-response";
import { z } from "zod";

const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, "请输入旧密码"),
  newPassword: z.string().min(6, "新密码至少6个字符"),
});

// POST /api/auth/change-password - 修改密码
export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  const body = await request.json();
  const result = validateInput(changePasswordSchema, body);
  if ("error" in result) return result.error;
  const { oldPassword, newPassword } = result.data;

  const client = getServerSupabaseClient();

  try {
    // 查询用户当前的密码哈希
    const { data: user, error } = await client
      .from("users")
      .select("id, password")
      .eq("id", authUser.userId)
      .single();

    if (error || !user) {
      return errorResponse("用户不存在", 404);
    }

    // 验证旧密码
    const isPasswordValid = await comparePassword(oldPassword, user.password);
    if (!isPasswordValid) {
      return errorResponse("旧密码错误", 400);
    }

    // 加密新密码
    const newPasswordHash = await hashPassword(newPassword);

    // 更新密码
    const { error: updateError } = await client
      .from("users")
      .update({ password: newPasswordHash })
      .eq("id", authUser.userId);

    if (updateError) {
      return errorResponse("密码更新失败", 500);
    }

    return successResponse(null, "密码修改成功");
  } catch (error) {
    console.error("Change password error:", error);
    return errorResponse("密码修改失败", 500);
  }
}
