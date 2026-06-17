import type { ClassItem } from "./class";
import type { Teacher } from "./teacher";

// 类型来源：Drizzle schema (src/storage/database/shared/schema.ts) - students 表
// 字段命名使用 snake_case，与 Supabase 客户端返回的数据库列名一致
// Drizzle schema 中的 camelCase 属性名映射：currentTeacherId→current_teacher_id, currentClass→current_class, classId→class_id, adminTeacherId→admin_teacher_id, isActive→is_active, createdAt→created_at, updatedAt→updated_at

export interface StudentClass {
  id: string;
  name: string;
  grade?: string;
  schedule?: string;
  teacher_id?: string;
  is_primary?: boolean;
  teacher?: Teacher;
}

export interface Student {
  id: string;
  name: string;
  grade?: string;
  school?: string;
  phone?: string;
  current_class?: string;
  class_id?: string;
  current_teacher_id?: string;
  admin_teacher_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  class?: ClassItem;
  admin_teacher?: Teacher;
  classes?: StudentClass[];
}

export interface StudentDetail extends Student {
  feedbacks: StudentFeedback[];
  transfers: Transfer[];
}

export interface StudentFeedback {
  id: string;
  status: string;
  created_at: string;
  period_start: string;
  period_end: string;
  ai_report: string;
  metadata: Record<string, unknown> | null;
  strengths?: string;
  improvements?: string;
  weaknesses?: string;
  recommendations?: string;
  summary?: string;
}

export interface Transfer {
  id: string;
  from_class: string;
  to_class: string;
  transferred_at: string;
}

export interface ParsedStudent {
  name: string;
  grade: string;
  className: string;
  teacherAlias?: string;
  teacherName?: string;
}

export interface StudentFormData {
  name: string;
  grade: string;
  className: string;
  classId: string;
  phone: string;
  school: string;
  adminTeacherId: string;
  currentTeacherId: string;
}

export const EMPTY_STUDENT_FORM: StudentFormData = {
  name: "",
  grade: "",
  className: "",
  classId: "",
  phone: "",
  school: "",
  adminTeacherId: "",
  currentTeacherId: "",
};
