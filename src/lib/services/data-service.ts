import { db, withTransaction } from "@/storage/database/drizzle-client";
import {
  students,
  classes,
  feedbacks,
  teachingThemes,
  tags,
  courseStages,
  classTransfers,
  teachers,
  users,
  aiSettings,
  coursePrompts,
} from "@/storage/database/shared/schema";
import { eq, inArray } from "drizzle-orm";
import * as dataRepo from "@/lib/repositories/data-repository";
import { hashPassword } from "@/lib/auth";
import type { Database } from "@/storage/database/types";

export interface ExportData {
  exportTime: string;
  version: string;
  description: string;
  data: {
    students: (typeof students.$inferSelect)[];
    classes: (typeof classes.$inferSelect)[];
    feedbacks: (typeof feedbacks.$inferSelect)[];
    themes: (typeof teachingThemes.$inferSelect)[];
    tags: (typeof tags.$inferSelect)[];
    courseStages: (typeof courseStages.$inferSelect)[];
    classTransfers: (typeof classTransfers.$inferSelect)[];
    teachers: Array<{
      id: string;
      username: string;
      name: string;
      role: string;
      phone: string | null;
      is_active: boolean;
      created_at: string | Date | null;
    }>;
  };
  summary: {
    studentsCount: number;
    classesCount: number;
    feedbacksCount: number;
    themesCount: number;
    tagsCount: number;
    courseStagesCount: number;
    classTransfersCount: number;
    teachersCount: number;
  };
  notes: string[];
}

export async function exportAll(): Promise<ExportData> {
  const [
    studentsData,
    classesData,
    feedbacksData,
    themesData,
    tagsData,
    courseStagesData,
    classTransfersData,
    teachersData,
  ] = await Promise.all([
    db.select().from(students),
    db.select().from(classes),
    db.select().from(feedbacks),
    db.select().from(teachingThemes),
    db.select().from(tags),
    db.select().from(courseStages),
    db.select().from(classTransfers),
    db
      .select({
        id: users.id,
        username: users.username,
        name: users.name,
        role: users.role,
        phone: users.phone,
        is_active: users.isActive,
        created_at: users.createdAt,
      })
      .from(users)
      .where(eq(users.role, "teacher")),
  ]);

  return {
    exportTime: new Date().toISOString(),
    version: "1.2",
    description: "教学反馈系统数据备份",
    data: {
      students: studentsData,
      classes: classesData,
      feedbacks: feedbacksData,
      themes: themesData,
      tags: tagsData,
      courseStages: courseStagesData,
      classTransfers: classTransfersData,
      teachers: teachersData.map((t) => ({
        ...t,
        is_active: t.is_active ?? true,
      })),
    },
    summary: {
      studentsCount: studentsData.length,
      classesCount: classesData.length,
      feedbacksCount: feedbacksData.length,
      themesCount: themesData.length,
      tagsCount: tagsData.length,
      courseStagesCount: courseStagesData.length,
      classTransfersCount: classTransfersData.length,
      teachersCount: teachersData.length,
    },
    notes: [
      "此备份文件包含所有业务数据和教师用户数据",
      "不包含管理员用户数据",
      "导入时支持增量模式（合并）和覆盖模式（清空后导入）",
      "导入时将保留现有管理员用户账号",
    ],
  };
}

export interface ClearResult {
  details: {
    feedbacksDeleted: number;
    transfersDeleted: number;
    studentsDeleted: number;
    classesDeleted: number;
    themesDeleted: number;
    tagsDeleted: number;
    courseStagesDeleted: number;
    teachersDeleted: number;
  };
}

export async function clearAll(): Promise<ClearResult> {
  // 按外键依赖顺序分层删除
  const [feedbacksDeleted, transfersDeleted] = await Promise.all([
    db.delete(feedbacks).returning(),
    db.delete(classTransfers).returning(),
  ]);

  const studentsDeleted = await db.delete(students).returning();
  const classesDeleted = await db.delete(classes).returning();

  const [themesDeleted, tagsDeleted, courseStagesDeleted] = await Promise.all([
    db.delete(teachingThemes).returning(),
    db.delete(tags).returning(),
    db.delete(courseStages).returning(),
  ]);

  const teachersDeleted = await db
    .delete(teachers)
    .where(eq(teachers.role, "teacher"))
    .returning();

  return {
    details: {
      feedbacksDeleted: feedbacksDeleted.length,
      transfersDeleted: transfersDeleted.length,
      studentsDeleted: studentsDeleted.length,
      classesDeleted: classesDeleted.length,
      themesDeleted: themesDeleted.length,
      tagsDeleted: tagsDeleted.length,
      courseStagesDeleted: courseStagesDeleted.length,
      teachersDeleted: teachersDeleted.length,
    },
  };
}

