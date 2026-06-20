import { db } from "@/storage/database/drizzle-client";
import { students, feedbacks } from "@/storage/database/shared/schema";
import { eq, inArray, or, isNull, and, gte, desc, count } from "drizzle-orm";
import * as authService from "@/lib/services/auth-service";
import { forbiddenError } from "@/lib/api-error";
import type { AuthUserResult } from "@/lib/route-auth";

// 内存缓存：基于用户 ID 的缓存 key
const statsCacheMap = new Map<string, { data: StatsResult; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 分钟

export interface StatsResult {
  studentCount: number;
  feedbackCount: number;
  thisMonthStudents: number;
  thisMonthFeedbacks: number;
  feedbackTrend: Array<{ date: string; count: number }>;
  gradeDistribution: Array<{ grade: string; count: number }>;
  tagUsage: Array<{ tag: string; strength: number; improvement: number; weakness: number; total: number }>;
  recentFeedbacks: Array<{
    id: string;
    created_at: Date | string | null;
    student_id: string;
    status: string | null;
    student_name: string;
  }>;
}

export async function getStats(user: AuthUserResult): Promise<StatsResult | Response> {
  if (!user) return forbiddenError("未授权访问");

  const accessibleStudentIds = await authService.getAccessibleStudentIds(user);
  if (accessibleStudentIds?.length === 0) {
    return {
      studentCount: 0,
      feedbackCount: 0,
      thisMonthStudents: 0,
      thisMonthFeedbacks: 0,
      feedbackTrend: [],
      gradeDistribution: [],
      tagUsage: [],
      recentFeedbacks: [],
    };
  }

  const cacheKey = user.userRole === "teacher" ? `teacher:${user.userId}` : "admin";
  const cached = statsCacheMap.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const thisMonthStart = new Date();
  thisMonthStart.setDate(1);
  thisMonthStart.setHours(0, 0, 0, 0);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const studentFilter = accessibleStudentIds ? inArray(students.id, accessibleStudentIds) : undefined;
  const feedbackFilter = accessibleStudentIds ? inArray(feedbacks.studentId, accessibleStudentIds) : undefined;

  const activeStudentWhere = and(
    or(eq(students.isActive, true), isNull(students.isActive)),
    studentFilter
  );

  const [
    studentsCountResult,
    feedbacksCountResult,
    thisMonthStudentsResult,
    thisMonthFeedbacksResult,
    recentFeedbacksResult,
    gradeDistributionResult,
    feedbacksDataResult,
    recentFeedbacksListResult,
  ] = await Promise.all([
    db.select({ value: count() }).from(students).where(activeStudentWhere),
    db.select({ value: count() }).from(feedbacks).where(feedbackFilter),
    db
      .select({ value: count() })
      .from(students)
      .where(and(activeStudentWhere, gte(students.createdAt, thisMonthStart))),
    db
      .select({ value: count() })
      .from(feedbacks)
      .where(and(feedbackFilter, gte(feedbacks.createdAt, thisMonthStart))),
    db
      .select({ createdAt: feedbacks.createdAt })
      .from(feedbacks)
      .where(and(feedbackFilter, gte(feedbacks.createdAt, sevenDaysAgo)))
      .orderBy(feedbacks.createdAt),
    db
      .select({ grade: students.grade })
      .from(students)
      .where(activeStudentWhere),
    db
      .select({
        strengths: feedbacks.strengths,
        weaknesses: feedbacks.weaknesses,
        improvements: feedbacks.improvements,
      })
      .from(feedbacks)
      .where(feedbackFilter),
    db
      .select({
        id: feedbacks.id,
        createdAt: feedbacks.createdAt,
        studentId: feedbacks.studentId,
        status: feedbacks.status,
      })
      .from(feedbacks)
      .where(feedbackFilter)
      .orderBy(desc(feedbacks.createdAt))
      .limit(5),
  ]);

  // 获取最近反馈对应的学员名称
  const recentStudentIds = recentFeedbacksListResult.map((f) => f.studentId);
  const studentsInfo = recentStudentIds.length > 0
    ? await db
        .select({ id: students.id, name: students.name })
        .from(students)
        .where(and(inArray(students.id, recentStudentIds), or(eq(students.isActive, true), isNull(students.isActive))))
    : [];
  const studentMap = new Map(studentsInfo.map((s) => [s.id, s.name]));

  // 按天分组统计反馈趋势（最近 7 天）
  const feedbackTrend: Record<string, number> = {};
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];
    feedbackTrend[dateStr] = 0;
  }
  recentFeedbacksResult.forEach((f) => {
    if (!f.createdAt) return;
    const dateStr = new Date(f.createdAt).toISOString().split("T")[0];
    if (feedbackTrend[dateStr] !== undefined) {
      feedbackTrend[dateStr]++;
    }
  });

  // 学员年级分布
  const gradeDistribution: Record<string, number> = {};
  gradeDistributionResult.forEach((s) => {
    const grade = s.grade || "未设置";
    gradeDistribution[grade] = (gradeDistribution[grade] || 0) + 1;
  });

  // 标签使用统计
  const tagUsage: Record<string, { strength: number; improvement: number; weakness: number }> = {};
  feedbacksDataResult.forEach((f) => {
    (f.strengths as Array<{ tag: string }>)?.forEach((s) => {
      if (!tagUsage[s.tag]) tagUsage[s.tag] = { strength: 0, improvement: 0, weakness: 0 };
      tagUsage[s.tag].strength++;
    });
    (f.improvements as Array<{ tag: string }>)?.forEach((i) => {
      if (!tagUsage[i.tag]) tagUsage[i.tag] = { strength: 0, improvement: 0, weakness: 0 };
      tagUsage[i.tag].improvement++;
    });
    (f.weaknesses as Array<{ tag: string }>)?.forEach((w) => {
      if (!tagUsage[w.tag]) tagUsage[w.tag] = { strength: 0, improvement: 0, weakness: 0 };
      tagUsage[w.tag].weakness++;
    });
  });

  const recentFeedbacksWithName = recentFeedbacksListResult.map((f) => ({
    id: f.id,
    created_at: f.createdAt,
    student_id: f.studentId,
    status: f.status,
    student_name: studentMap.get(f.studentId) || "未知学员",
  }));

  const result: StatsResult = {
    studentCount: studentsCountResult[0]?.value ?? 0,
    feedbackCount: feedbacksCountResult[0]?.value ?? 0,
    thisMonthStudents: thisMonthStudentsResult[0]?.value ?? 0,
    thisMonthFeedbacks: thisMonthFeedbacksResult[0]?.value ?? 0,
    feedbackTrend: Object.entries(feedbackTrend).map(([date, count]) => ({ date, count })),
    gradeDistribution: Object.entries(gradeDistribution).map(([grade, count]) => ({ grade, count })),
    tagUsage: Object.entries(tagUsage)
      .map(([tag, counts]) => ({
        tag,
        ...counts,
        total: counts.strength + counts.improvement + counts.weakness,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10),
    recentFeedbacks: recentFeedbacksWithName,
  };

  statsCacheMap.set(cacheKey, { data: result, timestamp: Date.now() });
  return result;
}

/** 手动清除统计缓存（例如在学生/反馈变更后）。 */
export function clearStatsCache(userId?: string) {
  if (userId) {
    statsCacheMap.delete(`teacher:${userId}`);
  } else {
    statsCacheMap.clear();
  }
}
