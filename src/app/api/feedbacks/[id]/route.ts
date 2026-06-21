import { NextRequest } from "next/server";
import { validateInput } from "@/lib/validations";
import { z } from "zod";
import { handleDbError } from "@/lib/api-error";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import * as feedbackService from "@/lib/services/feedback-service";

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
  recommendations: z.string().optional(),
  aiReport: z.string().optional(),
  ai_report: z.string().optional(),
  periodStart: z.string().optional(),
  period_start: z.string().optional(),
  periodEnd: z.string().optional(),
  period_end: z.string().optional(),
  feedback_date: z.string().optional(),
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

  const { id } = await params;

  try {
    const data = await feedbackService.findById(authUser, id);
    if (data instanceof Response) {
      return data;
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

  const { id } = await params;
  const body = await request.json();

  const result = validateInput(updateFeedbackSchema, body);
  if ("error" in result) return result.error;
  const validatedData = result.data;

  try {
    const data = await feedbackService.update(authUser, id, validatedData);
    if (data instanceof Response) {
      return data;
    }
    return successResponse(data);
  } catch (error) {
    return handleDbError(error, "更新反馈");
  }
}

// DELETE /api/feedbacks/[id] - 删除反馈
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  const { id } = await params;

  try {
    const result = await feedbackService.remove(authUser, id);
    if (result instanceof Response) {
      return result;
    }
    return successResponse(null, "删除成功");
  } catch (error) {
    return handleDbError(error, "删除反馈");
  }
}
