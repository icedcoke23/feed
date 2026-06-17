import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/storage/database/supabase-client";
import { handleDbError } from "@/lib/api-error";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { extractLegacyMetadata } from "@/utils/ai-report";

// GET /api/students/[id]/history - 获取学员历史反馈
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  const client = getServerSupabaseClient();
  const { id } = await params;

  try {
    // 校验学生存在且未软删除
    const { data: student, error: studentError } = await client
      .from("students")
      .select("id, is_active")
      .eq("id", id)
      .single();

    if (studentError || !student) {
      return errorResponse("学员不存在", 404);
    }
    if (student.is_active === false) {
      return errorResponse("该学员已被删除", 404);
    }

    const { data, error } = await client
      .from("feedbacks")
      .select(`
        id,
        created_at,
        strengths,
        improvements,
        weaknesses,
        ai_report,
        metadata,
        suggestions,
        status
      `)
      .eq("student_id", id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      return handleDbError(error, "获取学员历史");
    }

    // 转换数据格式
    const history = (data || []).map((fb) => {
      // 优先从 metadata 字段读取元数据，向后兼容从 ai_report 读取
      let metadataSource: Record<string, unknown> = {};
      if (fb.metadata && typeof fb.metadata === 'object') {
        metadataSource = fb.metadata as Record<string, unknown>;
      } else if (fb.ai_report) {
        const legacy = extractLegacyMetadata(fb.ai_report);
        if (legacy) metadataSource = legacy;
      }

      // 从 metadata 中的标签评分计算综合评分
      let overallRating: number | null = null;
      if (metadataSource.tags && Array.isArray(metadataSource.tags)) {
        const ratings = metadataSource.tags
          .map((t: { rating?: number }) => t.rating)
          .filter((r: number | undefined): r is number => typeof r === 'number' && r > 0);
        if (ratings.length > 0) {
          overallRating = Math.round((ratings.reduce((sum: number, r: number) => sum + r, 0) / ratings.length) * 10) / 10;
        }
      }
      // TODO: overallRating 需要更完善的计算逻辑，当前仅基于 metadata.tags 的评分取平均值

      return {
        id: fb.id,
        feedback_date: fb.created_at,
        teaching_theme: (metadataSource.theme as string) || "教学反馈",
        overall_rating: overallRating,
        strengths: Array.isArray(fb.strengths)
          ? fb.strengths.map((s: { tag?: string; name?: string; content?: string }) => s.tag || s.name || s.content || "").filter(Boolean)
          : [],
        areas_for_improvement: Array.isArray(fb.weaknesses)
          ? fb.weaknesses.map((w: { tag?: string; name?: string; content?: string }) => w.tag || w.name || w.content || "").filter(Boolean)
          : [],
        improvements: Array.isArray(fb.improvements)
          ? fb.improvements.map((i: { tag?: string; name?: string; content?: string }) => i.tag || i.name || i.content || "").filter(Boolean)
          : [],
        suggestions: fb.suggestions || "",
      };
    });

    return successResponse(history);
  } catch (error) {
    console.error("Failed to fetch history:", error);
    return successResponse([]);
  }
}
