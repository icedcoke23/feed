import { NextRequest } from "next/server";
import { validateInput } from "@/lib/validations";
import { z } from "zod";
import { handleDbError } from "@/lib/api-error";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse, paginatedResponse } from "@/lib/api-response";
import { parsePagination } from "@/lib/pagination";
import * as feedbackService from "@/lib/services/feedback-service";

// 学情分析项 schema：与数据库 jsonb 列保持一致
const feedbackItemSchema = z.object({
  tag: z.string(),
  description: z.string().optional(),
});

// 反馈创建 schema：核心字段必填，同时兼容 camelCase 和 snake_case
const createFeedbackSchema = z.object({
  studentId: z.string().min(1, "缺少学员ID").optional(),
  student_id: z.string().min(1, "缺少学员ID").optional(),
  teacherId: z.string().min(1, "缺少教师ID").optional(),
  teacher_id: z.string().min(1, "缺少教师ID").optional(),
  strengths: z.array(feedbackItemSchema).optional(),
  improvements: z.array(feedbackItemSchema).optional(),
  weaknesses: z.array(feedbackItemSchema).optional(),
  teachingPlan: z.string().optional(),
  teaching_plan: z.string().optional(),
  course_plans: z.string().optional(),
  suggestions: z.string().optional(),
  recommendations: z.string().optional(),
  aiReport: z.string().optional(),
  ai_report: z.string().optional(),
  status: z.string().optional(),
  periodStart: z.string().optional(),
  period_start: z.string().optional(),
  periodEnd: z.string().optional(),
  period_end: z.string().optional(),
  feedback_date: z.string().optional(),
  // 额外元数据字段
  student_name: z.string().optional(),
  teacher_name: z.string().optional(),
  teacher_phone: z.string().optional(),
  theme: z.string().optional(),
  tag_ratings: z.record(z.string(), z.number()).optional(),
  has_course_plan: z.boolean().optional(),
  current_stage_id: z.string().optional(),
  campus: z.string().optional(),
  grade: z.string().optional(),
  class_name: z.string().optional(),
  school: z.string().optional(),
  summary: z.string().optional(),
  // 作品信息和能力评分
  workInfo: z.string().optional(),
  work_info: z.string().optional(),
  abilityScores: z.record(z.string(), z.number()).optional(),
  ability_scores: z.record(z.string(), z.number()).optional(),
  // 照片数据
  student_photos: z.array(z.object({ id: z.string(), url: z.string() })).optional(),
  // 元数据（前端已组装好的完整对象，会与其他字段合并）
  metadata: z.record(z.string(), z.unknown()).optional(),
}).refine(
  (data) => data.studentId || data.student_id,
  { message: "缺少学员ID" }
).refine(
  (data) => data.teacherId || data.teacher_id,
  { message: "缺少教师ID" }
);

// GET /api/feedbacks - 获取反馈列表
export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get("studentId") || undefined;
  const teacherId = searchParams.get("teacherId") || undefined;
  const status = searchParams.get("status") || undefined;

  // 分页参数
  const { page, limit } = parsePagination(request);

  try {
    const result = await feedbackService.list(authUser, {
      page,
      limit,
      studentId,
      teacherId,
      status,
    });

    return paginatedResponse(result.data, result.pagination);
  } catch (error) {
    return handleDbError(error, "获取反馈列表");
  }
}

// POST /api/feedbacks - 创建反馈
export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  const body = await request.json();

  // 校验输入
  const result = validateInput(createFeedbackSchema, body);
  if ("error" in result) return result.error;
  const validatedData = result.data;

  try {
    const data = await feedbackService.create(authUser, validatedData);
    if (data instanceof Response) {
      return data;
    }
    return successResponse(data);
  } catch (error) {
    return handleDbError(error, "创建反馈");
  }
}
