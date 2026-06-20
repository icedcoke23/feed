import { db } from "@/storage/database/drizzle-client";
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
} from "@/storage/database/shared/schema";
import { eq } from "drizzle-orm";
import * as dataRepo from "@/lib/repositories/data-repository";

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
