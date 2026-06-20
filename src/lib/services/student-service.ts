import { db } from "@/storage/database/drizzle-client";
import {
  students,
  studentClasses,
  classes,
  teachers,
  feedbacks,
  classTransfers,
} from "@/storage/database/shared/schema";
import { eq, inArray, and, or, isNull, desc } from "drizzle-orm";
import * as repo from "@/lib/repositories/student-repository";
import * as authService from "@/lib/services/auth-service";
import { buildPaginationMeta } from "@/lib/pagination";
import {
  forbiddenError,
  notFoundError,
  badRequestError,
} from "@/lib/api-error";
import { extractLegacyMetadata } from "@/utils/ai-report";
import { maskPhone } from "@/lib/sensitive-mask";
import type { AuthUserResult } from "@/lib/route-auth";
import type { Student, InsertStudent } from "@/storage/database/shared/schema";

function isAdmin(user: AuthUserResult) {
  return user.userRole === "admin" || user.teacherRole === "admin";
}

function isStaffTeacher(user: AuthUserResult) {
  return user.userRole === "teacher" && user.teacherRole === "admin";
}

async function canAccessStudent(
  user: AuthUserResult,
  student: Student
): Promise<boolean> {
  if (isAdmin(user)) return true;
  if (isStaffTeacher(user)) {
    return student.adminTeacherId === user.userId;
  }
  return authService.canTeacherAccessStudent(user.userId, student.id);
}

function toSnakeCaseStudent(student: Student) {
  return {
    id: student.id,
    name: student.name,
    grade: student.grade,
    school: student.school,
    phone: maskPhone(student.phone),
    current_class: student.currentClass,
    class_id: student.classId,
    current_teacher_id: student.currentTeacherId,
    admin_teacher_id: student.adminTeacherId,
    is_active: student.isActive,
    created_at: student.createdAt,
    updated_at: student.updatedAt,
  };
}

type ClassInfo = {
  id: string;
  name: string;
  grade: string | null;
  schedule: string | null;
  teacher_id: string | null;
  teacher: { id: string; name: string; phone: string | null } | null;
};

async function enrichStudents(
  rows: Student[]
): Promise<
  Array<
    ReturnType<typeof toSnakeCaseStudent> & {
      class: ClassInfo | null;
      classes: Array<ClassInfo & { is_primary: boolean }>;
      admin_teacher: { id: string; name: string; phone: string | null } | null;
    }
  >
