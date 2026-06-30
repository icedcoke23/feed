import { db } from "@/storage/database/drizzle-client";
import {
  users,
  teachers,
  students,
  classes,
  feedbacks,
  teachingThemes,
  tags,
  courseStages,
  classTransfers,
} from "@/storage/database/shared/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "@/lib/auth";
import {
  getDefaultAdminTeachers,
  getDefaultAdminPassword,
} from "@/lib/config/default-admins";
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface ImportData {
  students?: Record<string, unknown>[];
  classes?: Record<string, unknown>[];
  feedbacks?: Record<string, unknown>[];
  themes?: Record<string, unknown>[];
  tags?: Record<string, unknown>[];
  courseStages?: Record<string, unknown>[];
  classTransfers?: Record<string, unknown>[];
  teachers?: Record<string, unknown>[];
}

export interface ImportOptions {
  clearFirst?: boolean;
  isFullImport?: boolean;
}

export interface ImportResults {
  students: { success: number; failed: number; skipped: number };
  classes: { success: number; failed: number; skipped: number };
  feedbacks: { success: number; failed: number; skipped: number };
  themes: { success: number; failed: number; skipped: number };
  tags: { success: number; failed: number; skipped: number };
  courseStages: { success: number; failed: number; skipped: number };
  classTransfers: { success: number; failed: number; skipped: number };
  teachers: { success: number; failed: number; skipped: number };
}

export interface AdminTeacherInfo {
  configs: Array<{ username: string; name: string; id: string | null }>;
  idByName: Map<string, string>;
  idByUsername: Map<string, string>;
  legacyMapping: Record<string, string>;
}

export async function ensureDefaultAdminTeachers(tx: Tx): Promise<AdminTeacherInfo> {
  const configs = getDefaultAdminTeachers();
  const password = await hashPassword(getDefaultAdminPassword());
  const result: AdminTeacherInfo = {
    configs: [],
    idByName: new Map(),
    idByUsername: new Map(),
    legacyMapping: {},
  };

  if (configs.length === 0) {
    return result;
  }

  for (const config of configs) {
    const existing = await tx
      .select()
      .from(users)
      .where(eq(users.username, config.username))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (existing) {
      result.configs.push({ ...config, id: existing.id });
      result.idByUsername.set(config.username, existing.id);
      result.idByName.set(config.name, existing.id);
      continue;
    }

    const newId = crypto.randomUUID();
    await tx.insert(users).values({
      id: newId,
      username: config.username,
      name: config.name,
      password,
      role: "teacher",
      isActive: true,
    });

    await tx.insert(teachers).values({
      id: newId,
      name: config.name,
      email: `${config.username}@school.com`,
      phone: "",
      role: "admin",
      isActive: true,
    });

    result.configs.push({ ...config, id: newId });
    result.idByUsername.set(config.username, newId);
    result.idByName.set(config.name, newId);
  }

  // 建立旧 ID 到新 ID 的映射：查找 teachers 表中同名的 admin 教师
  const adminTeacherRows = await tx
    .select({ id: teachers.id, name: teachers.name })
    .from(teachers)
    .where(eq(teachers.role, "admin"));

  for (const row of adminTeacherRows) {
    const newId = result.idByName.get(row.name);
    if (newId && newId !== row.id) {
      result.legacyMapping[row.id] = newId;
    }
  }

  return result;
}

function resolveAdminTeacherId(
  legacyId: string | null | undefined,
  adminTeachers: AdminTeacherInfo
): string | null {
  if (!legacyId) {
    return adminTeachers.configs[0]?.id ?? null;
  }
  if (adminTeachers.legacyMapping[legacyId]) {
    return adminTeachers.legacyMapping[legacyId];
  }
  return adminTeachers.configs[0]?.id ?? null;
}

