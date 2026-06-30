import { maskPhone } from "@/lib/sensitive-mask";
import {
  feedbacks,
  students,
  users,
  classes,
  tags,
  teachingThemes,
  classTransfers,
} from "@/storage/database/shared/schema";

/**
 * 集中的 snake_case 输出映射器。
 *
 * Drizzle ORM 返回 camelCase 属性名（如 teacherId），但前端类型（@/types/*）
 * 使用 snake_case（如 teacher_id）。这些 mapper 统一 API 输出格式，
 * 避免前端字段读取 undefined 的 bug。
 *
 * 敏感字段（phone/email）在 mapper 中一并脱敏，确保所有 API 返回点一致。
 */

export function toSnakeCaseFeedback(feedback: typeof feedbacks.$inferSelect) {
  return {
    id: feedback.id,
    student_id: feedback.studentId,
    teacher_id: feedback.teacherId,
    strengths: feedback.strengths,
    improvements: feedback.improvements,
    weaknesses: feedback.weaknesses,
    teaching_plan: feedback.teachingPlan,
    suggestions: feedback.suggestions,
    ai_report: feedback.aiReport,
    metadata: feedback.metadata,
    work_info: feedback.workInfo,
    ability_scores: feedback.abilityScores,
    version: feedback.version,
    parent_feedback_id: feedback.parentFeedbackId,
    status: feedback.status,
    created_at: feedback.createdAt,
    updated_at: feedback.updatedAt,
    period_start: feedback.periodStart,
    period_end: feedback.periodEnd,
  };
}

export function toSnakeCaseStudent(student: typeof students.$inferSelect) {
  return {
    id: student.id,
    name: student.name,
    grade: student.grade,
    school: student.school,
    phone: maskPhone(student.phone),
    current_class: student.currentClass,
    class_id: student.classId,
    current_teacher_id: student.currentTeacherId,
    admin_teacher_id: student.adminTeacherId,
    is_active: student.isActive,
    created_at: student.createdAt,
    updated_at: student.updatedAt,
  };
}

export function toSnakeCaseUser(
  user: typeof users.$inferSelect & { teacherRole?: "admin" | "teacher" }
) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    phone: maskPhone(user.phone),
    is_active: user.isActive,
    created_at: user.createdAt,
    teacherRole: user.teacherRole,
  };
}

export function toSnakeCaseClass(cls: typeof classes.$inferSelect) {
  return {
    id: cls.id,
    name: cls.name,
    grade: cls.grade,
    schedule: cls.schedule,
    teacher_id: cls.teacherId,
    description: cls.description,
    is_active: cls.isActive,
    created_at: cls.createdAt,
    updated_at: cls.updatedAt,
  };
}

export function toSnakeCaseTag(tag: typeof tags.$inferSelect) {
  return {
    id: tag.id,
    category: tag.category,
    name: tag.name,
    description: tag.description,
    sort_order: tag.sortOrder,
    is_active: tag.isActive,
  };
}

export function toSnakeCaseTheme(theme: typeof teachingThemes.$inferSelect) {
  return {
    id: theme.id,
    name: theme.name,
    category: theme.category,
    description: theme.description,
    sort_order: theme.sortOrder,
    is_active: theme.isActive,
  };
}

export function toSnakeCaseClassTransfer(transfer: typeof classTransfers.$inferSelect) {
  return {
    id: transfer.id,
    student_id: transfer.studentId,
    from_teacher_id: transfer.fromTeacherId,
    to_teacher_id: transfer.toTeacherId,
    from_class: transfer.fromClass,
    to_class: transfer.toClass,
    reason: transfer.reason,
    transferred_at: transfer.transferredAt,
  };
}
