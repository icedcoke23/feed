import { NextRequest, NextResponse } from "next/server";
import { verifyToken, signToken, COOKIE_NAME } from "@/lib/auth";
import { getServerSupabaseClient } from "@/storage/database/supabase-client";
import { jwtVerify } from "jose";

export interface AuthUserResult {
  userId: string;
  userRole: string;
  teacherRole?: "admin" | "teacher"; // teachers 表中的角色
  newToken?: string;
}

export async function getAuthUser(request: NextRequest): Promise<AuthUserResult | null> {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;

  // Token 续签：检查剩余有效期，不足 50% 则签发新 Token
  let newToken: string | undefined;
  try {
    const secretKey = new TextEncoder().encode(process.env.JWT_SECRET || "dev-only-jwt-secret-change-in-production");
    const { payload: decoded } = await jwtVerify(token, secretKey);
    const exp = decoded.exp;
    const iat = decoded.iat;
    if (exp && iat) {
      const now = Math.floor(Date.now() / 1000);
      const totalLifetime = exp - iat;
      const remaining = exp - now;
      // 剩余有效期不足 50%，签发新 Token
      if (remaining < totalLifetime * 0.5) {
        newToken = await signToken({ userId: payload.userId, role: payload.role });
      }
    }
  } catch {
    // 解码失败不影响正常鉴权流程
  }

  // 如果是 teacher 角色，查询 teachers 表获取 role
  let teacherRole: "admin" | "teacher" | undefined;
  if (payload.role === "teacher") {
    const client = getServerSupabaseClient();
    const { data: teacherData } = await client
      .from("teachers")
      .select("role")
      .eq("id", payload.userId)
      .single();
    teacherRole = (teacherData?.role as "admin" | "teacher") || "teacher";
  }

  return { userId: payload.userId, userRole: payload.role, teacherRole, newToken };
}

/**
 * 将续签的新 Token 附加到响应头和 Cookie
 * 在 API 路由中调用，将 getAuthUser 返回的 newToken 设置到响应
 */
export function attachRenewedToken(
  response: NextResponse,
  authResult: AuthUserResult
): NextResponse {
  if (authResult.newToken) {
    response.headers.set("X-New-Token", authResult.newToken);
    // 同时更新 Cookie，确保浏览器端也同步
    response.cookies.set(COOKIE_NAME, authResult.newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
      path: "/",
    });
  }
  return response;
}

/**
 * 获取教师所负责的所有班级 ID
 */
export async function getTeacherClassIds(userId: string): Promise<string[]> {
  const client = getServerSupabaseClient();
  const { data, error } = await client
    .from("classes")
    .select("id")
    .eq("teacher_id", userId)
    .or("is_active.eq.true,is_active.is.null");

  if (error || !data) return [];
  return data.map((c: { id: string }) => c.id);
}

/**
 * 检查教师是否有权访问某学生（通过 student_classes 表检查学生是否属于教师所负责的班级）
 */
export async function canTeacherAccessStudent(userId: string, studentId: string): Promise<boolean> {
  const classIds = await getTeacherClassIds(userId);
  if (classIds.length === 0) return false;

  const client = getServerSupabaseClient();
  const { data, error } = await client
    .from("student_classes")
    .select("class_id")
    .eq("student_id", studentId)
    .in("class_id", classIds);

  if (error || !data) return false;
  return data.length > 0;
}