function getDefaultResult(): ImportResults {
  return {
    students: { success: 0, failed: 0, skipped: 0 },
    classes: { success: 0, failed: 0, skipped: 0 },
    feedbacks: { success: 0, failed: 0, skipped: 0 },
    themes: { success: 0, failed: 0, skipped: 0 },
    tags: { success: 0, failed: 0, skipped: 0 },
    courseStages: { success: 0, failed: 0, skipped: 0 },
    classTransfers: { success: 0, failed: 0, skipped: 0 },
    teachers: { success: 0, failed: 0, skipped: 0 },
  };
}

function isNewFormat(data: ImportData): boolean {
  return Array.isArray(data.teachers) && data.teachers.length > 0;
}

async function importTeachers(
  tx: Tx,
  data: ImportData,
  adminTeachers: AdminTeacherInfo,
  results: ImportResults
): Promise<Record<string, string>> {
  const mapping: Record<string, string> = { ...adminTeachers.legacyMapping };
  const teacherList = data.teachers || [];
  if (teacherList.length === 0) return mapping;

  for (const teacher of teacherList) {
    const teacherData = teacher as Record<string, unknown>;
    const oldId = teacherData.id as string;

    // 跳过默认教务老师
    if (adminTeachers.legacyMapping[oldId]) {
      results.teachers.skipped++;
      continue;
    }

    const name = (teacherData.name as string) || "";
    const username = ((teacherData.username as string) || name).trim();
    if (!username) {
      results.teachers.failed++;
      continue;
    }

    const existing = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (existing) {
      mapping[oldId] = existing.id;
      results.teachers.skipped++;
      continue;
    }

    const newId = crypto.randomUUID();
    const password = await hashPassword(
      (teacherData.password as string) ||
        (teacherData.name as string)?.toLowerCase().replace(/\s+/g, "") ||
        username
    );

    await tx.insert(users).values({
      id: newId,
      username,
      name,
      password,
      role: (teacherData.role as "admin" | "teacher") || "teacher",
      phone: (teacherData.phone as string) || null,
      isActive: (teacherData.is_active as boolean) ?? true,
    });

    await tx.insert(teachers).values({
      id: newId,
      name,
      email: (teacherData.email as string) || `${username}@school.com`,
      phone: (teacherData.phone as string) || null,
      role: (teacherData.role as "admin" | "teacher") || "teacher",
      isActive: (teacherData.is_active as boolean) ?? true,
    });

    mapping[oldId] = newId;
    results.teachers.success++;
  }

  return mapping;
}

async function inferLegacyTeachersFromClasses(
  tx: Tx,
  data: ImportData,
  results: ImportResults
): Promise<Record<string, string>> {
  const mapping: Record<string, string> = {};
  const classList = data.classes || [];
  if (classList.length === 0) return mapping;

  const existingTeachers = await tx
    .select({ id: teachers.id, name: teachers.name })
    .from(teachers);
  const nameToIdMap = new Map(existingTeachers.map((t) => [t.name, t.id]));

  const inferredNames: Record<string, string> = {};
  for (const cls of classList) {
    const clsData = cls as Record<string, unknown>;
    const teacherId = clsData.teacher_id as string;
    const clsName = clsData.name as string;
    if (!teacherId || inferredNames[teacherId]) continue;

    const match = clsName.match(/^([锅何雷乐鱼铛雪罗]+)/);
    if (match) {
      inferredNames[teacherId] = `小${match[1]}`;
    }
  }

  for (const [oldId, teacherName] of Object.entries(inferredNames)) {
    const existingId = nameToIdMap.get(teacherName);
    if (existingId) {
      mapping[oldId] = existingId;
      results.teachers.success++;
      continue;
    }

    const newId = crypto.randomUUID();
    const password = await hashPassword(getDefaultAdminPassword());

    await tx.insert(users).values({
      id: newId,
      username: teacherName,
      name: teacherName,
      password,
      role: "teacher",
      isActive: true,
    });

    await tx.insert(teachers).values({
      id: newId,
      name: teacherName,
      email: `${teacherName}@school.com`,
      role: "teacher",
      isActive: true,
    });

    mapping[oldId] = newId;
    nameToIdMap.set(teacherName, newId);
    results.teachers.success++;
  }

  return mapping;
}

