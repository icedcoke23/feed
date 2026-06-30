import { z } from "zod";

/**
 * 客户端表单校验 Schema 集合
 *
 * 集中定义所有前端表单的 zod schema，替代各 hook 中分散的手写 if 校验。
 * 优势：
 * - 校验规则单一来源，与后端 schema 保持一致
 * - 错误信息统一中文文案
 * - 提供 safeParse 返回结构化错误，便于 toast 显示具体字段
 *
 * 用法：
 * ```ts
 * const result = classFormSchema.safeParse(formData);
 * if (!result.success) {
 *   toast.error(result.error.issues[0]?.message ?? "表单校验失败");
 *   return;
 * }
 * const validData = result.data;
 * ```
 */

// ============ 班级表单 ============

export const classFormSchema = z.object({
  name: z.string().trim().min(1, "请输入班级名称"),
  grade: z.string().trim(),
  schedule: z.string().trim(),
  teacherId: z.string().min(1, "请选择授课老师"),
});

// ============ 学员表单 ============

export const studentFormSchema = z.object({
  name: z.string().trim().min(1, "请输入学员姓名"),
  grade: z.string().trim(),
  className: z.string().trim(),
  classId: z.string().optional().default(""),
  phone: z.string().trim(),
  school: z.string().trim(),
  adminTeacherId: z.string().optional().default(""),
  currentTeacherId: z.string().optional().default(""),
});

// ============ 课程阶段表单 ============

export const courseStageFormSchema = z.object({
  stage_name: z.string().trim().min(1, "请填写阶段名称"),
  theme: z.string().trim().min(1, "请选择主题"),
  level: z.string().trim().min(1, "请选择级别"),
  description: z.string().optional().default(""),
  content: z.string().optional().default(""),
  goal: z.string().optional().default(""),
  sort_order: z.number().int().min(0, "排序必须为非负整数").optional().default(0),
});

// ============ 标签表单 ============

export const tagFormSchema = z.object({
  name: z.string().trim().min(1, "请填写标签名称"),
  category: z.string().trim().min(1, "请选择标签分类"),
  description: z.string().optional().default(""),
  sort_order: z.number().int().min(0, "排序必须为非负整数").optional().default(0),
});

// ============ 主题表单 ============

export const themeFormSchema = z.object({
  name: z.string().trim().min(1, "请填写主题名称"),
  category: z.string().trim().min(1, "请选择主题分类"),
  description: z.string().optional().default(""),
  sort_order: z.number().int().min(0, "排序必须为非负整数").optional().default(0),
});

// ============ 用户表单 ============

export const userFormSchema = z
  .object({
    username: z.string().trim().min(1, "请填写用户名"),
    name: z.string().trim().min(1, "请填写姓名"),
    password: z.string().optional(),
    role: z.enum(["admin", "teacher"]).optional().default("teacher"),
    teacherRole: z.enum(["admin", "teacher"]).optional(),
    phone: z.string().optional().default(""),
  })
  .refine((data) => data.password && data.password.length > 0, {
    message: "请设置初始密码",
    path: ["password"],
  });

// 仅在新增时校验密码必填
export function validateUserForm(
  data: { username?: string; name?: string; password?: string; role?: string; teacherRole?: string; phone?: string },
  isAdding: boolean
) {
  const base = z.object({
    username: z.string().trim().min(1, "请填写用户名"),
    name: z.string().trim().min(1, "请填写姓名"),
    password: z.string(),
    role: z.string().optional(),
    teacherRole: z.string().optional(),
    phone: z.string().optional().default(""),
  });

  if (isAdding) {
    return base
      .refine((d) => d.password.trim().length > 0, {
        message: "请设置初始密码",
        path: ["password"],
      })
      .safeParse(data);
  }

  return base.safeParse(data);
}

// ============ AI 设置 ============

export const aiSettingsSchema = z.object({
  api_key: z.string(),
  base_url: z.string(),
  model_id: z.string(),
  max_concurrent: z.string(),
  system_prompt: z.string(),
  use_custom_ai: z.string(),
});

// ============ 反馈保存 ============

export const feedbackSaveSchema = z.object({
  student_id: z.string().min(1, "缺少学员信息"),
  feedback_date: z.string().optional(),
  teacher_id: z.string().optional(),
  status: z.string().optional().default("draft"),
});

// ============ 工具函数 ============

/**
 * 从 zod 错误中提取第一个错误信息，便于 toast 显示。
 * 若无错误信息则返回 fallback。
 */
export function firstZodError(error: z.ZodError, fallback = "表单校验失败"): string {
  return error.issues[0]?.message ?? fallback;
}
