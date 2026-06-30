import { sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
  uniqueIndex,
  serial,
} from "drizzle-orm/pg-core";
import { createSchemaFactory } from "drizzle-zod";
import { z } from "zod";

// 系统健康检查表（保留）
export const healthCheck = pgTable("health_check", {
  id: serial().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// 教师表
export const teachers = pgTable(
  "teachers",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 128 }).notNull(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    phone: varchar("phone", { length: 20 }),
    role: varchar("role", { length: 20 }).default("teacher").notNull(), // teacher, admin
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("teachers_email_idx").on(table.email),
    // 部分索引：仅活跃教师的 role 查询
    index("teachers_active_role_idx")
      .on(table.role)
      .where(sql`${table.isActive} = true`),
  ]
);

// 学生表
export const students = pgTable(
  "students",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 128 }).notNull(),
    grade: varchar("grade", { length: 50 }),
    school: varchar("school", { length: 255 }),
    phone: varchar("phone", { length: 20 }),
    currentTeacherId: varchar("current_teacher_id", { length: 36 }).references(
      () => teachers.id,
      { onDelete: "set null" }
    ),
    currentClass: varchar("current_class", { length: 100 }),
    classId: varchar("class_id", { length: 36 }).references(() => classes.id, {
      onDelete: "set null",
    }),
    adminTeacherId: varchar("admin_teacher_id", { length: 36 }).references(
      () => teachers.id,
      { onDelete: "set null" }
    ),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("students_teacher_idx").on(table.currentTeacherId),
    index("students_name_idx").on(table.name),
    index("students_class_idx").on(table.classId),
    index("students_admin_teacher_idx").on(table.adminTeacherId),
    // 复合索引：教务老师按时间查询学生
    index("students_admin_created_idx").on(table.adminTeacherId, table.createdAt),
    // 部分索引：仅活跃学生按名查询
    index("students_active_name_idx")
      .on(table.name)
      .where(sql`${table.isActive} = true`),
  ]
);

// 教学反馈报告表
export const feedbacks = pgTable(
  "feedbacks",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    studentId: varchar("student_id", { length: 36 })
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    teacherId: varchar("teacher_id", { length: 36 })
      .notNull()
      .references(() => teachers.id, { onDelete: "restrict" }),

    // 学情分析
    strengths: jsonb("strengths").default([]), // 优点标签和描述
    improvements: jsonb("improvements").default([]), // 能力提升
    weaknesses: jsonb("weaknesses").default([]), // 需要提升的点

    // 教学计划
    teachingPlan: jsonb("teaching_plan").default([]), // 教学计划表格数据

    // 阶段性建议
    suggestions: text("suggestions"), // 阶段性建议

    // AI生成的报告内容（纯文本）
    aiReport: text("ai_report"), // AI生成的完整报告

    // 元数据（学生/教师/课程等上下文信息）
    metadata: jsonb("metadata").default({}),

    // 作品信息
    workInfo: jsonb("work_info").default({}),
    // 能力评分
    abilityScores: jsonb("ability_scores").default([]),

    // 版本管理
    version: integer("version").default(1).notNull(),
    parentFeedbackId: varchar("parent_feedback_id", { length: 36 }).references(
      (): AnyPgColumn => feedbacks.id,
      { onDelete: "set null" }
    ), // 父版本ID

    // 状态
    status: varchar("status", { length: 20 }).default("draft").notNull(), // draft, published

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
    periodStart: timestamp("period_start", { withTimezone: true }),
    periodEnd: timestamp("period_end", { withTimezone: true }),
  },
  (table) => [
    index("feedbacks_student_idx").on(table.studentId),
    index("feedbacks_teacher_idx").on(table.teacherId),
    index("feedbacks_created_idx").on(table.createdAt),
    // 关键索引：按状态过滤（Phase 2.4）
    index("feedbacks_status_idx").on(table.status),
    // 关键索引：按时间区间查询（Phase 2.4）
    index("feedbacks_period_idx").on(table.periodStart, table.periodEnd),
    // 复合索引：学生/教师按时间倒序查询反馈
    index("feedbacks_student_created_idx").on(table.studentId, table.createdAt),
    index("feedbacks_teacher_created_idx").on(table.teacherId, table.createdAt),
    // 复合索引：状态 + 时间倒序，统计/筛选常用
    index("feedbacks_status_created_idx").on(table.status, table.createdAt),
    // GIN 索引：JSONB 字段查询
    index("feedbacks_metadata_gin_idx").using("gin", table.metadata),
    index("feedbacks_work_info_gin_idx").using("gin", table.workInfo),
  ]
);