> {
  if (rows.length === 0) return [];

  const studentIds = rows.map((s) => s.id);
  const adminTeacherIds = [
    ...new Set(rows.map((s) => s.adminTeacherId).filter(Boolean)),
  ] as string[];
  const currentClassIds = [
    ...new Set(rows.map((s) => s.classId).filter(Boolean)),
  ] as string[];

  const [adminTeacherRows, currentClassRows] = await Promise.all([
    adminTeacherIds.length > 0
      ? db
          .select({ id: teachers.id, name: teachers.name, phone: teachers.phone })
          .from(teachers)
          .where(inArray(teachers.id, adminTeacherIds))
      : Promise.resolve([]),
    currentClassIds.length > 0
      ? db.select().from(classes).where(inArray(classes.id, currentClassIds))
      : Promise.resolve([]),
  ]);

  const adminTeacherMap = new Map(
    adminTeacherRows.map((t) => [t.id, { id: t.id, name: t.name, phone: maskPhone(t.phone) }])
  );
  const currentClassMap = new Map(currentClassRows.map((c) => [c.id, c]));

  const currentClassTeacherIds = [
    ...new Set(currentClassRows.map((c) => c.teacherId).filter(Boolean)),
  ] as string[];
  const currentClassTeachers =
    currentClassTeacherIds.length > 0
      ? await db
          .select({ id: teachers.id, name: teachers.name, phone: teachers.phone })
          .from(teachers)
          .where(inArray(teachers.id, currentClassTeacherIds))
      : [];
  const currentClassTeacherMap = new Map(
    currentClassTeachers.map((t) => [t.id, { id: t.id, name: t.name, phone: maskPhone(t.phone) }])
  );

  const scRows = await db
    .select({
      studentId: studentClasses.studentId,
      classId: studentClasses.classId,
      isPrimary: studentClasses.isPrimary,
    })
    .from(studentClasses)
    .where(
      and(
        inArray(studentClasses.studentId, studentIds),
        eq(studentClasses.isActive, true)
      )
    );

  const scClassIds = [
    ...new Set(scRows.map((r) => r.classId).filter(Boolean)),
  ] as string[];
  const scClassRows =
    scClassIds.length > 0
      ? await db.select().from(classes).where(inArray(classes.id, scClassIds))
      : [];
  const scClassMap = new Map(scClassRows.map((c) => [c.id, c]));

  const scTeacherIds = [
    ...new Set(scClassRows.map((c) => c.teacherId).filter(Boolean)),
  ] as string[];
  const scTeachers =
    scTeacherIds.length > 0
      ? await db
          .select({ id: teachers.id, name: teachers.name, phone: teachers.phone })
          .from(teachers)
          .where(inArray(teachers.id, scTeacherIds))
      : [];
  const scTeacherMap = new Map(
    scTeachers.map((t) => [t.id, { id: t.id, name: t.name, phone: maskPhone(t.phone) }])
  );

  const scByStudent = new Map<string, typeof scRows>();
  for (const sc of scRows) {
    const arr = scByStudent.get(sc.studentId) || [];
    arr.push(sc);
    scByStudent.set(sc.studentId, arr);
  }

  function buildClassInfo(classRow: (typeof scClassRows)[number] | undefined): ClassInfo {
    return {
      id: classRow?.id ?? "",
      name: classRow?.name ?? "",
      grade: classRow?.grade ?? null,
      schedule: classRow?.schedule ?? null,
      teacher_id: classRow?.teacherId ?? null,
      teacher: classRow?.teacherId
        ? scTeacherMap.get(classRow.teacherId) ?? null
        : null,
    };
  }

  return rows.map((student) => {
    const base = toSnakeCaseStudent(student);
    const adminTeacher = student.adminTeacherId
      ? adminTeacherMap.get(student.adminTeacherId) ?? null
      : null;

    const currentClassRow = student.classId
      ? currentClassMap.get(student.classId)
      : undefined;
    const currentClass: ClassInfo | null = currentClassRow
      ? {
          id: currentClassRow.id,
          name: currentClassRow.name,
          grade: currentClassRow.grade,
          schedule: currentClassRow.schedule,
          teacher_id: currentClassRow.teacherId,
          teacher: currentClassRow.teacherId
            ? currentClassTeacherMap.get(currentClassRow.teacherId) ?? null
            : null,
        }
      : null;

    const relations = scByStudent.get(student.id) || [];
    const classesList = relations.map((r) => ({
      ...buildClassInfo(scClassMap.get(r.classId)),
      is_primary: r.isPrimary,
    }));

    const primaryRelation = relations.find((r) => r.isPrimary);
    const primaryClass = primaryRelation
      ? buildClassInfo(scClassMap.get(primaryRelation.classId))
      : currentClass;

    return {
      ...base,
      class: primaryClass,
      classes: classesList,
      admin_teacher: adminTeacher,
    };
  });
}

export interface ListStudentsQuery {
  page: number;
  limit: number;
  teacherId?: string;
  classId?: string;
  search?: string;
}

export async function list(user: AuthUserResult, query: ListStudentsQuery) {
  const options: repo.ListStudentsOptions = {
    ...query,
    isActive: true,
    currentTeacherId: query.teacherId,
    classIds: query.classId ? [query.classId] : undefined,
  };

  if (isStaffTeacher(user)) {
    options.adminTeacherId = user.userId;
  } else if (!isAdmin(user)) {
    const classIds = await authService.getTeacherClassIds(user.userId);
    if (classIds.length === 0) {
      return {
        data: [],
        pagination: buildPaginationMeta(query.page, query.limit, 0),
      };
    }
    const scRows = await db
      .select({ studentId: studentClasses.studentId })
      .from(studentClasses)
      .where(
        and(
          inArray(studentClasses.classId, classIds),
          eq(studentClasses.isActive, true)
        )
      );
    const ids = [...new Set(scRows.map((r) => r.studentId))];
    if (ids.length === 0) {
      return {
        data: [],
        pagination: buildPaginationMeta(query.page, query.limit, 0),
      };
    }
    options.ids = ids;
  }

  const result = await repo.list(options);
  const data = await enrichStudents(result.data);
  return {
    data,
    pagination: buildPaginationMeta(query.page, query.limit, result.count),
  };
}

