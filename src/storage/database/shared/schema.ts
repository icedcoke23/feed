import { sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  boolean,
  integer,
  smallint,
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
  (table) => [index("teachers_email_idx").on(table.email)]
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
    uniqueIndex("student_classes_primary_idx")
      .on(table.studentId)
      .where(sql`${table.isPrimary} = true`),
  ]
);

// 反馈项目表（拆分 feedbacks.strengths / improvements / weaknesses）
export const feedbackItems = pgTable(
  "feedback_items",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    feedbackId: varchar("feedback_id", { length: 36 })
      .notNull()
      .references(() => feedbacks.id, { onDelete: "cascade" }),
    tagId: varchar("tag_id", { length: 36 }).references(() => tags.id, {
      onDelete: "set null",
    }),
    category: varchar("category", { length: 20 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    rating: smallint("rating"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("feedback_items_feedback_id_idx").on(table.feedbackId),
    index("feedback_items_tag_id_idx").on(table.tagId),
    index("feedback_items_category_idx").on(table.category),
  ]
);

// 能力评分表（拆分 feedbacks.ability_scores）
export const feedbackAbilityScores = pgTable(
  "feedback_ability_scores",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    feedbackId: varchar("feedback_id", { length: 36 })
      .notNull()
      .references(() => feedbacks.id, { onDelete: "cascade" }),
    abilityName: varchar("ability_name", { length: 100 }).notNull(),
    score: smallint("score").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("feedback_ability_scores_feedback_id_idx").on(table.feedbackId),
    uniqueIndex("feedback_ability_scores_unique_idx").on(
      table.feedbackId,
      table.abilityName
    ),
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
  ]
);

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
export type FeedbackItem = typeof feedbackItems.$inferSelect;
export type FeedbackAbilityScore = typeof feedbackAbilityScores.$inferSelect;
