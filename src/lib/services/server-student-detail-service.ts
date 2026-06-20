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
        grade: cls.grade,
        schedule: cls.schedule,
        teacher_id: cls.teacherId,
        is_primary: rel.isPrimary,
        teacher: teacher ? { id: teacher.id, name: teacher.name, phone: teacher.phone } : null,
      };
    })
    .filter(Boolean);

  const primaryClass = student.classId ? classMap.get(student.classId) || null : null;
  const primaryTeacher = primaryClass?.teacherId ? teacherMap.get(primaryClass.teacherId) || null : null;

  return {
    id: student.id,
    name: student.name,
    grade: student.grade,
    school: student.school,
    phone: student.phone,
    current_class: student.currentClass,
    class_id: student.classId,
    current_teacher_id: student.currentTeacherId,
    admin_teacher_id: student.adminTeacherId,
    is_active: student.isActive,
    created_at: student.createdAt,
    updated_at: student.updatedAt,
    class: primaryClass
      ? {
          id: primaryClass.id,
          name: primaryClass.name,
          grade: primaryClass.grade,
          schedule: primaryClass.schedule,
          teacher_id: primaryClass.teacherId,
          teacher: primaryTeacher ? { id: primaryTeacher.id, name: primaryTeacher.name, phone: primaryTeacher.phone } : null,
        }
      : null,
    classes: studentClassesList,
    admin_teacher: student.adminTeacherId ? teacherMap.get(student.adminTeacherId) || null : null,
    current_teacher: student.currentTeacherId ? teacherMap.get(student.currentTeacherId) || null : null,
    feedbacks: feedbackList.map((f) => ({
      id: f.id,
      status: f.status,
      created_at: f.createdAt,
      period_start: f.periodStart,
      period_end: f.periodEnd,
      ai_report: f.aiReport,
      metadata: f.metadata,
      strengths: f.strengths,
      improvements: f.improvements,
      weaknesses: f.weaknesses,
      suggestions: f.suggestions,
    })),
    transfers: transfers.map((t) => ({
      id: t.id,
      from_class: t.fromClass,
      to_class: t.toClass,
      transferred_at: t.transferredAt,
    })),
  };
}