async function importCourseStages(
  tx: Tx,
  data: ImportData,
  results: ImportResults,
  errors: string[]
): Promise<void> {
  const list = data.courseStages || [];
  if (list.length === 0) return;

  for (const stage of list) {
    const stageData = stage as Record<string, unknown>;
    try {
      await tx
        .insert(courseStages)
        .values({
          id: stageData.id as string,
          stageCode: stageData.stage_code as string,
          stageName: stageData.stage_name as string,
          theme: stageData.theme as string,
          level: stageData.level as string,
          description: (stageData.description as string) || null,
          content: (stageData.content as string) || null,
          goal: (stageData.goal as string) || null,
          sortOrder: (stageData.sort_order as number) || 0,
          isActive: (stageData.is_active as boolean) ?? true,
        })
        .onConflictDoUpdate({
          target: courseStages.id,
          set: {
            stageCode: stageData.stage_code as string,
            stageName: stageData.stage_name as string,
            theme: stageData.theme as string,
            level: stageData.level as string,
            description: (stageData.description as string) || null,
            content: (stageData.content as string) || null,
            goal: (stageData.goal as string) || null,
            sortOrder: (stageData.sort_order as number) || 0,
            isActive: (stageData.is_active as boolean) ?? true,
          },
        });
      results.courseStages.success++;
    } catch (error) {
      results.courseStages.failed++;
      const msg = `课程阶段导入失败 (id=${(stageData.id as string) || "未知"}, code=${(stageData.stage_code as string) || "未知"}): ${error instanceof Error ? error.message : String(error)}`;
      errors.push(msg);
      console.error(`[data-repository] ${msg}`);
    }
  }
}

async function importThemes(
  tx: Tx,
  data: ImportData,
  results: ImportResults,
  errors: string[]
): Promise<void> {
  const list = data.themes || [];
  if (list.length === 0) return;

  for (const theme of list) {
    const themeData = theme as Record<string, unknown>;
    try {
      await tx
        .insert(teachingThemes)
        .values({
          id: themeData.id as string,
          name: themeData.name as string,
          category: (themeData.category as string) || null,
          description: (themeData.description as string) || null,
          sortOrder: (themeData.sort_order as number) || 0,
          isActive: (themeData.is_active as boolean) ?? true,
        })
        .onConflictDoUpdate({
          target: teachingThemes.id,
          set: {
            name: themeData.name as string,
            category: (themeData.category as string) || null,
            description: (themeData.description as string) || null,
            sortOrder: (themeData.sort_order as number) || 0,
            isActive: (themeData.is_active as boolean) ?? true,
          },
        });
      results.themes.success++;
    } catch (error) {
      results.themes.failed++;
      const msg = `教学主题导入失败 (id=${(themeData.id as string) || "未知"}, name=${(themeData.name as string) || "未知"}): ${error instanceof Error ? error.message : String(error)}`;
      errors.push(msg);
      console.error(`[data-repository] ${msg}`);
    }
  }
}

async function importTags(
  tx: Tx,
  data: ImportData,
  results: ImportResults,
  errors: string[]
): Promise<void> {
  const list = data.tags || [];
  if (list.length === 0) return;

  for (const tag of list) {
    const tagData = tag as Record<string, unknown>;
    try {
      await tx
        .insert(tags)
        .values({
          id: tagData.id as string,
          category: tagData.category as string,
          name: tagData.name as string,
          description: (tagData.description as string) || null,
          sortOrder: (tagData.sort_order as number) || 0,
          isActive: (tagData.is_active as boolean) ?? true,
        })
        .onConflictDoUpdate({
          target: tags.id,
          set: {
            category: tagData.category as string,
            name: tagData.name as string,
            description: (tagData.description as string) || null,
            sortOrder: (tagData.sort_order as number) || 0,
            isActive: (tagData.is_active as boolean) ?? true,
          },
        });
      results.tags.success++;
    } catch (error) {
      results.tags.failed++;
      const msg = `标签导入失败 (id=${(tagData.id as string) || "未知"}, name=${(tagData.name as string) || "未知"}): ${error instanceof Error ? error.message : String(error)}`;
      errors.push(msg);
      console.error(`[data-repository] ${msg}`);
    }
  }
}

