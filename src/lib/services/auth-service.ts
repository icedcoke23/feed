import { db } from "@/storage/database/drizzle-client";
import { classes, studentClasses, teachers } from "@/storage/database/shared/schema";
import { eq, inArray, or, isNull, and } from "drizzle-orm";

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
