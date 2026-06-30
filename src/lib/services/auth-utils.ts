import type { AuthUserResult } from "@/lib/route-auth";

/**
 * 统一的 admin 判定：users.role === 'admin' 或 teachers.role === 'admin'。
 *
 * 修复"isAdmin 分裂"bug：原先 user-service / course-stage-service / ai-setting-service
 * 仅检查 userRole，导致 teachers 表中 role=admin 的教师无法管理用户/课程阶段/AI 设置。
 */
export function isAdmin(user: AuthUserResult): boolean {
  return user.userRole === "admin" || user.teacherRole === "admin";
}

/**
 * 判定是否为"教师身份的管理员"（userRole === 'teacher' 且 teachers.role === 'admin'）。
 * 用于区分"全局 admin（users.role=admin）"与"教师 admin（teachers.role=admin）"。
 */
export function isTeacherAdmin(user: AuthUserResult): boolean {
  return user.userRole === "teacher" && user.teacherRole === "admin";
}
