/**
 * 课表数据导入脚本
 *
 * 从 JSON 文件读取解析好的课表数据，使用 Drizzle ORM 导入到 PostgreSQL 数据库。
 *
 * 导入内容：
 * 1. 教务老师（users + teachers 表，role=admin）
 * 2. 授课老师（users + teachers 表）
 * 3. 班级（classes 表）
 * 4. 学生（students 表）
 * 5. 学生-班级关联（student_classes 表）
 * 6. 学生的教务老师关联（admin_teacher_id）
 */

import { parseArgs } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { config as dotenvConfig } from 'dotenv';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import {
  users,
  teachers,
  classes,
  students,
  studentClasses,
} from '@/storage/database/shared/schema';
import * as schema from '@/storage/database/shared/schema';
import type { User, Teacher, Student } from '@/storage/database/shared/schema';

type Class = typeof classes.$inferSelect;
import { z } from 'zod';

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

// ============== 输入数据类型与校验 ==============

const inputTeacherSchema = z.object({
  name: z.string().min(1),
});

const inputClassSchema = z.object({
  name: z.string().min(1),
  teacher: z.string().min(1),
  day: z.string(),
  time: z.string(),
  course: z.string(),
  students: z.array(z.string().min(1)),
});

const inputStudentSchema = z.object({
  name: z.string().min(1),
  teachers: z.array(z.string().min(1)),
  classNames: z.array(z.string().min(1)),
  adminTeacher: z.string().nullable().optional(),
});

const scheduleInputSchema = z.object({
  teachers: z.array(inputTeacherSchema),
  classes: z.array(inputClassSchema),
  students: z.array(inputStudentSchema),
});

export type ScheduleInput = z.infer<typeof scheduleInputSchema>;

export type ParsedSchedule = {
  adminTeachers: AdminTeacherInput[];
  teachingTeachers: TeachingTeacherInput[];
  classes: ClassInput[];
  students: StudentInput[];
};

export type AdminTeacherInput = {
  name: string;
  username: string;
  email: string;
};

export type TeachingTeacherInput = {
  name: string;
  username: string;
  email: string;
};

export type ClassInput = {
  name: string;
  teacher: string;
  day: string;
  time: string;
  course: string;
  students: string[];
};

export type StudentInput = {
  name: string;
  teachers: string[];
  classNames: string[];
  adminTeacher: string | null;
};

export type ImportResult = {
  adminTeachersCreated: number;
  teachersCreated: number;
  classesCreated: number;
  studentsCreated: number;
  studentClassesCreated: number;
  adminTeacherUpdates: number;
  errors: string[];
};

// 教务老师配置
export const ADMIN_TEACHERS: AdminTeacherInput[] = [
  { name: '心心', username: 'xinxin', email: 'xinxin@school.com' },
  { name: '燕子', username: 'yanzi', email: 'yanzi@school.com' },
  { name: '睿睿', username: 'ruirui', email: 'ruirui@school.com' },
];

// ============== 解析函数 ==============

export function deriveTeacherEmail(name: string): string {
  const normalized = name.toLowerCase().replace(/\s+/g, '');
  return `${normalized}@school.com`;
}

export function deriveTeacherUsername(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '');
}

export function deriveGrade(course: string): string {
  if (course.includes('小小乐高')) return '幼儿';
  if (course.includes('百变') || course.includes('生活')) return '幼儿';
  if (course.includes('BQ') || course.includes('wedo') || course.includes('Wedo')) return '小学低年级';
  if (course.includes('spike')) return '小学中高年级';
  if (course.includes('scratch')) return '小学';
  if (course.includes('python') || course.includes('C++')) return '小学高年级';
  if (course.includes('wrc')) return '小学高年级';
  return '小学';
}

export function parseScheduleData(raw: unknown): ParsedSchedule {
  const data = scheduleInputSchema.parse(raw);

  const teachingTeachers = data.teachers.map((t) => {
    const username = deriveTeacherUsername(t.name);
    return {
      name: t.name,
      username,
      email: deriveTeacherEmail(t.name),
    };
  });

  return {
    adminTeachers: ADMIN_TEACHERS,
    teachingTeachers,
    classes: data.classes,
    students: data.students.map((s) => ({
      name: s.name,
      teachers: s.teachers,
      classNames: s.classNames,
      adminTeacher: s.adminTeacher ?? null,
    })),
  };
}

