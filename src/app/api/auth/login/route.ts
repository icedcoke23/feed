import { NextRequest, NextResponse } from "next/server";
import {
  COOKIE_NAME,
  signToken,
} from "@/lib/auth";
import { validateInput } from "@/lib/validations";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";
import { sanitizeError } from "@/lib/sensitive-mask";
import { authService } from "@/lib/services";
import { successResponse } from "@/lib/api-response";
import { z } from "zod";

const loginSchema = z.object({
  username: z.string().min(1, "请求参数错误"),
  password: z.string().min(1, "请求参数错误"),
});

// POST /api/auth/login - 用户登录
export async function POST(request: NextRequest) {
  // 登录限流：每 IP 每分钟最多 5 次请求（防爆破）
  const limited = enforceRateLimit(`login:${getClientIp(request)}`, 5, 60_000);
  if (limited) return limited;

  const body = await request.json();

  // 校验输入
  if (!body || typeof body !== "object" || !("username" in body) || !("password" in body)) {
    return NextResponse.json(
      { error: "请求参数错误", code: "VALIDATION_ERROR" },
      { status: 400 }
    );
  }
  const result = validateInput(loginSchema, body);
  if ("error" in result) return result.error;
  const { username, password } = result.data;

  try {
    const loginResult = await authService.login({ username, password });
    // service 返回 Response 表示鉴权失败（已含统一错误格式）
    if (loginResult instanceof Response) {
      return loginResult;
    }

    // 签发 JWT Token
    const token = await signToken({
      userId: loginResult.user.id,
      role: loginResult.user.role as "admin" | "teacher",
    });

    // 统一返回 { data: { user } } 结构，与 auth-context 的 data.user 对齐
    const response = successResponse(
      { user: loginResult.user },
      "登录成功"
    );

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24 小时
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Login error:", sanitizeError(error));
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
