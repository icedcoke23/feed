import { db } from "@/storage/database/drizzle-client";
import {
  students,
  classes,
  teachers,
  studentClasses,
} from "@/storage/database/shared/schema";
import {
  eq,
  inArray,
  or,
  isNull,
  and,
  desc,
  count,
} from "drizzle-orm";
import * as authService from "@/lib/services/auth-service";
import { buildPaginationMeta } from "@/lib/pagination";
import { forbiddenError } from "@/lib/api-error";
import type { AuthUserResult } from "@/lib/route-auth";

function isAdmin(user: AuthUserResult) {
  return user.userRole === "admin" || user.teacherRole === "admin";
}

export interface HomeDataQuery {
  page: number;
  limit: number;
}

export interface HomeDataResult {
  students: unknown[];
  studentsPagination: ReturnType<typeof buildPaginationMeta>;
  classes: unknown[];
  teachers: unknown[];
  adminTeachers: unknown[];
}

export async function getHomeData(
  user: AuthUserResult,
  query: HomeDataQuery
): Promise<HomeDataResult | Response> {
  if (!user) return forbiddenError("未授权访问");

  const accessibleStudentIds = await authService.getAccessibleStudentIds(user);
  if (accessibleStudentIds?.length === 0) {
    return {
      students: [],
      studentsPagination: buildPaginationMeta(query.page, query.limit, 0),
      classes: [],
      teachers: [],
      adminTeachers: [],
    };
  }

  const offset = (query.page - 1) * query.limit;

  // 学生查询条件
  const studentWhere = and(
    or(eq(students.isActive, true), isNull(students.isActive)),
    accessibleStudentIds ? inArray(students.id, accessibleStudentIds) : undefined
  );

  // 班级查询条件
  const classWhere = and(
    or(eq(classes.isActive, true), isNull(classes.isActive)),
    user.userRole === "teacher" && !isAdmin(user) && user.userId
      ? eq(classes.teacherId, user.userId)
      : undefined
  );

  const [studentsData, studentsTotal, classesData, teachersData, adminTeachersData] = await Promise.all([
    db
      .select()
      .from(students)
      .where(studentWhere)
      .orderBy(desc(students.createdAt))
      .limit(query.limit)
      .offset(offset),
    db.select({ value: count() }).from(students).where(studentWhere),
    db
      .select()
      .from(classes)
      .where(classWhere)
      .orderBy(desc(classes.createdAt)),
    db
      .select({ id: teachers.id, name: teachers.name, phone: teachers.phone, email: teachers.email })
      .from(teachers)
      .where(or(eq(teachers.isActive, true), isNull(teachers.isActive)))
      .orderBy(teachers.name),
    db
      .select({ id: teachers.id, name: teachers.name, phone: teachers.phone, email: teachers.email })
      .from(teachers)
      .where(
        and(
          eq(teachers.role, "admin"),
          or(eq(teachers.isActive, true), isNull(teachers.isActive))
        )
      )
      .orderBy(teachers.name),
  ]);

  // 为学生补充班级和教师信息
  const enrichedStudents = await enrichStudents(studentsData);

  // 为班级补充教师信息
  const classesWithTeacher = await enrichClasses(classesData);

  return {
    students: enrichedStudents,
    studentsPagination: buildPaginationMeta(query.page, query.limit, studentsTotal[0]?.value ?? 0),
    classes: classesWithTeacher,
    teachers: teachersData,
    adminTeachers: adminTeachersData,
  };
}

