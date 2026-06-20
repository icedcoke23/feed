import { db } from "@/storage/database/drizzle-client";
import { classes, studentClasses, students, teachers, users } from "@/storage/database/shared/schema";
import { eq, inArray, or, isNull, and } from "drizzle-orm";
import { comparePassword, hashPassword, isBcryptHash } from "@/lib/auth";
import { apiError, notFoundError } from "@/lib/api-error";
import type { AuthUserResult } from "@/lib/route-auth";

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

export async function getTeacherRole(userId: string): Promise<"admin" | "teacher"> {
  const rows = await db
    .select({ role: teachers.role })
    .from(teachers)
    .where(eq(teachers.id, userId))
    .limit(1);
  return (rows[0]?.role as "admin" | "teacher") || "teacher";
}

/**
 * 获取当前用户可访问的学生 ID 列表。
 * - 管理员：返回 null（表示无限制）。
 * - 教务老师：按 admin_teacher_id 过滤。
 * - 授课老师：按其所带班级的 student_classes 关联过滤。
 */
export async function getAccessibleStudentIds(
  user: AuthUserResult
): Promise<string[] | null> {
  if (user.userRole === "admin") return null;

  if (user.teacherRole === "admin") {
    const rows = await db
      .select({ id: students.id })
      .from(students)
      .where(
        and(
          eq(students.adminTeacherId, user.userId),
          or(eq(students.isActive, true), isNull(students.isActive))
        )
      );
    return rows.map((r) => r.id);
  }

  const classIds = await getTeacherClassIds(user.userId);
  if (classIds.length === 0) return [];

  const rows = await db
    .select({ studentId: studentClasses.studentId })
    .from(studentClasses)
    .where(inArray(studentClasses.classId, classIds));

  return [...new Set(rows.map((r) => r.studentId))];
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface LoginResult {
  user: {
    id: string;
    username: string;
    name: string;
    role: string;
    phone: string | null;
    teacherRole?: string | null;
  };
}

export async function login(input: LoginInput): Promise<LoginResult | Response> {
  const rows = await db
    .select()
    .from(users)
    .where(and(eq(users.username, input.username), eq(users.isActive, true)))
    .limit(1);

  const user = rows[0];
  if (!user) return apiError("用户名或密码错误", 401, "INVALID_CREDENTIALS");

  if (!isBcryptHash(user.password)) {
    return apiError(
      "密码格式已过期，请联系管理员重置密码",
      401,
      "PASSWORD_FORMAT_EXPIRED"
    );
  }

  if (!(await comparePassword(input.password, user.password))) {
    return apiError("用户名或密码错误", 401, "INVALID_CREDENTIALS");
  }

  const result: LoginResult["user"] = {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    phone: user.phone,
  };

  if (user.role === "teacher") {
    const teacherRows = await db
      .select({ role: teachers.role })
      .from(teachers)
      .where(eq(teachers.id, user.id))
      .limit(1);
    result.teacherRole = teacherRows[0]?.role ?? null;
  }

  return { user: result };
}

export async function getCurrentUser(userId: string): Promise<LoginResult["user"] | Response> {
  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!user) return notFoundError("用户不存在");

  const result: LoginResult["user"] = {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    phone: user.phone,
  };

  if (user.role === "teacher") {
    const teacherRows = await db
      .select({ role: teachers.role })
      .from(teachers)
      .where(eq(teachers.id, user.id))
      .limit(1);
    result.teacherRole = teacherRows[0]?.role ?? null;
  }

  return result;
}

export interface ChangePasswordInput {
  oldPassword: string;
  newPassword: string;
}

export async function changePassword(
  userId: string,
  input: ChangePasswordInput
): Promise<{ success: true } | Response> {
  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!user) return notFoundError("用户不存在");

  if (!(await comparePassword(input.oldPassword, user.password))) {
    return apiError("旧密码错误", 400, "INVALID_PASSWORD");
  }

  await db
    .update(users)
    .set({ password: await hashPassword(input.newPassword) })
    .where(eq(users.id, user.id));

  return { success: true };
}
