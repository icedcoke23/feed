import "server-only";
import { db } from "@/storage/database/drizzle-client";
import { students, classes, teachers, studentClasses, feedbacks, classTransfers } from "@/storage/database/shared/schema";
import { eq, inArray, desc } from "drizzle-orm";

export async function fetchStudentById(id: string) {
  const studentRows = await db.select().from(students).where(eq(students.id, id)).limit(1);
  const student = studentRows[0];
  if (!student) return null;

  const [classRelations, feedbackList, transfers] = await Promise.all([
    db
      .select({
        classId: studentClasses.classId,
        isPrimary: studentClasses.isPrimary,
      })
      .from(studentClasses)
      .where(eq(studentClasses.studentId, id)),
    db
      .select()
      .from(feedbacks)
      .where(eq(feedbacks.studentId, id))
      .orderBy(desc(feedbacks.createdAt)),
    db
      .select()
      .from(classTransfers)
      .where(eq(classTransfers.studentId, id))
      .orderBy(desc(classTransfers.transferredAt)),
  ]);

  const classIds = [...new Set(classRelations.map((r) => r.classId))];
  const teacherIds: string[] = [];

  const classRows = classIds.length > 0
    ? await db.select().from(classes).where(inArray(classes.id, classIds))
    : [];

  classRows.forEach((c) => {
    if (c.teacherId) teacherIds.push(c.teacherId);
  });
  if (student.currentTeacherId) teacherIds.push(student.currentTeacherId);
  if (student.adminTeacherId) teacherIds.push(student.adminTeacherId);

  const teacherRows = teacherIds.length > 0
    ? await db
        .select({ id: teachers.id, name: teachers.name, phone: teachers.phone, email: teachers.email })
        .from(teachers)
        .where(inArray(teachers.id, teacherIds))
    : [];
  const teacherMap = new Map(teacherRows.map((t) => [t.id, t]));
  const classMap = new Map(classRows.map((c) => [c.id, c]));

  const studentClassesList = classRelations
    .map((rel) => {
      const cls = classMap.get(rel.classId);
      if (!cls) return null;
      const teacher = cls.teacherId ? teacherMap.get(cls.teacherId) || null : null;
      return {
        id: cls.id,
        name: cls.name,
        grade: cls.grade || undefined,
        schedule: cls.schedule || undefined,
        teacher_id: cls.teacherId || undefined,
        is_primary: rel.isPrimary,
        teacher: teacher ? { id: teacher.id, name: teacher.name, phone: teacher.phone || undefined } : undefined,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const primaryClass = student.classId ? classMap.get(student.classId) || null : null;
  const primaryTeacher = primaryClass?.teacherId ? teacherMap.get(primaryClass.teacherId) || null : null;

  return {
    id: student.id,
    name: student.name,
    grade: student.grade || undefined,
    school: student.school || undefined,
    phone: student.phone || undefined,
    current_class: student.currentClass || undefined,
    class_id: student.classId || undefined,
    current_teacher_id: student.currentTeacherId || undefined,
    admin_teacher_id: student.adminTeacherId || undefined,
    is_active: student.isActive,
    created_at: student.createdAt ? student.createdAt.toISOString() : "",
    updated_at: student.updatedAt ? student.updatedAt.toISOString() : undefined,
    class: primaryClass
      ? {
          id: primaryClass.id,
          name: primaryClass.name,
          grade: primaryClass.grade || undefined,
          schedule: primaryClass.schedule || undefined,
          teacher_id: primaryClass.teacherId || undefined,
          teacher: primaryTeacher ? { id: primaryTeacher.id, name: primaryTeacher.name, phone: primaryTeacher.phone || undefined } : undefined,
        }
      : undefined,
    classes: studentClassesList,
    admin_teacher: student.adminTeacherId
      ? (() => {
          const t = teacherMap.get(student.adminTeacherId!);
          if (!t) return undefined;
          return { id: t.id, name: t.name, phone: t.phone || undefined, email: t.email || undefined };
        })()
      : undefined,
    current_teacher: student.currentTeacherId
      ? (() => {
          const t = teacherMap.get(student.currentTeacherId!);
          if (!t) return undefined;
          return { id: t.id, name: t.name, phone: t.phone || undefined, email: t.email || undefined };
        })()
      : undefined,
    feedbacks: feedbackList.map((f) => ({
      id: f.id,
      status: f.status,
      created_at: f.createdAt ? f.createdAt.toISOString() : "",
      period_start: f.periodStart ? f.periodStart.toISOString() : "",
      period_end: f.periodEnd ? f.periodEnd.toISOString() : "",
      ai_report: f.aiReport || "",
      metadata: f.metadata as Record<string, unknown> | null,
      strengths: f.strengths as string | undefined,
      improvements: f.improvements as string | undefined,
      weaknesses: f.weaknesses as string | undefined,
      suggestions: f.suggestions || undefined,
    })),
    transfers: transfers.map((t) => ({
      id: t.id,
      from_class: t.fromClass || "",
      to_class: t.toClass || "",
      transferred_at: t.transferredAt ? t.transferredAt.toISOString() : "",
    })),
  };
}