// 学生班级关联表
export const studentClasses = pgTable(
  "student_classes",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    studentId: varchar("student_id", { length: 36 })
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    classId: varchar("class_id", { length: 36 })
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    isPrimary: boolean("is_primary").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    leftAt: timestamp("left_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("student_classes_student_idx").on(table.studentId),
    index("student_classes_class_idx").on(table.classId),
    // 复合索引：学生 + 活跃状态查询
    index("student_classes_student_active_idx").on(table.studentId, table.isActive),
    // 部分唯一索引：每个学生最多一个主班级
    uniqueIndex("student_classes_primary_idx")
      .on(table.studentId)
      .where(sql`${table.isPrimary} = true`),
  ]
);

// 转班记录表
export const classTransfers = pgTable(
  "class_transfers",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    studentId: varchar("student_id", { length: 36 })
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    fromTeacherId: varchar("from_teacher_id", { length: 36 }).references(
      () => teachers.id,
      { onDelete: "set null" }
    ),
    toTeacherId: varchar("to_teacher_id", { length: 36 })
      .notNull()
      .references(() => teachers.id, { onDelete: "restrict" }),
    fromClass: varchar("from_class", { length: 100 }),
    toClass: varchar("to_class", { length: 100 }),
    reason: text("reason"),
    transferredAt: timestamp("transferred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("transfers_student_idx").on(table.studentId),
    index("transfers_date_idx").on(table.transferredAt),
    // 复合索引：学生 + 时间倒序查询转班历史
    index("transfers_student_transferred_idx").on(table.studentId, table.transferredAt),
  ]
);

// 预设标签表
export const tags = pgTable(
  "tags",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    category: varchar("category", { length: 50 }).notNull(), // strength, improvement, weakness, suggestion
    name: varchar("name", { length: 100 }).notNull(),
    description: varchar("description", { length: 255 }),
    sortOrder: integer("sort_order").default(0),
    isActive: boolean("is_active").default(true).notNull(),
  },
  (table) => [
    index("tags_category_idx").on(table.category),
    uniqueIndex("tags_category_name_idx").on(table.category, table.name),
  ]
);

// 教学主题表
export const teachingThemes = pgTable(
  "teaching_themes",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 100 }).notNull(),
    category: varchar("category", { length: 100 }), // 生活家电、生命科学、工程机械等
    description: text("description"),
    sortOrder: integer("sort_order").default(0),
    isActive: boolean("is_active").default(true).notNull(),
  },
  (table) => [index("themes_category_idx").on(table.category)]
);

// 课程阶段预设表
export const courseStages = pgTable(
  "course_stages",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    stageCode: varchar("stage_code", { length: 50 }).notNull().unique(),
    stageName: varchar("stage_name", { length: 100 }).notNull(),
    theme: varchar("theme", { length: 50 }).notNull(), // Scratch, Python, C++
    level: varchar("level", { length: 20 }).notNull(), // beginner, intermediate, advanced
    description: text("description"),
    content: text("content"), // 教学内容
    goal: text("goal"), // 项目目标
    sortOrder: integer("sort_order").default(0),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("course_stages_theme_idx").on(table.theme),
    index("course_stages_level_idx").on(table.level),
    // 部分索引：仅活跃课程阶段按主题+级别查询
    index("course_stages_active_theme_level_idx")
      .on(table.theme, table.level)
      .where(sql`${table.isActive} = true`),
  ]
);

export type CourseStage = typeof courseStages.$inferSelect;

// 班级表
export const classes = pgTable(
  "classes",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 100 }).notNull(),
    grade: varchar("grade", { length: 50 }),
    teacherId: varchar("teacher_id", { length: 36 }).references(
      () => teachers.id,
      { onDelete: "set null" }
    ),
    schedule: varchar("schedule", { length: 255 }),
    description: text("description"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("classes_teacher_idx").on(table.teacherId),
    // 复合索引：按名 + 教师查询
    index("classes_name_teacher_idx").on(table.name, table.teacherId),
    // 部分索引：仅活跃班级按教师查询
    index("classes_active_teacher_idx")
      .on(table.teacherId)
      .where(sql`${table.isActive} = true`),
  ]
);

