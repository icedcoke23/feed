import { db } from "@/storage/database/drizzle-client";
import { classes, studentClasses, students, teachers } from "@/storage/database/shared/schema";
import { eq, inArray, or, isNull, and } from "drizzle-orm";
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