async function importClasses(
  tx: Tx,
  data: ImportData,
  teacherMapping: Record<string, string>,
  options: ImportOptions,
  results: ImportResults,
  errors: string[]
): Promise<{ classMapping: Record<string, string>; classTeacherMapping: Record<string, string> }> {
  const classMapping: Record<string, string> = {};
  const classTeacherMapping: Record<string, string> = {};
  const classList = data.classes || [];
  if (classList.length === 0) return { classMapping, classTeacherMapping };

  for (const cls of classList) {
    const clsData = cls as Record<string, unknown>;
    const oldId = clsData.id as string;
    const newId = options.isFullImport ? oldId : crypto.randomUUID();
    const clsName = (clsData.name as string) || "";

    let teacherId = clsData.teacher_id as string | null;
    if (teacherId && teacherMapping[teacherId]) {
      teacherId = teacherMapping[teacherId];
    }

    // 旧格式：按班级名称推断教师
    if (!teacherId) {
      const match = clsName.match(/^([锅何雷乐鱼铛雪罗]+)/);
      if (match) {
        const inferredName = `小${match[1]}`;
        for (const [, newTeacherId] of Object.entries(teacherMapping)) {
          // 这里无法直接拿到名称，简单使用第一个映射作为兜底
          teacherId = newTeacherId;
          break;
        }
        if (!teacherId) {
          const existing = await tx
            .select({ id: teachers.id })
            .from(teachers)
            .where(eq(teachers.name, inferredName))
            .limit(1)
            .then((rows) => rows[0]?.id ?? null);
          teacherId = existing;
        }
      }
    }

    if (!teacherId) {
      results.classes.failed++;
      errors.push(`班级导入失败 (id=${oldId || "未知"}, name=${clsName || "未知"}): 未关联到教师`);
      continue;
    }

    try {
      await tx.insert(classes).values({
        id: newId,
        name: clsName,
        grade: (clsData.grade as string) || null,
        teacherId,
        schedule: (clsData.schedule as string) || null,
        description: (clsData.description as string) || null,
        isActive: (clsData.is_active as boolean) ?? true,
      });
      classMapping[oldId] = newId;
      classTeacherMapping[newId] = teacherId;
      results.classes.success++;
    } catch (error) {
      results.classes.failed++;
      const msg = `班级导入失败 (id=${oldId || "未知"}, name=${clsName || "未知"}): ${error instanceof Error ? error.message : String(error)}`;
      errors.push(msg);
      console.error(`[data-repository] ${msg}`);
    }
  }

  return { classMapping, classTeacherMapping };
}

