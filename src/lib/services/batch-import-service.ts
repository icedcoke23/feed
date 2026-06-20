import { db } from "@/storage/database/drizzle-client";
import {
  classes,
  students,
  teachers,
  users,
  studentClasses,
} from "@/storage/database/shared/schema";
import { eq, and, inArray } from "drizzle-orm";

export interface ClassData {
  teacherName: string;
  classTime: string;
  courseName: string;
  students: string[];
}

function parseStudents(rawStudents: string[]): string[] {
  const validStudents: string[] = [];

  for (const raw of rawStudents) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("(寒)")) continue;

    const match = trimmed.match(/^\((高|心)\)(.+)$/);
    if (match) {
      validStudents.push(match[2].trim());
      continue;
    }

    if (trimmed.startsWith("(") && trimmed.includes(")")) continue;
    if (!trimmed.startsWith("(")) validStudents.push(trimmed);
  }

  return validStudents;
}

function inferGrade(courseName: string): string {
  if (courseName.includes("小小乐高") || courseName.includes("百变") || courseName.includes("生活")) {
    return "幼儿";
  }
  if (courseName.includes("BQ") || courseName.includes("wedo")) return "小学低年级";
  if (courseName.includes("spike")) return "小学中高年级";
  if (courseName.includes("scratch")) return "小学";
  if (courseName.includes("python") || courseName.includes("C++")) return "小学高年级";
  return "小学";
}

export interface BatchImportClassesResult {
  success: boolean;
  classesCreated: number;
  studentsCreated: number;
  studentsLinked: number;
  errors: string[];
  details: Array<{ className: string; teacher: string; studentsCount: number }>;
}

export async function importClasses(classDataList: ClassData[]): Promise<BatchImportClassesResult> {
  return db.transaction(async (tx) => {
    const result: BatchImportClassesResult = {
      success: true,
      classesCreated: 0,
      studentsCreated: 0,
      studentsLinked: 0,
      errors: [],
      details: [],
    };

    const [existingStudents, existingTeachers] = await Promise.all([
      tx.select({ id: students.id, name: students.name }).from(students),
      tx.select({ id: teachers.id, name: teachers.name }).from(teachers),
    ]);

    const studentMap = new Map(existingStudents.map((s) => [s.name, s.id]));
    const teacherMap = new Map(existingTeachers.map((t) => [t.name, t.id]));

    for (const classData of classDataList) {
      const teacherId = teacherMap.get(classData.teacherName);
      if (!teacherId) {
        result.errors.push(`找不到老师: ${classData.teacherName}`);
        continue;
      }

      const className = `${classData.classTime} ${classData.courseName}`;

      const existingClass = await tx
        .select({ id: classes.id })
        .from(classes)
        .where(and(eq(classes.name, className), eq(classes.teacherId, teacherId)))
        .limit(1)
        .then((rows) => rows[0] ?? null);

      let classId: string;
      if (existingClass) {
        classId = existingClass.id;
      } else {
        const inserted = await tx
          .insert(classes)
          .values({
            name: className,
            teacherId,
            grade: inferGrade(classData.courseName),
            isActive: true,
          })
          .returning();
        classId = inserted[0].id;
        result.classesCreated++;
      }

      const validStudents = parseStudents(classData.students);

      for (const studentName of validStudents) {
        if (!studentName) continue;

        const existingStudentId = studentMap.get(studentName);

        if (existingStudentId) {
          const existingRelation = await tx
            .select({ id: studentClasses.id })
            .from(studentClasses)
            .where(
              and(
                eq(studentClasses.studentId, existingStudentId),
                eq(studentClasses.classId, classId)
              )
            )
            .limit(1)
            .then((rows) => rows[0] ?? null);

          if (!existingRelation) {
            const primaryCheck = await tx
              .select({ id: studentClasses.id })
              .from(studentClasses)
              .where(
                and(
                  eq(studentClasses.studentId, existingStudentId),
                  eq(studentClasses.isPrimary, true)
                )
              )
              .limit(1)
              .then((rows) => rows[0] ?? null);

            await tx.insert(studentClasses).values({
              studentId: existingStudentId,
              classId,
              isPrimary: !primaryCheck,
              isActive: true,
            });
            result.studentsLinked++;
          }
        } else {
          const inserted = await tx
            .insert(students)
            .values({
              name: studentName,
              classId,
              currentTeacherId: teacherId,
              isActive: true,
            })
            .returning();
          const studentId = inserted[0].id;
          studentMap.set(studentName, studentId);
          result.studentsCreated++;

          await tx.insert(studentClasses).values({
            studentId,
            classId,
            isPrimary: true,
            isActive: true,
          });
        }
      }

      result.details.push({
        className,
        teacher: classData.teacherName,
        studentsCount: validStudents.length,
      });
    }

    return result;
  });
}

export interface UpdateAdminTeacherInput {
  name: string;
  adminType: string;
}

export interface UpdateAdminTeachersResult {
  updated: number;
  notFound: string[];
  errors: string[];
}

export async function updateAdminTeachers(
  items: UpdateAdminTeacherInput[],
  mappings: Record<string, string>
): Promise<UpdateAdminTeachersResult> {
  const result: UpdateAdminTeachersResult = {
    updated: 0,
    notFound: [],
    errors: [],
  };

  const usernames = [...new Set(Object.values(mappings))];
  const teacherRows = await db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(inArray(users.username, usernames));

  const teacherIdByUsername = new Map(teacherRows.map((t) => [t.username, t.id]));
  const teacherIdByType = new Map<string, string | null>();
  for (const [type, username] of Object.entries(mappings)) {
    teacherIdByType.set(type, teacherIdByUsername.get(username) || null);
  }

  for (const item of items) {
    const adminTeacherId = teacherIdByType.get(item.adminType);

    if (!adminTeacherId) {
      result.errors.push(`未找到教务老师: ${item.adminType}`);
      continue;
    }

    const updatedRows = await db
      .update(students)
      .set({ adminTeacherId })
      .where(eq(students.name, item.name))
      .returning({ id: students.id });

    if (updatedRows.length === 0) {
      result.notFound.push(item.name);
    } else {
      result.updated += updatedRows.length;
    }
  }

  return result;
}
