// 类型来源：Drizzle schema (src/storage/database/shared/schema.ts) - teachers 表
// 字段命名使用 snake_case，与 Supabase 客户端返回的数据库列名一致
// Drizzle schema 中的 camelCase 属性名映射：isActive→is_active, createdAt→created_at, updatedAt→updated_at

export interface Teacher {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  role?: "admin" | "teacher";
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}
