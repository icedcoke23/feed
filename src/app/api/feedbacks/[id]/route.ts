import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/storage/database/supabase-client";
import { validateInput } from "@/lib/validations";
import { handleDbError } from "@/lib/api-error";
import { getAuthUser, canTeacherAccessStudent } from "@/lib/route-auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { z } from "zod";

// 学情分析项 schema：与数据库 jsonb 列保持一致
const feedbackItemSchema = z.object({
  tag: z.string(),
  description: z.string().optional(),
});

// 反馈更新 schema：接受对象数组，同时兼容 camelCase 和 snake_case
const updateFeedbackSchema = z.object({
  strengths: z.array(feedbackItemSchema).optional(),
  improvements: z.array(feedbackItemSchema).optional(),
  weaknesses: z.array(feedbackItemSchema).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  status: z.string().optional(),
  suggestions: z.string().optional(),
  aiReport: z.string().optional(),
  ai_report: z.string().optional(),
  periodStart: z.string().optional(),
  period_start: z.string().optional(),
  periodEnd: z.string().optional(),
  period_end: z.string().optional(),
  teachingPlan: z.string().optional(),
  teaching_plan: z.string().optional(),
  workInfo: z.string().optional(),
  work_info: z.string().optional(),
  abilityScores: z.record(z.string(), z.number()).optional(),
  ability_scores: z.record(z.string(), z.number()).optional(),
});

// GET /api/feedbacks/[id] - 获取单个反馈详情
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

  // 教师权限隔离：检查反馈所属学生是否在教师班级中
  if (authUser.userRole === "teacher") {
    const { data: feedback } = await client
      .from("feedbacks")
      .select("student_id")
      .eq("id", id)
      .single();
    if (!feedback || !(await canTeacherAccessStudent(authUser.userId, feedback.student_id))) {
      return errorResponse("无权查看该反馈", 403);
    }
  }

  try {
    const { data, error } = await client
      .from("feedbacks")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return errorResponse(error.message, 500);
    }

    if (!data) {
      return errorResponse("Feedback not found", 404);
    }

    return successResponse(data);
  } catch (error) {
    return handleDbError(error, "获取反馈");
  }
}

// PUT /api/feedbacks/[id] - 更新反馈
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  const client = getServerSupabaseClient();
  const { id } = await params;
  const body = await request.json();

  // 教师权限隔离：检查反馈所属学生是否在教师班级中
  if (authUser.userRole === "teacher") {
    const { data: feedback } = await client
      .from("feedbacks")
      .select("student_id")
      .eq("id", id)
      .single();
    if (!feedback || !(await canTeacherAccessStudent(authUser.userId, feedback.student_id))) {
      return errorResponse("无权操作该反馈", 403);
    }
  }

  const result = validateInput(updateFeedbackSchema, body);
  if ("error" in result) return result.error;
  const validatedData = result.data;

  try {
    // 原子递增版本号，避免并发竞态条件
    const { data: newVersion, error: versionError } = await client
      .rpc("increment_feedback_version", { feedback_id: id });

    if (versionError) {
      return handleDbError(versionError, "递增版本号");
    }

    // 仅更新传入的字段，避免 undefined 覆盖已有数据
    const updatePayload: Record<string, unknown> = {
      ...(validatedData.strengths !== undefined && { strengths: validatedData.strengths }),
      ...(validatedData.improvements !== undefined && { improvements: validatedData.improvements }),
      ...(validatedData.weaknesses !== undefined && { weaknesses: validatedData.weaknesses }),
      ...(validatedData.teachingPlan !== undefined || validatedData.teaching_plan !== undefined
        ? { teaching_plan: validatedData.teachingPlan || validatedData.teaching_plan }
        : {}),
      ...(validatedData.suggestions !== undefined && { suggestions: validatedData.suggestions }),
      ...(validatedData.aiReport !== undefined || validatedData.ai_report !== undefined
        ? { ai_report: validatedData.aiReport || validatedData.ai_report }
        : {}),
      ...(validatedData.metadata !== undefined && { metadata: validatedData.metadata }),
      ...(validatedData.workInfo !== undefined || validatedData.work_info !== undefined
        ? { work_info: validatedData.workInfo || validatedData.work_info }
        : {}),
      ...(validatedData.abilityScores !== undefined || validatedData.ability_scores !== undefined
        ? { ability_scores: validatedData.abilityScores || validatedData.ability_scores }
        : {}),
      ...(validatedData.status !== undefined && { status: validatedData.status }),
      ...(validatedData.periodStart !== undefined || validatedData.period_start !== undefined
        ? { period_start: validatedData.periodStart || validatedData.period_start }
        : {}),
      ...(validatedData.periodEnd !== undefined || validatedData.period_end !== undefined
        ? { period_end: validatedData.periodEnd || validatedData.period_end }
        : {}),
      version: newVersion,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await client
      .from("feedbacks")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return handleDbError(error, "更新反馈");
    }

    return successResponse(data);
  } catch (error) {
    return handleDbError(error, "更新反馈");
  }
}

// DELETE /api/feedbacks/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  const client = getServerSupabaseClient();
  const { id } = await params;

  // 教师权限隔离：检查反馈所属学生是否在教师班级中
  if (authUser.userRole === "teacher") {
    const { data: feedback } = await client
      .from("feedbacks")
      .select("student_id")
      .eq("id", id)
      .single();
    if (!feedback || !(await canTeacherAccessStudent(authUser.userId, feedback.student_id))) {
      return errorResponse("无权删除该反馈", 403);
    }
  }

  try {
    const { error } = await client.from("feedbacks").delete().eq("id", id);

    if (error) {
      return handleDbError(error, "删除反馈");
    }

    return successResponse(null, "删除成功");
  } catch (error) {
    return handleDbError(error, "删除反馈");
  }
}
