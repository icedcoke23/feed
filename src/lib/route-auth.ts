import { NextRequest, NextResponse } from "next/server";
import { verifyToken, signToken, COOKIE_NAME } from "@/lib/auth";
import { db } from "@/storage/database/drizzle-client";
import { teachers, classes, studentClasses } from "@/storage/database/shared/schema";
import { eq, inArray, or, isNull, and } from "drizzle-orm";
import { jwtVerify } from "jose";

export interface AuthUserResult {
  userId: string;
  userRole: string;
  teacherRole?: "admin" | "teacher";
  newToken?: string;
}

export async function getAuthUser(request: NextRequest): Promise<AuthUserResult | null> {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;

  let newToken: string | undefined;
  try {
    const secretKey = new TextEncoder().encode(
      process.env.JWT_SECRET || "dev-only-jwt-secret-change-in-production"
    );
    const { payload: decoded } = await jwtVerify(token, secretKey);
    const exp = decoded.exp;
    const iat = decoded.iat;
    if (exp && iat) {
      const now = Math.floor(Date.now() / 1000);
      const totalLifetime = exp - iat;
      const remaining = exp - now;
      if (remaining < totalLifetime * 0.5) {
        newToken = await signToken({ userId: payload.userId, role: payload.role });
      }
    }
  } catch {
    // ignore
  }

  let teacherRole: "admin" | "teacher" | undefined;
  if (payload.role === "teacher") {
    const rows = await db
      .select({ role: teachers.role })
      .from(teachers)
      .where(eq(teachers.id, payload.userId))
      .limit(1);
    teacherRole = (rows[0]?.role as "admin" | "teacher") || "teacher";
  }

  return { userId: payload.userId, userRole: payload.role, teacherRole, newToken };
}

export function attachRenewedToken(
  response: NextResponse,
  authResult: AuthUserResult
): NextResponse {
  if (authResult.newToken) {
    response.headers.set("X-New-Token", authResult.newToken);
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

export async function getTeacherClassIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ id: classes.id })
    .from(classes)
    .where(
      and(
        eq(classes.teacherId, userId),
        or(eq(classes.isActive, true), isNull(classes.isActive))
      )
    );
  return rows.map((c) => c.id);
}

export async function canTeacherAccessStudent(
  userId: string,
  studentId: string
): Promise<boolean> {
  const classIds = await getTeacherClassIds(userId);
  if (classIds.length === 0) return false;

  const rows = await db
    .select({ classId: studentClasses.classId })
    .from(studentClasses)
    .where(and(eq(studentClasses.studentId, studentId), inArray(studentClasses.classId, classIds)))
    .limit(1);

  return rows.length > 0;
}