// ============== 唯一键生成辅助函数 ==============

function generateUniqueUsername(base: string, usedUsernames: Set<string>): string {
  if (!usedUsernames.has(base)) return base;
  let i = 1;
  while (usedUsernames.has(`${base}${i}`)) {
    i++;
  }
  return `${base}${i}`;
}

function generateUniqueEmail(base: string, usedEmails: Set<string>): string {
  if (!usedEmails.has(base)) return base;
  const localPart = base.replace(/@school\.com$/, '');
  let i = 1;
  while (usedEmails.has(`${localPart}${i}@school.com`)) {
    i++;
  }
  return `${localPart}${i}@school.com`;
}

// ============== 导入逻辑 ==============

export async function importSchedule(
  db: Db,
  input: string | ParsedSchedule,
  options: {
    verbose?: boolean;
    defaultPassword?: string;
  } = {}
): Promise<ImportResult> {
  const { verbose = false, defaultPassword = 'teacher123' } = options;

  const parsed = typeof input === 'string'
    ? parseScheduleData(JSON.parse(fs.readFileSync(input, 'utf-8')))
    : input;

  // 在事务外预先加载现有数据，避免事务内依赖捕获唯一约束异常
  const existingUsers = await db.select().from(users);
  const existingTeachers = await db.select().from(teachers);
  const existingClasses = await db.select().from(classes);
  const existingStudents = await db.select().from(students);
  const existingSC = await db.select().from(studentClasses);

  const userMap = new Map<string, User>(existingUsers.map((u) => [u.username, u]));
  const teacherMap = new Map<string, Teacher>(existingTeachers.map((t) => [t.name, t]));
  const classMap = new Map<string, Class>(existingClasses.map((c) => [`${c.teacherId}:${c.name}`, c]));
  const studentMap = new Map<string, Student>(existingStudents.map((s) => [s.name, s]));
  const scSet = new Set<string>(existingSC.map((sc) => `${sc.studentId}:${sc.classId}`));

  const usedUsernames = new Set<string>(existingUsers.map((u) => u.username));
  const usedEmails = new Set<string>(existingTeachers.map((t) => t.email));

  if (verbose) {
    console.log(`  现有用户: ${existingUsers.length}`);
    console.log(`  现有老师: ${existingTeachers.length}`);
    console.log(`  现有班级: ${existingClasses.length}`);
    console.log(`  现有学生: ${existingStudents.length}`);
  }

  return db.transaction(async (tx) => {
    const result: ImportResult = {
      adminTeachersCreated: 0,
      teachersCreated: 0,
      classesCreated: 0,
      studentsCreated: 0,
      studentClassesCreated: 0,
      adminTeacherUpdates: 0,
      errors: [],
    };

    // Step 1: 创建教务老师
    const adminTeacherIdMap = new Map<string, string>();

    for (const admin of parsed.adminTeachers) {
      const existing = teacherMap.get(admin.name);
      if (existing) {
        adminTeacherIdMap.set(admin.name, existing.id);
        if (verbose) console.log(`  ⏭ 教务老师已存在: ${admin.name} (${existing.id})`);
        continue;
      }

      const hashedPassword = await bcrypt.hash(defaultPassword, 10);

      let user = userMap.get(admin.username);
      if (!user) {
        const uniqueUsername = generateUniqueUsername(admin.username, usedUsernames);
        const uniqueEmail = generateUniqueEmail(admin.email, usedEmails);

        try {
          [user] = await tx
            .insert(users)
            .values({ username: uniqueUsername, password: hashedPassword, name: admin.name, role: 'teacher' })
            .returning();
          usedUsernames.add(uniqueUsername);
        } catch (error) {
          throw new Error(`创建教务老师用户失败: ${admin.name} - ${(error as Error).message}`);
        }

        try {
          const [newTeacher] = await tx
            .insert(teachers)
            .values({ id: user.id, name: admin.name, email: uniqueEmail, role: 'admin' })
            .returning();
          usedEmails.add(uniqueEmail);
          teacherMap.set(admin.name, newTeacher);
          adminTeacherIdMap.set(admin.name, newTeacher.id);
          result.adminTeachersCreated++;
          if (verbose) console.log(`  ✅ 创建教务老师: ${admin.name} (${newTeacher.id})`);
        } catch (error) {
          throw new Error(`创建教务老师失败: ${admin.name} - ${(error as Error).message}`);
        }
      } else {
        adminTeacherIdMap.set(admin.name, user.id);
      }
    }

    // Step 2: 创建授课老师
    const teachingTeacherIdMap = new Map<string, string>();

    for (const teacher of parsed.teachingTeachers) {
      const existing = teacherMap.get(teacher.name);
      if (existing) {
        teachingTeacherIdMap.set(teacher.name, existing.id);
        if (verbose) console.log(`  ⏭ 授课老师已存在: ${teacher.name} (${existing.id})`);
        continue;
      }

      const hashedPassword = await bcrypt.hash(defaultPassword, 10);
      const baseUsername = teacher.username;
      const baseEmail = teacher.email;
      const uniqueUsername = generateUniqueUsername(baseUsername, usedUsernames);
      const uniqueEmail = generateUniqueEmail(baseEmail, usedEmails);

      let newUser: User;
      try {
        [newUser] = await tx
          .insert(users)
          .values({ username: uniqueUsername, password: hashedPassword, name: teacher.name, role: 'teacher' })
          .returning();
        usedUsernames.add(uniqueUsername);
      } catch (error) {
        throw new Error(`创建授课老师用户失败: ${teacher.name} - ${(error as Error).message}`);
      }

      try {
        const [newTeacher] = await tx
          .insert(teachers)
          .values({ id: newUser.id, name: teacher.name, email: uniqueEmail, role: 'teacher' })
          .returning();
        usedEmails.add(uniqueEmail);
        teachingTeacherIdMap.set(teacher.name, newTeacher.id);
        teacherMap.set(teacher.name, newTeacher);
        result.teachersCreated++;
        if (verbose) console.log(`  ✅ 创建授课老师: ${teacher.name} (${newTeacher.id})`);
      } catch (error) {
        throw new Error(`创建授课老师失败: ${teacher.name} - ${(error as Error).message}`);
      }
    }

    // Step 3: 创建班级（使用老师 ID + 班级名的复合键）
    const classIdMap = new Map<string, string>();

    for (const cls of parsed.classes) {
      const teacherId = teachingTeacherIdMap.get(cls.teacher) ?? adminTeacherIdMap.get(cls.teacher);
      if (!teacherId) {
        result.errors.push(`创建班级失败: 找不到老师 ${cls.teacher} (班级: ${cls.name})`);
        continue;
      }

      const existingClass = classMap.get(`${teacherId}:${cls.name}`);
      if (existingClass) {
        classIdMap.set(`${teacherId}:${cls.name}`, existingClass.id);
        if (verbose) console.log(`  ⏭ 班级已存在: ${cls.name}`);
        continue;
      }

      const grade = deriveGrade(cls.course);
      const schedule = `${cls.day} ${cls.time}`;

      try {
        const [newClass] = await tx
          .insert(classes)
          .values({ name: cls.name, teacherId, grade, schedule })
          .returning();
        classIdMap.set(`${teacherId}:${cls.name}`, newClass.id);
        classMap.set(`${teacherId}:${cls.name}`, newClass);
        result.classesCreated++;
        if (verbose) console.log(`  ✅ 创建班级: ${cls.name} (${newClass.id})`);
      } catch (error) {
        throw new Error(`创建班级失败: ${cls.name} - ${(error as Error).message}`);
      }
    }

    // Step 4: 创建学生
    for (const student of parsed.students) {
      const existingStudent = studentMap.get(student.name);
      if (existingStudent) {
        continue;
      }

      const primaryClassName = student.classNames[0];
      const primaryTeacherName = student.teachers[0];
      const primaryTeacherId = primaryTeacherName ? teachingTeacherIdMap.get(primaryTeacherName) : undefined;
      const primaryClassId = primaryClassName && primaryTeacherId
        ? classIdMap.get(`${primaryTeacherId}:${primaryClassName}`)
        : undefined;
      const adminTeacherId = student.adminTeacher ? adminTeacherIdMap.get(student.adminTeacher) : null;

      try {
        const [newStudent] = await tx
          .insert(students)
          .values({
            name: student.name,
            classId: primaryClassId || null,
            currentTeacherId: primaryTeacherId || null,
            currentClass: primaryClassName || null,
            adminTeacherId: adminTeacherId || null,
          })
          .returning();
        studentMap.set(student.name, newStudent);
        result.studentsCreated++;
        if (verbose) console.log(`  ✅ 创建学生: ${student.name}`);
      } catch (error) {
        throw new Error(`创建学生失败: ${student.name} - ${(error as Error).message}`);
      }
    }

    // Step 5: 创建学生班级关联
    for (const student of parsed.students) {
      const studentData = studentMap.get(student.name);
      if (!studentData) {
        result.errors.push(`找不到学生 ID: ${student.name}`);
        continue;
      }

      for (let i = 0; i < student.classNames.length; i++) {
        const className = student.classNames[i];
        const primaryTeacherName = student.teachers[0];
        const primaryTeacherId = primaryTeacherName ? teachingTeacherIdMap.get(primaryTeacherName) : undefined;

        // 学生所在班级优先用其授课老师对应的班级；若找不到，尝试用班级名对应任一老师
        let classId: string | undefined = primaryTeacherId
          ? classIdMap.get(`${primaryTeacherId}:${className}`)
          : undefined;

        if (!classId) {
          // 兼容：按班级名反向查找第一个匹配的班级
          const matched = parsed.classes.find((c) => c.name === className);
          if (matched) {
            const matchedTeacherId = teachingTeacherIdMap.get(matched.teacher) ?? adminTeacherIdMap.get(matched.teacher);
            if (matchedTeacherId) {
              classId = classIdMap.get(`${matchedTeacherId}:${className}`);
            }
          }
        }

        if (!classId) {
          result.errors.push(`找不到班级 ID: ${className} (学生: ${student.name})`);
          continue;
        }

        const scKey = `${studentData.id}:${classId}`;
        if (scSet.has(scKey)) {
          continue;
        }

        const isPrimary = i === 0;

        try {
          await tx
            .insert(studentClasses)
            .values({ studentId: studentData.id, classId, isPrimary });
          scSet.add(scKey);
          result.studentClassesCreated++;
        } catch (error) {
          throw new Error(`创建学生班级关联失败: ${student.name} -> ${className} - ${(error as Error).message}`);
        }
      }
    }

    // Step 6: 更新已存在学生的教务老师
    for (const student of parsed.students) {
      if (!student.adminTeacher) continue;

      const studentData = studentMap.get(student.name);
      if (!studentData) continue;
      if (studentData.adminTeacherId) continue;

      const adminId = adminTeacherIdMap.get(student.adminTeacher);
      if (!adminId) {
        result.errors.push(`找不到教务老师 ID: ${student.adminTeacher}`);
        continue;
      }

      try {
        await tx
          .update(students)
          .set({ adminTeacherId: adminId })
          .where(eq(students.id, studentData.id));
        result.adminTeacherUpdates++;
      } catch (error) {
        throw new Error(`更新教务老师失败: ${student.name} - ${(error as Error).message}`);
      }
    }

    return result;
  });
}