export async function findById(user: AuthUserResult, id: string) {
  const student = await repo.findById(id);
  if (!student) return notFoundError("学生不存在");

  const allowed = await canAccessStudent(user, student);
  if (!allowed) return forbiddenError("权限不足");

  const [enriched] = await enrichStudents([student]);
  const [feedbacksList, transfersList] = await Promise.all([
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

  return {
    ...enriched,
    feedbacks: feedbacksList,
    transfers: transfersList,
  };
}

export async function create(user: AuthUserResult, payload: InsertStudent) {
  if (!isAdmin(user)) return forbiddenError("权限不足");
  const student = await repo.create({ ...payload, isActive: true });
  const [enriched] = await enrichStudents([student]);
  return enriched;
}

export async function update(
  user: AuthUserResult,
  id: string,
  payload: Partial<InsertStudent>
) {
  const existing = await repo.findById(id);
  if (!existing) return notFoundError("学生不存在");

  const allowed = await canAccessStudent(user, existing);
  if (!allowed) return forbiddenError("权限不足");

  if (
    !isAdmin(user) &&
    !isStaffTeacher(user) &&
    typeof payload.classId === "string"
  ) {
    const classIds = await authService.getTeacherClassIds(user.userId);
    if (!classIds.includes(payload.classId)) {
      return forbiddenError("无权将学生转移到该班级");
    }
  }

  const updated = await repo.update(id, payload);
  if (!updated) return notFoundError("学生不存在");
  const [enriched] = await enrichStudents([updated]);
  return enriched;
}

export async function remove(user: AuthUserResult, id: string) {
  const existing = await repo.findById(id);
  if (!existing) return notFoundError("学生不存在");

  const allowed = await canAccessStudent(user, existing);
  if (!allowed) return forbiddenError("权限不足");

  await repo.update(id, { isActive: false, updatedAt: new Date() });
}

export async function history(user: AuthUserResult, id: string) {
  const student = await repo.findById(id);
  if (!student || !student.isActive) {
    return notFoundError("学员不存在或已被删除");
  }

  const allowed = await canAccessStudent(user, student);
  if (!allowed) return forbiddenError("权限不足");

  const rows = await db
    .select()
    .from(feedbacks)
    .where(eq(feedbacks.studentId, id))
    .orderBy(desc(feedbacks.createdAt))
    .limit(10);

  return rows.map((fb) => {
    let metadataSource: Record<string, unknown> = {};
    if (fb.metadata && typeof fb.metadata === "object") {
      metadataSource = fb.metadata as Record<string, unknown>;
    } else if (fb.aiReport) {
      const legacy = extractLegacyMetadata(fb.aiReport);
      if (legacy) metadataSource = legacy;
    }

    let overallRating: number | null = null;
    if (metadataSource.tags && Array.isArray(metadataSource.tags)) {
      const ratings = metadataSource.tags
        .map((t: { rating?: number }) => t.rating)
        .filter(
          (r: number | undefined): r is number =>
            typeof r === "number" && r > 0
        );
      if (ratings.length > 0) {
        overallRating =
          Math.round(
            (ratings.reduce((sum: number, r: number) => sum + r, 0) /
              ratings.length) *
              10
          ) / 10;
      }
    }

    return {
      id: fb.id,
      feedback_date: fb.createdAt,
      teaching_theme: (metadataSource.theme as string) || "教学反馈",
      overall_rating: overallRating,
      strengths: Array.isArray(fb.strengths)
        ? fb.strengths
            .map(
              (s: { tag?: string; name?: string; content?: string }) =>
                s.tag || s.name || s.content || ""
            )
            .filter(Boolean)
        : [],
      areas_for_improvement: Array.isArray(fb.weaknesses)
        ? fb.weaknesses
            .map(
              (w: { tag?: string; name?: string; content?: string }) =>
                w.tag || w.name || w.content || ""
            )
            .filter(Boolean)
        : [],
      improvements: Array.isArray(fb.improvements)
        ? fb.improvements
            .map(
              (i: { tag?: string; name?: string; content?: string }) =>
                i.tag || i.name || i.content || ""
            )
            .filter(Boolean)
        : [],
      suggestions: fb.suggestions || "",
    };
  });
}

export interface TransferInput {
  targetClassId: string;
}

export async function transfer(
  user: AuthUserResult,
  id: string,
  input: TransferInput
) {
  const student = await repo.findById(id);
  if (!student) return notFoundError("学生不存在");

  if (!isAdmin(user)) {
    if (isStaffTeacher(user)) {
      if (student.adminTeacherId !== user.userId) {
        return forbiddenError("无权操作此学生");
      }
    } else if (student.currentTeacherId !== user.userId) {
      return forbiddenError("无权操作此学生");
    }
  }

  const [targetClass] = await db
    .select()
    .from(classes)
    .where(eq(classes.id, input.targetClassId))
    .limit(1);
  if (!targetClass) return notFoundError("目标班级不存在");
  if (!targetClass.teacherId) {
    return badRequestError("目标班级没有指定教师");
  }
  const targetTeacherId = targetClass.teacherId;

  await db.transaction(async (tx) => {
    await tx.insert(classTransfers).values({
      studentId: id,
      fromTeacherId: student.currentTeacherId,
      toTeacherId: targetTeacherId,
      fromClass: student.currentClass,
      toClass: targetClass.name,
    });

    await tx
      .update(students)
      .set({
        classId: targetClass.id,
        currentTeacherId: targetTeacherId,
        currentClass: targetClass.name,
        updatedAt: new Date(),
      })
      .where(eq(students.id, id));

    if (student.classId) {
      await tx
        .update(studentClasses)
        .set({
          isPrimary: false,
          isActive: false,
          leftAt: new Date(),
        })
        .where(
          and(
            eq(studentClasses.studentId, id),
            eq(studentClasses.classId, student.classId)
          )
        );
    }

    await tx.insert(studentClasses).values({
      studentId: id,
      classId: targetClass.id,
      isPrimary: true,
      isActive: true,
      joinedAt: new Date(),
    });
  });

  return {
    ...toSnakeCaseStudent(student),
    class_id: targetClass.id,
    current_class: targetClass.name,
    current_teacher_id: targetTeacherId,
    updated_at: new Date().toISOString(),
  };
}

export interface BatchCreateStudent {
  name: string;
  grade?: string;
  className?: string;
  teacherName?: string;
}

export interface BatchCreateInput {
  students: BatchCreateStudent[];
  classId?: string;
}

export async function batchCreate(
  user: AuthUserResult,
  input: BatchCreateInput
) {
  if (!isAdmin(user)) return forbiddenError("权限不足");

  const teacherNames = [
    ...new Set(
      input.students.filter((s) => s.teacherName).map((s) => s.teacherName!)
    ),
  ];
  const teacherNameToId: Record<string, string> = {};

  if (teacherNames.length > 0) {
    const rows = await db
      .select({ id: teachers.id, name: teachers.name })
      .from(teachers)
      .where(
        and(
          inArray(teachers.name, teacherNames),
          or(eq(teachers.isActive, true), isNull(teachers.isActive))
        )
      );
    rows.forEach((t) => {
      teacherNameToId[t.name] = t.id;
    });
  }

  const toInsert = input.students.map((s) => ({
    name: s.name,
    grade: s.grade || "",
    currentClass: s.className || "",
    classId: input.classId || null,
    currentTeacherId: s.teacherName
      ? teacherNameToId[s.teacherName] || null
      : null,
    isActive: true,
  }));

  const data = await db.insert(students).values(toInsert).returning();
  return { data, count: data.length };
}