export type { ImportData, ImportResults } from "@/lib/repositories/data-repository";

export async function importData(data: dataRepo.ImportData, mode: "overwrite" | "incremental") {
  return dataRepo.importData(data, { clearFirst: mode === "overwrite" });
}

export async function fullImport(data: dataRepo.ImportData) {
  return dataRepo.importData(data, { clearFirst: true, isFullImport: true });
}

export interface ResetAdminResult {
  adminCredentials: {
    username: string;
    passwordHint: string;
  };
  logs: string[];
}

function generateRandomPassword(length = 16): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  let password = "";
  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  for (let i = 0; i < length; i++) {
    password += chars[array[i] % chars.length];
  }
  return password;
}

export interface BackupData {
  version: string;
  backupAt: string;
  appVersion?: string;
  counts: Record<string, number>;
  users: (typeof users.$inferSelect)[];
  teachers: (typeof teachers.$inferSelect)[];
  students: (typeof students.$inferSelect)[];
  classes: (typeof classes.$inferSelect)[];
  feedbacks: (typeof feedbacks.$inferSelect)[];
  classTransfers: (typeof classTransfers.$inferSelect)[];
  themes: (typeof teachingThemes.$inferSelect)[];
  tags: (typeof tags.$inferSelect)[];
  courseStages: (typeof courseStages.$inferSelect)[];
  aiSettings: (typeof aiSettings.$inferSelect)[];
  coursePrompts: (typeof coursePrompts.$inferSelect)[];
}

/**
 * 备份所有数据：业务数据、账号数据和配置数据。
 */
export async function backupAll(): Promise<BackupData> {
  const [
    usersData,
    teachersData,
    studentsData,
    classesData,
    feedbacksData,
    classTransfersData,
    themesData,
    tagsData,
    courseStagesData,
    aiSettingsData,
    coursePromptsData,
  ] = await Promise.all([
    db.select().from(users),
    db.select().from(teachers),
    db.select().from(students),
    db.select().from(classes),
    db.select().from(feedbacks),
    db.select().from(classTransfers),
    db.select().from(teachingThemes),
    db.select().from(tags),
    db.select().from(courseStages),
    db.select().from(aiSettings),
    db.select().from(coursePrompts),
  ]);

  const counts = {
    users: usersData.length,
    teachers: teachersData.length,
    students: studentsData.length,
    classes: classesData.length,
    feedbacks: feedbacksData.length,
    classTransfers: classTransfersData.length,
    themes: themesData.length,
    tags: tagsData.length,
    courseStages: courseStagesData.length,
    aiSettings: aiSettingsData.length,
    coursePrompts: coursePromptsData.length,
  };

  return {
    version: "1.0",
    backupAt: new Date().toISOString(),
    appVersion: process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0",
    counts,
    users: usersData,
    teachers: teachersData,
    students: studentsData,
    classes: classesData,
    feedbacks: feedbacksData,
    classTransfers: classTransfersData,
    themes: themesData,
    tags: tagsData,
    courseStages: courseStagesData,
    aiSettings: aiSettingsData,
    coursePrompts: coursePromptsData,
  };
}

export type RestoreSelection =
  | "users"
  | "teachers"
  | "classes"
  | "students"
  | "classTransfers"
  | "feedbacks"
  | "themes"
  | "tags"
  | "courseStages"
  | "aiSettings"
  | "coursePrompts";

interface RestoreTableConfig<T extends Record<string, unknown>> {
  key: RestoreSelection;
  table:
    | typeof users
    | typeof teachers
    | typeof classes
    | typeof students
    | typeof classTransfers
    | typeof feedbacks
    | typeof teachingThemes
    | typeof tags
    | typeof courseStages
    | typeof aiSettings
    | typeof coursePrompts;
  data: T[];
}

/**
 * 按选择项从备份中恢复数据。
 * 所有写入在同一个事务中执行，失败整体回滚。
 * 同 ID 数据会覆盖现有记录。
 */