export function runDryRun(parsed: ParsedSchedule, verbose: boolean): ImportResult {
  console.log('========================================');
  console.log('课表数据导入脚本 [DRY RUN]');
  console.log('========================================\n');

  console.log(`  教务老师: ${parsed.adminTeachers.length}`);
  console.log(`  授课老师: ${parsed.teachingTeachers.length}`);
  console.log(`  班级: ${parsed.classes.length}`);
  console.log(`  学生: ${parsed.students.length}`);

  const studentClassCount = parsed.students.reduce(
    (sum, s) => sum + s.classNames.length,
    0
  );
  console.log(`  学生班级关联: ${studentClassCount}\n`);

  if (verbose) {
    console.log('--- 教务老师 ---');
    parsed.adminTeachers.forEach((t) => console.log(`  ${t.name} <${t.email}>`));
    console.log('--- 授课老师 ---');
    parsed.teachingTeachers.forEach((t) => console.log(`  ${t.name} <${t.email}>`));
    console.log('--- 班级 ---');
    parsed.classes.forEach((c) =>
      console.log(`  ${c.name} | ${c.teacher} | ${c.course} | ${deriveGrade(c.course)} | ${c.day} ${c.time}`)
    );
    console.log('--- 学生示例 ---');
    parsed.students.slice(0, 5).forEach((s) => {
      console.log(
        `  ${s.name} | 班级: ${s.classNames.join(', ')} | 教务老师: ${s.adminTeacher ?? '无'}`
      );
    });
    if (parsed.students.length > 5) {
      console.log(`  ... 还有 ${parsed.students.length - 5} 名学生`);
    }
  }

  console.log('\n✅ dry-run 完成，未写入数据库');

  return {
    adminTeachersCreated: parsed.adminTeachers.length,
    teachersCreated: parsed.teachingTeachers.length,
    classesCreated: parsed.classes.length,
    studentsCreated: parsed.students.length,
    studentClassesCreated: studentClassCount,
    adminTeacherUpdates: 0,
    errors: [],
  };
}

