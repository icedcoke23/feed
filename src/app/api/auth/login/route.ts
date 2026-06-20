import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/storage/database/supabase-client";
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
  username: z.string().min(1, "请输入用户名"),
  password: z.string().min(1, "请输入密码"),
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
      { error: "请求过于频繁，请稍后再试", retryAfter: retryAfterMs / 1000 },
      { status: 429 }
    );
  }

  const client = getServerSupabaseClient();
  const body = await request.json();

  // 校验输入
  const result = validateInput(loginSchema, body);
  if ("error" in result) return result.error;
  const { username, password } = result.data;

  try {
    // 通过 username 查找用户（不再用密码匹配查询）
    const { data, error } = await client
      .from("users")
      .select("id, username, name, role, phone, password, is_active")
      .eq("username", username)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "用户名或密码错误" },
        { status: 401 }
      );
    }

    // 检查用户是否被禁用（兼容 is_active 为 null 的情况，null 视为启用）
    if (data.is_active === false) {
      return NextResponse.json(
        { error: "账户已被禁用" },
        { status: 401 }
      );
    }

    // 密码不是 bcrypt 哈希格式，拒绝登录
    if (!isBcryptHash(data.password)) {
      return NextResponse.json(
        { error: "密码格式已过期，请联系管理员重置密码" },
        { status: 401 }
      );
    }

    // 验证密码
    const isPasswordValid = await comparePassword(password, data.password);

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "用户名或密码错误" },
        { status: 401 }
      );
    }

    // 签发 JWT Token
    const token = await signToken({
      userId: data.id,
      role: data.role,
    });

    // 构造不含密码的用户信息
    const userInfo: Record<string, unknown> = {
      id: data.id,
      username: data.username,
      name: data.name,
      role: data.role,
      phone: data.phone,
    };

    // 如果是 teacher 角色，关联查询 teachers 表获取 role
    if (data.role === "teacher") {
      const { data: teacherData } = await client
        .from("teachers")
        .select("role")
        .eq("id", data.id)
        .single();
      if (teacherData) {
        userInfo.teacherRole = teacherData.role;
      }
    }

    // 将 Token 设置到 httpOnly Cookie 中
    const response = NextResponse.json({
      user: userInfo,
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