export async function restoreData(
  backup: BackupData,
  selections: RestoreSelection[]
): Promise<{ results: Record<string, { success: number; failed: number }>; logs: string[] }> {
  const results: Record<string, { success: number; failed: number }> = {};
  const logs: string[] = [];

  const selected = new Set(selections);

  const configs: RestoreTableConfig<Record<string, unknown>>[] = [
    { key: "users", table: users, data: backup.users as Record<string, unknown>[] },
    { key: "teachers", table: teachers, data: backup.teachers as Record<string, unknown>[] },
    { key: "classes", table: classes, data: backup.classes as Record<string, unknown>[] },
    { key: "students", table: students, data: backup.students as Record<string, unknown>[] },
    { key: "classTransfers", table: classTransfers, data: backup.classTransfers as Record<string, unknown>[] },
    { key: "feedbacks", table: feedbacks, data: backup.feedbacks as Record<string, unknown>[] },
    { key: "themes", table: teachingThemes, data: backup.themes as Record<string, unknown>[] },
    { key: "tags", table: tags, data: backup.tags as Record<string, unknown>[] },
    { key: "courseStages", table: courseStages, data: backup.courseStages as Record<string, unknown>[] },
    { key: "aiSettings", table: aiSettings, data: backup.aiSettings as Record<string, unknown>[] },
    { key: "coursePrompts", table: coursePrompts, data: backup.coursePrompts as Record<string, unknown>[] },
  ];

  await withTransaction(async (tx: Database) => {
    for (const config of configs) {
      if (!selected.has(config.key)) {
        logs.push(`跳过 ${config.key}`);
        continue;
      }

      const count = config.data.length;
      if (count === 0) {
        results[config.key] = { success: 0, failed: 0 };
        logs.push(`${config.key}: 无数据`);
        continue;
      }

      try {
        const ids = config.data.map((item) => item.id).filter((id): id is string => typeof id === "string");
        if (ids.length > 0) {
          await tx.delete(config.table).where(inArray((config.table as unknown as { id: typeof users.id }).id, ids));
        }
        await tx.insert(config.table).values(config.data as never[]);
        results[config.key] = { success: count, failed: 0 };
        logs.push(`${config.key}: 成功恢复 ${count} 条`);
      } catch (error) {
        results[config.key] = { success: 0, failed: count };
        logs.push(`${config.key}: 恢复失败 ${count} 条`);
        throw error;
      }
    }
  });

  return { results, logs };
}

/**
 * 重置数据库：清空所有业务数据并创建新的管理员账户。
 * 全程在单个事务中执行，确保数据一致性。
 */
export async function resetAdmin(): Promise<ResetAdminResult> {
  const logs: string[] = [];
  const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD || generateRandomPassword();
  const hashedPassword = await hashPassword(adminPassword);

  await withTransaction(async (tx: Database) => {
    // 1. 按外键依赖顺序删除业务数据
    logs.push("开始删除业务数据...");
    await tx.delete(classTransfers);
    await tx.delete(feedbacks);
    await tx.delete(students);
    await tx.delete(classes);
    await tx.delete(teachingThemes);
    await tx.delete(tags);
    await tx.delete(courseStages);
    logs.push("✓ 业务数据已清空");

    // 2. 删除所有教师（teachers 表）
    await tx.delete(teachers);
    logs.push("✓ 教师记录已删除");

    // 3. 删除所有非管理员用户（保留 admin 之外的所有教师用户）
    await tx.delete(users).where(eq(users.role, "teacher"));
    logs.push("✓ 教师用户已删除");

    // 4. 删除旧管理员（如果存在）
    await tx.delete(users).where(eq(users.username, "admin"));
    logs.push("✓ 旧管理员已删除");

    // 5. 创建新管理员账户
    const adminId = crypto.randomUUID();
    await tx.insert(users).values({
      id: adminId,
      username: "admin",
      password: hashedPassword,
      name: "管理员",
      role: "admin",
      isActive: true,
    });
    logs.push("✓ 管理员账户已创建 (admin)");
  });

  return {
    adminCredentials: {
      username: "admin",
      passwordHint: process.env.ADMIN_DEFAULT_PASSWORD
        ? "请查看环境变量 ADMIN_DEFAULT_PASSWORD 配置"
        : "密码已随机生成，请查看服务器日志",
    },
    logs,
  };
}
