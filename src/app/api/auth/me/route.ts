import { NextRequest } from "next/server";
import { getAuthUser, attachRenewedToken } from "@/lib/route-auth";
import { authService } from "@/lib/services";
import { successResponse } from "@/lib/api-response";
import { apiError } from "@/lib/api-error";

export async function GET(request: NextRequest) {
  const authResult = await getAuthUser(request);

  if (!authResult) {
    return apiError("未登录或登录已过期", 401, "UNAUTHORIZED");
  }

  const user = await authService.getCurrentUser(authResult.userId);
  // service 返回 Response 表示未找到（已含统一错误格式）
  if (user instanceof Response) {
    return user;
  }

  // 统一返回 { data: { user } } 结构，与 auth-context 的 data.user 对齐
  const response = successResponse({ user });
  return attachRenewedToken(response, authResult);
}
