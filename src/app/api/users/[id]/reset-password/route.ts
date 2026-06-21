import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/route-auth";
import { validateInput } from "@/lib/validations";
import { handleDbError, forbiddenError } from "@/lib/api-error";
import { successResponse, errorResponse } from "@/lib/api-response";
import { z } from "zod";
import * as userService from "@/lib/services/user-service";

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
    return forbiddenError("权限不足，仅管理员可重置密码");
  }

  const { id: targetUserId } = await params;

  const body = await request.json();
  const result = validateInput(resetPasswordSchema, body);
  if ("error" in result) return result.error;
  const { newPassword } = result.data;

  try {
    const res = await userService.resetPassword(authUser, targetUserId, {
      newPassword,
    });
    if (res instanceof NextResponse) {
      return res;
    }
    return successResponse(null, "密码重置成功");
  } catch (error) {
    return handleDbError(error, "重置密码");
  }
}