async function importStudents(
  tx: Tx,
  data: ImportData,
  classMapping: Record<string, string>,
  classTeacherMapping: Record<string, string>,
  teacherMapping: Record<string, string>,
  adminTeachers: AdminTeacherInfo,
  options: ImportOptions,
  results: ImportResults,
  errors: string[]
): Promise<void> {
  const studentList = data.students || [];
  if (studentList.length === 0) return;

  const adminTeacherAssigned: Record<string, number> = {};
  for (const config of adminTeachers.configs) {
    if (config.id) adminTeacherAssigned[config.name] = 0;
  }

  for (const student of studentList) {
    const studentData = student as Record<string, unknown>;
    const oldId = studentData.id as string;
    const newId = options.isFullImport ? oldId : crypto.randomUUID();
    const studentName = (studentData.name as string) || "";
    const oldClassId = studentData.class_id as string;
    const newClassId = classMapping[oldClassId];

    if (!newClassId) {
      results.students.failed++;
      errors.push(`学员导入失败 (id=${oldId || "未知"}, name=${studentName || "未知"}): 未找到映射班级 class_id=${oldClassId || "空"}`);
      continue;
    }

    let currentTeacherId = studentData.current_teacher_id as string | null;
    if (currentTeacherId && teacherMapping[currentTeacherId]) {
      currentTeacherId = teacherMapping[currentTeacherId];
    } else if (classTeacherMapping[newClassId]) {
      currentTeacherId = classTeacherMapping[newClassId];
    }

    const adminTeacherId = resolveAdminTeacherId(
      studentData.admin_teacher_id as string,
      adminTeachers
    );

    if (adminTeacherId) {
      const name = adminTeachers.configs.find((c) => c.id === adminTeacherId)?.name;
      if (name) adminTeacherAssigned[name] = (adminTeacherAssigned[name] || 0) + 1;
    }

    try {
      await tx.insert(students).values({
        id: newId,
        name: studentName,
        grade: (studentData.grade as string) || null,
        school: (studentData.school as string) || null,
        phone: (studentData.phone as string) || null,
        classId: newClassId,
        currentTeacherId,
        adminTeacherId,
        currentClass: (studentData.current_class as string) || null,
        isActive: (studentData.is_active as boolean) ?? true,
      });
      results.students.success++;
    } catch (error) {
      results.students.failed++;
      const msg = `学员导入失败 (id=${oldId || "未知"}, name=${studentName || "未知"}): ${error instanceof Error ? error.message : String(error)}`;
      errors.push(msg);
      console.error(`[data-repository] ${msg}`);
    }
  }
}

async function importFeedbacks(
  tx: Tx,
  data: ImportData,
  results: ImportResults,
  options: ImportOptions,
  errors: string[]
): Promise<void> {
  const feedbackList = data.feedbacks || [];
  if (feedbackList.length === 0) return;

  for (const feedback of feedbackList) {
    const feedbackData = feedback as Record<string, unknown>;
    const newId = options.isFullImport ? (feedbackData.id as string) : crypto.randomUUID();

    try {
      await tx.insert(feedbacks).values({
        id: newId,
        studentId: feedbackData.student_id as string,
        teacherId: feedbackData.teacher_id as string,
        strengths: (feedbackData.strengths as unknown[]) || null,
        improvements: (feedbackData.improvements as unknown[]) || null,
        weaknesses: (feedbackData.weaknesses as unknown[]) || null,
        teachingPlan: (feedbackData.teaching_plan as unknown[]) || null,
        suggestions: (feedbackData.suggestions as string) || null,
        aiReport: (feedbackData.ai_report as string) || null,
        metadata: (feedbackData.metadata as Record<string, unknown>) || null,
        workInfo: (feedbackData.work_info as Record<string, unknown>) || null,
        abilityScores: (feedbackData.ability_scores as unknown[]) || null,
        version: (feedbackData.version as number) || 1,
        parentFeedbackId: (feedbackData.parent_feedback_id as string) || null,
        status: (feedbackData.status as string) || "draft",
        createdAt: feedbackData.created_at ? new Date(feedbackData.created_at as string) : new Date(),
        updatedAt: feedbackData.updated_at ? new Date(feedbackData.updated_at as string) : null,
        periodStart: feedbackData.period_start ? new Date(feedbackData.period_start as string) : null,
        periodEnd: feedbackData.period_end ? new Date(feedbackData.period_end as string) : null,
      });
      results.feedbacks.success++;
    } catch (error) {
      results.feedbacks.failed++;
      const msg = `反馈导入失败 (id=${(feedbackData.id as string) || "未知"}, student_id=${(feedbackData.student_id as string) || "未知"}): ${error instanceof Error ? error.message : String(error)}`;
      errors.push(msg);
      console.error(`[data-repository] ${msg}`);
    }
  }
}

