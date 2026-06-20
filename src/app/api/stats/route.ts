import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/storage/database/supabase-client";
import { handleDbError } from "@/lib/api-error";
import { getAuthUser, getTeacherClassIds } from "@/lib/route-auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { withLogging } from "@/lib/api-logger";

// 内存缓存：基于用户 ID 的缓存 key
const statsCacheMap = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 分钟

// GET /api/stats - 获取统计数据
export const GET = withLogging(async (request: NextRequest) => {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  const client = getServerSupabaseClient();

  // 教师权限隔离：获取教师可见的学生 ID 列表
  let teacherStudentIds: string[] | null = null;
  if (authUser.userRole === "teacher") {
    if (authUser.teacherRole === "admin") {
      // 教务老师：按 admin_teacher_id 过滤学生
      const { data: adminStudents } = await client
        .from("students")
        .select("id")
        .eq("admin_teacher_id", authUser.userId)
        .or("is_active.eq.true,is_active.is.null");
      teacherStudentIds = adminStudents?.map((s: { id: string }) => s.id) || [];
      if (teacherStudentIds.length === 0) {
        return successResponse({
          studentCount: 0,
          feedbackCount: 0,
          thisMonthStudents: 0,
          thisMonthFeedbacks: 0,
          feedbackTrend: [],
          gradeDistribution: [],
          tagUsage: [],
          recentFeedbacks: [],
        });
      }
    } else {
      const classIds = await getTeacherClassIds(authUser.userId);
      if (classIds.length === 0) {
        // 教师没有班级，返回空统计
        return successResponse({
          studentCount: 0,
          feedbackCount: 0,
          thisMonthStudents: 0,
          thisMonthFeedbacks: 0,
          feedbackTrend: [],
          gradeDistribution: [],
          tagUsage: [],
          recentFeedbacks: [],
        });
      }
      const { data: teacherStudents } = await client
        .from("students")
        .select("id")
        .in("class_id", classIds)
        .or("is_active.eq.true,is_active.is.null");
      teacherStudentIds = teacherStudents?.map((s: { id: string }) => s.id) || [];
      if (teacherStudentIds.length === 0) {
        return successResponse({
          studentCount: 0,
          feedbackCount: 0,
          thisMonthStudents: 0,
          thisMonthFeedbacks: 0,
          feedbackTrend: [],
          gradeDistribution: [],
          tagUsage: [],
          recentFeedbacks: [],
        });
      }
    }
  }

  // 检查缓存（教师角色使用基于用户 ID 的缓存 key，管理员使用固定 key）
  const cacheKey = authUser.userRole === "teacher" ? `teacher:${authUser.userId}` : "admin";
  const cached = statsCacheMap.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return successResponse(cached.data);
  }

  try {
    const thisMonthStart = new Date();
    thisMonthStart.setDate(1);
    thisMonthStart.setHours(0, 0, 0, 0);
    const thisMonthStr = thisMonthStart.toISOString();

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString();

    // 合并所有可并行的查询为一次 Promise.all
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
      // 基础计数查询
      (() => {
        let q = client
          .from("students")
          .select("*", { count: "exact", head: true })
          .or("is_active.eq.true,is_active.is.null");
        if (teacherStudentIds) q = q.in("id", teacherStudentIds);
        return q;
      })(),
      (() => {
        let q = client
          .from("feedbacks")
          .select("*", { count: "exact", head: true });
        if (teacherStudentIds) q = q.in("student_id", teacherStudentIds);
        return q;
      })(),
      (() => {
        let q = client
          .from("students")
          .select("*", { count: "exact", head: true })
          .or("is_active.eq.true,is_active.is.null")
          .gte("created_at", thisMonthStr);
        if (teacherStudentIds) q = q.in("id", teacherStudentIds);
        return q;
      })(),
      (() => {
        let q = client
          .from("feedbacks")
          .select("*", { count: "exact", head: true })
          .gte("created_at", thisMonthStr);
        if (teacherStudentIds) q = q.in("student_id", teacherStudentIds);
        return q;
      })(),
      // 详细数据查询
      (() => {
        let q = client
          .from("feedbacks")
          .select("created_at")
          .gte("created_at", sevenDaysAgoStr)
          .order("created_at", { ascending: true });
        if (teacherStudentIds) q = q.in("student_id", teacherStudentIds);
        return q;
      })(),
      (() => {
        let q = client
          .from("students")
          .select("grade")
          .or("is_active.eq.true,is_active.is.null");
        if (teacherStudentIds) q = q.in("id", teacherStudentIds);
        return q;
      })(),
      (() => {
        let q = client
          .from("feedbacks")
          .select("strengths, weaknesses, improvements");
        if (teacherStudentIds) q = q.in("student_id", teacherStudentIds);
        return q;
      })(),
      (() => {
        let q = client
          .from("feedbacks")
          .select("id, created_at, student_id, status")
          .order("created_at", { ascending: false })
          .limit(5);
        if (teacherStudentIds) q = q.in("student_id", teacherStudentIds);
        return q;
      })(),
    ]);

    // 获取最近反馈对应的学员名称（依赖 recentFeedbacksListResult）
    const studentIds = recentFeedbacksListResult.data?.map((f) => f.student_id) || [];
    const studentsInfoResult = studentIds.length > 0
      ? await client.from("students").select("id, name").in("id", studentIds).or("is_active.eq.true,is_active.is.null")
      : { data: [] };

    // === 数据处理 ===

    // 按天分组统计反馈趋势
    const feedbackTrend: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      feedbackTrend[dateStr] = 0;
    }
    recentFeedbacksResult.data?.forEach((f) => {
      const dateStr = f.created_at.split("T")[0];
      if (feedbackTrend[dateStr] !== undefined) {
        feedbackTrend[dateStr]++;
      }
    });

    // 学员年级分布
    const gradeDistribution: Record<string, number> = {};
    gradeDistributionResult.data?.forEach((s) => {
      const grade = s.grade || "未设置";
      gradeDistribution[grade] = (gradeDistribution[grade] || 0) + 1;
    });

    // 标签使用统计
    const tagUsage: Record<string, { strength: number; improvement: number; weakness: number }> = {};

    feedbacksDataResult.data?.forEach((f) => {
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

    // 学员名称映射
    const studentMap: Record<string, string> = {};
    studentsInfoResult.data?.forEach((s: { id: string; name: string }) => {
      studentMap[s.id] = s.name;
    });

    const recentFeedbacksWithName = recentFeedbacksListResult.data?.map((f) => ({
      ...f,
      student_name: studentMap[f.student_id] || "未知学员",
    }));

    const result = {
      studentCount: studentsCountResult.count || 0,
      feedbackCount: feedbacksCountResult.count || 0,
      thisMonthStudents: thisMonthStudentsResult.count || 0,
      thisMonthFeedbacks: thisMonthFeedbacksResult.count || 0,
      feedbackTrend: Object.entries(feedbackTrend).map(([date, count]) => ({
        date,
        count,
      })),
      gradeDistribution: Object.entries(gradeDistribution).map(([grade, count]) => ({
        grade,
        count,
      })),
      tagUsage: Object.entries(tagUsage)
        .map(([tag, counts]) => ({
          tag,
          ...counts,
          total: counts.strength + counts.improvement + counts.weakness,
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10),
      recentFeedbacks: recentFeedbacksWithName || [],
    };

    // 更新缓存
    statsCacheMap.set(cacheKey, { data: result, timestamp: Date.now() });

    return successResponse(result);
  } catch (error) {
    return handleDbError(error, "获取统计数据");
  }
});