// 登录用户表
export const users = pgTable(
  "users",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    username: varchar("username", { length: 100 }).notNull().unique(),
    password: varchar("password", { length: 255 }).notNull(), // bcrypt 哈希
    name: varchar("name", { length: 128 }).notNull(),
    role: varchar("role", { length: 20 }).default("teacher").notNull(), // admin, teacher
    phone: varchar("phone", { length: 20 }),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("users_username_idx").on(table.username)]
);

// AI 配置表
export const aiSettings = pgTable(
  "ai_settings",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    apiKey: text("api_key"),
    baseUrl: text("base_url"),
    modelId: varchar("model_id", { length: 100 })
      .notNull()
      .default("gpt-3.5-turbo"),
    maxConcurrent: integer("max_concurrent").notNull().default(5),
    systemPrompt: text("system_prompt"),
    useCustomAi: boolean("use_custom_ai").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [index("ai_settings_updated_idx").on(table.updatedAt)]
);

// 课程阶段专属 AI 提示词表
export const coursePrompts = pgTable(
  "course_prompts",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    stageCode: varchar("stage_code", { length: 50 })
      .notNull()
      .unique()
      .references(() => courseStages.stageCode, { onDelete: "cascade" }),
    systemPrompt: text("system_prompt"),
    reportStructure: text("report_structure"),
    wordLimit: varchar("word_limit", { length: 20 }),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("course_prompts_stage_code_idx").on(table.stageCode),
    index("course_prompts_active_idx").on(table.isActive),
  ]
);

// 使用 createSchemaFactory 配置 date coercion
const { createInsertSchema: createCoercedInsertSchema } = createSchemaFactory({
  coerce: { date: true },
});

// Zod schemas for validation
export const insertTeacherSchema = createCoercedInsertSchema(teachers).pick({
  name: true,
  email: true,
  phone: true,
  role: true,
});

export const insertStudentSchema = createCoercedInsertSchema(students).pick({
  name: true,
  grade: true,
  school: true,
  phone: true,
  currentTeacherId: true,
  currentClass: true,
  classId: true,
  adminTeacherId: true,
});

export const insertFeedbackSchema = createCoercedInsertSchema(feedbacks).pick({
  studentId: true,
  teacherId: true,
  strengths: true,
  improvements: true,
  weaknesses: true,
  teachingPlan: true,
  suggestions: true,
  aiReport: true,
  metadata: true,
  workInfo: true,
  abilityScores: true,
  status: true,
  periodStart: true,
  periodEnd: true,
});

export const insertTagSchema = createCoercedInsertSchema(tags).pick({
  category: true,
  name: true,
  description: true,
  sortOrder: true,
});

export const insertTeachingThemeSchema = createCoercedInsertSchema(teachingThemes).pick({
  name: true,
  category: true,
  description: true,
  sortOrder: true,
});

// TypeScript types
export type Teacher = typeof teachers.$inferSelect;
export type InsertTeacher = z.infer<typeof insertTeacherSchema>;

export type Student = typeof students.$inferSelect;
export type InsertStudent = z.infer<typeof insertStudentSchema>;

export type Feedback = typeof feedbacks.$inferSelect;
export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;

export type Tag = typeof tags.$inferSelect;
export type InsertTag = z.infer<typeof insertTagSchema>;

export type TeachingTheme = typeof teachingThemes.$inferSelect;
export type InsertTeachingTheme = z.infer<typeof insertTeachingThemeSchema>;

export const insertUserSchema = createCoercedInsertSchema(users).pick({
  username: true,
  name: true,
  role: true,
  phone: true,
});

export const insertAiSettingSchema = createCoercedInsertSchema(aiSettings).pick({
  apiKey: true,
  baseUrl: true,
  modelId: true,
  maxConcurrent: true,
  systemPrompt: true,
  useCustomAi: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type AiSetting = typeof aiSettings.$inferSelect;
export type InsertAiSetting = z.infer<typeof insertAiSettingSchema>;

export type CoursePrompt = typeof coursePrompts.$inferSelect;

export type StudentClass = typeof studentClasses.$inferSelect;