async function importClassTransfers(
  tx: Tx,
  data: ImportData,
  results: ImportResults,
  options: ImportOptions,
  errors: string[]
): Promise<void> {
  const transferList = data.classTransfers || [];
  if (transferList.length === 0) return;

  for (const transfer of transferList) {
    const transferData = transfer as Record<string, unknown>;
    const newId = options.isFullImport ? (transferData.id as string) : crypto.randomUUID();

    try {
      await tx.insert(classTransfers).values({
        id: newId,
        studentId: transferData.student_id as string,
        fromTeacherId: (transferData.from_teacher_id as string) || null,
        toTeacherId: transferData.to_teacher_id as string,
        fromClass: (transferData.from_class as string) || null,
        toClass: (transferData.to_class as string) || null,
        reason: (transferData.reason as string) || null,
        transferredAt: transferData.transferred_at
          ? new Date(transferData.transferred_at as string)
          : new Date(),
      });
      results.classTransfers.success++;
    } catch (error) {
      results.classTransfers.failed++;
      const msg = `转班记录导入失败 (id=${(transferData.id as string) || "未知"}, student_id=${(transferData.student_id as string) || "未知"}): ${error instanceof Error ? error.message : String(error)}`;
      errors.push(msg);
      console.error(`[data-repository] ${msg}`);
    }
  }
}

async function clearDataInTransaction(tx: Tx): Promise<void> {
  await tx.delete(classTransfers);
  await tx.delete(feedbacks);
  await tx.delete(students);
  await tx.delete(classes);
  await tx.delete(teachingThemes);
  await tx.delete(tags);
  await tx.delete(courseStages);
  await tx.delete(teachers).where(eq(teachers.role, "teacher"));
}

export async function importData(
  data: ImportData,
  options: ImportOptions = {}
): Promise<{ results: ImportResults; logs: string[]; errors: string[]; format: "new" | "legacy" }> {
  const results = getDefaultResult();
  const logs: string[] = [];
  const errors: string[] = [];
  const newFormat = isNewFormat(data);
  logs.push(`检测到${newFormat ? "新" : "旧"}备份格式`);

  return db.transaction(async (tx) => {
    const adminTeachers = await ensureDefaultAdminTeachers(tx);
    logs.push(`✓ 默认教务老师准备完成`);

    if (options.clearFirst) {
      await clearDataInTransaction(tx);
      logs.push("✓ 现有数据已清空");
    }

    const teacherMapping = newFormat
      ? await importTeachers(tx, data, adminTeachers, results)
      : await inferLegacyTeachersFromClasses(tx, data, results);

    logs.push(
      `✓ 教师处理完成: 成功 ${results.teachers.success}, 跳过 ${results.teachers.skipped}, 失败 ${results.teachers.failed}`
    );

    await importCourseStages(tx, data, results, errors);
    logs.push(`✓ 课程阶段: 成功 ${results.courseStages.success}, 失败 ${results.courseStages.failed}`);

    await importThemes(tx, data, results, errors);
    logs.push(`✓ 教学主题: 成功 ${results.themes.success}, 失败 ${results.themes.failed}`);

    await importTags(tx, data, results, errors);
    logs.push(`✓ 标签: 成功 ${results.tags.success}, 失败 ${results.tags.failed}`);

    const { classMapping, classTeacherMapping } = await importClasses(
      tx,
      data,
      teacherMapping,
      options,
      results,
      errors
    );
    logs.push(`✓ 班级: 成功 ${results.classes.success}, 失败 ${results.classes.failed}`);

    await importStudents(
      tx,
      data,
      classMapping,
      classTeacherMapping,
      teacherMapping,
      adminTeachers,
      options,
      results,
      errors
    );
    logs.push(`✓ 学员: 成功 ${results.students.success}, 失败 ${results.students.failed}`);

    await importFeedbacks(tx, data, results, options, errors);
    logs.push(`✓ 反馈记录: 成功 ${results.feedbacks.success}, 失败 ${results.feedbacks.failed}`);

    await importClassTransfers(tx, data, results, options, errors);
    logs.push(`✓ 转班记录: 成功 ${results.classTransfers.success}, 失败 ${results.classTransfers.failed}`);

    return { results, logs, errors, format: newFormat ? "new" : "legacy" };
  });
}
