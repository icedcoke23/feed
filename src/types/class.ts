import type { Teacher } from "./teacher";

// 类型来源：Drizzle schema (src/storage/database/shared/schema.ts) - classes 表
// 字段命名使用 snake_case，与 Supabase 客户端返回的数据库列名一致
// Drizzle schema 中的 camelCase 属性名映射：teacherId→teacher_id, isActive→is_active, createdAt→created_at, updatedAt→updated_at

export interface ClassItem {
  id: string;
  name: string;
  grade?: string;
  schedule?: string;
  teacher_id?: string;
  description?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  teacher?: Teacher;
  student_count?: number;
}

export interface ClassFormData {
  name: string;
  grade: string;
  schedule: string;
  teacherId: string;
}

export const EMPTY_CLASS_FORM: ClassFormData = {
  name: "",
  grade: "",
  schedule: "",
  teacherId: "",
};