// ============== CLI ==============

function printResult(result: ImportResult): void {
  console.log('\n========================================');
  console.log('导入结果汇总');
  console.log('========================================');
  console.log(`  授课老师创建: ${result.teachersCreated}`);
  console.log(`  教务老师创建: ${result.adminTeachersCreated}`);
  console.log(`  班级创建: ${result.classesCreated}`);
  console.log(`  学生创建: ${result.studentsCreated}`);
  console.log(`  学生班级关联创建: ${result.studentClassesCreated}`);
  console.log(`  教务老师更新: ${result.adminTeacherUpdates}`);

  if (result.errors.length > 0) {
    console.log(`\n  ❌ 错误 (${result.errors.length}):`);
    result.errors.forEach((e) => console.log(`    - ${e}`));
  } else {
    console.log('\n  ✅ 无错误');
  }
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      input: { type: 'string', short: 'i' },
      env: { type: 'string', short: 'e' },
      'dry-run': { type: 'boolean', default: false },
      verbose: { type: 'boolean', short: 'v', default: false },
    },
  });

  const inputPath = values.input
    ? path.resolve(values.input)
    : path.resolve(__dirname, 'schedule-data.json');
  const envPath = values.env ? path.resolve(values.env) : path.resolve(__dirname, '..', '.env');
  const dryRun = values['dry-run'] ?? false;
  const verbose = values.verbose ?? false;

  if (!fs.existsSync(inputPath)) {
    console.error(`错误：找不到输入文件 ${inputPath}`);
    process.exit(1);
  }

  dotenvConfig({ path: envPath });

  const defaultPassword = process.env.DEFAULT_TEACHER_PASSWORD || 'teacher123';

  console.log('========================================');
  console.log('课表数据导入脚本');
  console.log('========================================\n');
  console.log(`输入文件: ${inputPath}`);
  console.log(`环境文件: ${envPath}`);
  console.log(`dry-run:  ${dryRun}`);

  const parsed = parseScheduleData(JSON.parse(fs.readFileSync(inputPath, 'utf-8')));

  if (dryRun) {
    const result = runDryRun(parsed, verbose);
    if (result.errors.length > 0) {
      process.exitCode = 1;
    }
    return;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('错误：请设置 DATABASE_URL 环境变量');
    process.exit(1);
  }

  const { db } = await import('@/storage/database/drizzle-client');
  const result = await importSchedule(db, parsed, { verbose, defaultPassword });

  printResult(result);

  if (result.errors.length > 0) {
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err) => {
    console.error('导入脚本执行失败:', err);
    process.exit(1);
  });
}