async function enrichStudents(studentsData: typeof students.$inferSelect[]) {
  if (studentsData.length === 0) return [];

  const studentIds = studentsData.map((s) => s.id);
  const classIds = [...new Set(studentsData.map((s) => s.classId).filter(Boolean))] as string[];
  const adminTeacherIds = [...new Set(studentsData.map((s) => s.adminTeacherId).filter(Boolean))] as string[];

  const [classesInfo, adminTeachersInfo, studentClassRelations] = await Promise.all([
    classIds.length > 0
      ? db
          .select()
          .from(classes)
          .where(and(inArray(classes.id, classIds), or(eq(classes.isActive, true), isNull(classes.isActive))))
      : Promise.resolve([]),
    adminTeacherIds.length > 0
      ? db
          .select({ id: teachers.id, name: teachers.name, phone: teachers.phone })
          .from(teachers)
          .where(inArray(teachers.id, adminTeacherIds))
      : Promise.resolve([]),
    db
      .select({
        studentId: studentClasses.studentId,
        classId: studentClasses.classId,
        isPrimary: studentClasses.isPrimary,
      })
      .from(studentClasses)
      .where(inArray(studentClasses.studentId, studentIds)),
  ]);

  const classesMap = new Map(classesInfo.map((c) => [c.id, c]));

  // 补查班级教师：classesInfo 中的 teacherId 对应的教师不在 adminTeachersInfo 中，
  // 需额外查询并合并到 teachersMap，否则班级教师字段静默为 null。
  const classTeacherIds = [
    ...new Set(classesInfo.map((c) => c.teacherId).filter(Boolean)),
  ] as string[];
  const classTeachersInfo =
    classTeacherIds.length > 0
      ? await db
          .select({ id: teachers.id, name: teachers.name, phone: teachers.phone })
          .from(teachers)
          .where(inArray(teachers.id, classTeacherIds))
      : [];
  const teachersMap = new Map([
    ...adminTeachersInfo.map((t) => [t.id, t] as const),
    ...classTeachersInfo.map((t) => [t.id, t] as const),
  ]);
  const relationsByStudent = new Map<string, typeof studentClassRelations>();
  studentClassRelations.forEach((rel) => {
    if (!relationsByStudent.has(rel.studentId)) relationsByStudent.set(rel.studentId, []);
    relationsByStudent.get(rel.studentId)!.push(rel);
  });

  return studentsData.map((s) => {
    const relations = relationsByStudent.get(s.id) || [];
    const classList = relations
      .map((r) => {
        const cls = classesMap.get(r.classId);
        if (!cls) return null;
        const teacher = cls.teacherId ? teachersMap.get(cls.teacherId) || null : null;
        return {
          id: cls.id,
          name: cls.name,
          grade: cls.grade,
          schedule: cls.schedule,
          teacher_id: cls.teacherId,
          is_primary: r.isPrimary,
          teacher: teacher ? { id: teacher.id, name: teacher.name, phone: teacher.phone } : null,
        };
      })
      .filter(Boolean);

    const primaryRel = relations.find((r) => r.isPrimary);
    const primaryClass = primaryRel ? classesMap.get(primaryRel.classId) : s.classId ? classesMap.get(s.classId) : undefined;
    const primaryTeacher = primaryClass?.teacherId ? teachersMap.get(primaryClass.teacherId) || null : null;

    return {
      id: s.id,
      name: s.name,
      grade: s.grade,
      school: s.school,
      phone: s.phone,
      current_class: s.currentClass,
      class_id: primaryClass?.id || s.classId,
      current_teacher_id: s.currentTeacherId,
      admin_teacher_id: s.adminTeacherId,
      is_active: s.isActive,
      created_at: s.createdAt,
      updated_at: s.updatedAt,
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
      classes: classList,
      admin_teacher: s.adminTeacherId
        ? teachersMap.get(s.adminTeacherId) || null
        : null,
    };
  });
}

async function enrichClasses(classesData: typeof classes.$inferSelect[]) {
  if (classesData.length === 0) return [];

  const teacherIds = [...new Set(classesData.map((c) => c.teacherId).filter(Boolean))] as string[];
  const teacherRows = teacherIds.length > 0
    ? await db
        .select({ id: teachers.id, name: teachers.name, phone: teachers.phone })
        .from(teachers)
        .where(inArray(teachers.id, teacherIds))
    : [];
  const teacherMap = new Map(teacherRows.map((t) => [t.id, t]));

  return classesData.map((c) => ({
    id: c.id,
    name: c.name,
    grade: c.grade,
    schedule: c.schedule,
    teacher_id: c.teacherId,
    description: c.description,
    is_active: c.isActive,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
    teacher: c.teacherId ? teacherMap.get(c.teacherId) || null : null,
  }));
}
