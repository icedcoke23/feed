import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/route-auth";
import { validateInput } from "@/lib/validations";
import { handleDbError } from "@/lib/api-error";
import { successResponse, errorResponse } from "@/lib/api-response";
import { z } from "zod";
import * as authService from "@/lib/services/auth-service";

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

  try {
    const res = await authService.changePassword(authUser.userId, {
      oldPassword,
      newPassword,
    });
    if (res instanceof NextResponse) {
      return res;
    }
    return successResponse(null, "密码修改成功");
  } catch (error) {
    return handleDbError(error, "修改密码");
  }
}
