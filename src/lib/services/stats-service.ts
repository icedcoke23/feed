import { db } from "@/storage/database/drizzle-client";
import { students, feedbacks } from "@/storage/database/shared/schema";
import { eq, inArray, or, isNull, and, gte, desc, count, sql } from "drizzle-orm";
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

  // 标签使用统计的 SQL 片段：用 jsonb_array_elements 展开数组，UNION ALL 汇总三类标签，
  // 最后 GROUP BY tag + COUNT FILTER 统计各类出现次数。避免拉全表 JSONB 到内存做 JS 遍历。
  const tagAccessFilter =
    accessibleStudentIds && accessibleStudentIds.length > 0
      ? sql`AND ${feedbacks.studentId} = ANY(${sql.raw(`ARRAY[${accessibleStudentIds.map((id) => `'${id}'`).join(",")}]::text[]`)})`
      : sql``;

  const [
    // 合并查询 1：学生总数 + 本月学生数（COUNT FILTER，一次扫描）
    studentCountsResult,
    // 合并查询 2：反馈总数 + 本月反馈数
    feedbackCountsResult,
    // 查询 3：反馈趋势（SQL GROUP BY DATE，最近 7 天每日计数）
    feedbackTrendResult,
    // 查询 4：年级分布（SQL GROUP BY grade）
    gradeDistributionResult,
    // 查询 5：标签使用统计（jsonb_array_elements + GROUP BY）
    tagUsageResult,
    // 查询 6：最近反馈 + 学员姓名（LEFT JOIN 一次完成，消除串行查询）
    recentFeedbacksListResult,
  ] = await Promise.all([
    db
      .select({
        total: count(),
        thisMonth: sql<number>`count(*) filter (where ${students.createdAt} >= ${thisMonthStart})`,
      })
      .from(students)
      .where(activeStudentWhere),
    db
      .select({
        total: count(),
        thisMonth: sql<number>`count(*) filter (where ${feedbacks.createdAt} >= ${thisMonthStart})`,
      })
      .from(feedbacks)
      .where(feedbackFilter),
    db
      .select({
        date: sql<string>`to_char(${feedbacks.createdAt}::date, 'YYYY-MM-DD')`,
        count: sql<number>`count(*)::int`,
      })
      .from(feedbacks)
      .where(and(feedbackFilter, gte(feedbacks.createdAt, sevenDaysAgo)))
      .groupBy(sql`${feedbacks.createdAt}::date`)
      .orderBy(sql`${feedbacks.createdAt}::date`),
    db
      .select({
        grade: sql<string>`coalesce(${students.grade}, '未设置')`,
        count: sql<number>`count(*)::int`,
      })
      .from(students)
      .where(activeStudentWhere)
      .groupBy(students.grade),
    db.execute(sql`
      WITH tags AS (
        SELECT elem->>'tag' AS tag, 'strength' AS kind
        FROM feedbacks, jsonb_array_elements(strengths) AS elem
        WHERE strengths IS NOT NULL AND jsonb_array_length(strengths) > 0 ${tagAccessFilter}
        UNION ALL
        SELECT elem->>'tag', 'improvement'
        FROM feedbacks, jsonb_array_elements(improvements) AS elem
        WHERE improvements IS NOT NULL AND jsonb_array_length(improvements) > 0 ${tagAccessFilter}
        UNION ALL
        SELECT elem->>'tag', 'weakness'
        FROM feedbacks, jsonb_array_elements(weaknesses) AS elem
        WHERE weaknesses IS NOT NULL AND jsonb_array_length(weaknesses) > 0 ${tagAccessFilter}
      )
      SELECT tag,
        count(*) filter (where kind = 'strength')::int AS strength,
        count(*) filter (where kind = 'improvement')::int AS improvement,
        count(*) filter (where kind = 'weakness')::int AS weakness
      FROM tags
      WHERE tag IS NOT NULL AND tag <> ''
      GROUP BY tag
      ORDER BY (count(*) filter (where kind = 'strength')
              + count(*) filter (where kind = 'improvement')
              + count(*) filter (where kind = 'weakness')) DESC
      LIMIT 10
    `),
    db
      .select({
        id: feedbacks.id,
        createdAt: feedbacks.createdAt,
        studentId: feedbacks.studentId,
        status: feedbacks.status,
        studentName: students.name,
      })
      .from(feedbacks)
      .leftJoin(students, eq(feedbacks.studentId, students.id))
      .where(feedbackFilter)
      .orderBy(desc(feedbacks.createdAt))
      .limit(5),
  ]);

  // 用 7 天模板补零（SQL 只返回有数据的天）
  const trendMap = new Map(feedbackTrendResult.map((r) => [r.date, r.count]));
  const feedbackTrend: Array<{ date: string; count: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];
    feedbackTrend.push({ date: dateStr, count: trendMap.get(dateStr) ?? 0 });
  }

  const tagUsageRows = (tagUsageResult as unknown as { rows: Array<{
    tag: string;
    strength: number;
    improvement: number;
    weakness: number;
  }> }).rows;
  const tagUsage = tagUsageRows.map((r) => ({
    tag: r.tag,
    strength: r.strength,
    improvement: r.improvement,
    weakness: r.weakness,
    total: r.strength + r.improvement + r.weakness,
  }));

  const recentFeedbacksWithName = recentFeedbacksListResult.map((f) => ({
    id: f.id,
    created_at: f.createdAt,
    student_id: f.studentId,
    status: f.status,
    student_name: f.studentName || "未知学员",
  }));

  const result: StatsResult = {
    studentCount: studentCountsResult[0]?.total ?? 0,
    feedbackCount: feedbackCountsResult[0]?.total ?? 0,
    thisMonthStudents: studentCountsResult[0]?.thisMonth ?? 0,
    thisMonthFeedbacks: feedbackCountsResult[0]?.thisMonth ?? 0,
    feedbackTrend,
    gradeDistribution: gradeDistributionResult.map((r) => ({
      grade: r.grade,
      count: r.count,
    })),
    tagUsage,
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
