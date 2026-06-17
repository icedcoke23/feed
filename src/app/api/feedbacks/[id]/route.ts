import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/storage/database/supabase-client";
import { validateInput } from "@/lib/validations";
import { insertFeedbackSchema } from "@/storage/database/shared/schema";
import { handleDbError } from "@/lib/api-error";
import { getAuthUser, canTeacherAccessStudent } from "@/lib/route-auth";
import { successResponse, errorResponse } from "@/lib/api-response";

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

  const result = validateInput(insertFeedbackSchema.partial(), body);
  if ("error" in result) return result.error;
  const validatedData = result.data;

  try {
    // 原子递增版本号，避免并发竞态条件
    const { data: newVersion, error: versionError } = await client
      .rpc("increment_feedback_version", { feedback_id: id });

    if (versionError) {
      return handleDbError(versionError, "递增版本号");
    }

    const { data, error } = await client
      .from("feedbacks")
      .update({
        strengths: validatedData.strengths,
        improvements: validatedData.improvements,
        weaknesses: validatedData.weaknesses,
        teaching_plan: validatedData.teachingPlan,
        suggestions: validatedData.suggestions,
        ai_report: validatedData.aiReport,
        metadata: validatedData.metadata,
        work_info: validatedData.workInfo,
        ability_scores: validatedData.abilityScores,
        status: validatedData.status,
        period_start: validatedData.periodStart,
        period_end: validatedData.periodEnd,
        version: newVersion,
        updated_at: new Date().toISOString(),
      })
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
