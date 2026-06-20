import { NextRequest, NextResponse } from "next/server";
import { db } from "@/storage/database/drizzle-client";
import { users, teachers } from "@/storage/database/shared/schema";
import { eq, and } from "drizzle-orm";
import {
  signToken,
  comparePassword,
  isBcryptHash,
  COOKIE_NAME,
} from "@/lib/auth";
import { validateInput } from "@/lib/validations";
import { checkRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const loginSchema = z.object({
  username: z.string().min(1, "请求参数错误"),
  password: z.string().min(1, "请求参数错误"),
});

// POST /api/auth/login - 用户登录
export async function POST(request: NextRequest) {
  // 登录限流：每 IP 每分钟最多 5 次请求
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const { allowed, retryAfterMs } = checkRateLimit(`login:${ip}`, 5, 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: "请求过于频繁，请稍后再试", code: "RATE_LIMITED", retryAfter: retryAfterMs / 1000 },
      { status: 429 }
    );
  }

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
    // 通过 username 查找用户（不再用密码匹配查询）
    const rows = await db
      .select()
      .from(users)
      .where(and(eq(users.username, username), eq(users.isActive, true)))
      .limit(1);
    const user = rows[0];

    if (!user) {
      return NextResponse.json(
        { error: "用户名或密码错误", code: "INVALID_CREDENTIALS" },
        { status: 401 }
      );
    }

    // 密码不是 bcrypt 哈希格式，拒绝登录
    if (!isBcryptHash(user.password)) {
      return NextResponse.json(
        { error: "密码格式已过期，请联系管理员重置密码", code: "PASSWORD_FORMAT_EXPIRED" },
        { status: 401 }
      );
    }

    // 验证密码
    const isPasswordValid = await comparePassword(password, user.password);

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "用户名或密码错误", code: "INVALID_CREDENTIALS" },
        { status: 401 }
      );
    }

    // 签发 JWT Token
    const token = await signToken({
      userId: user.id,
      role: user.role as "admin" | "teacher",
    });

    // 构造不含密码的用户信息
    const userInfo: Record<string, unknown> = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      phone: user.phone,
    };

    // 如果是 teacher 角色，关联查询 teachers 表获取 role
    if (user.role === "teacher") {
      const teacherRows = await db
        .select({ role: teachers.role })
        .from(teachers)
        .where(eq(teachers.id, user.id))
        .limit(1);
      if (teacherRows[0]) {
        userInfo.teacherRole = teacherRows[0].role;
      }
    }

    // 将 Token 设置到 httpOnly Cookie 中
    const response = NextResponse.json({
      data: userInfo,
      message: "登录成功",
    });

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24 小时
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
