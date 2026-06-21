import { NextRequest } from "next/server";
import { z } from "zod";
import { validateInput } from "@/lib/validations";
import * as generateService from "@/lib/services/generate-service";
import { getAuthUser } from "@/lib/route-auth";
import { errorResponse } from "@/lib/api-response";
import { unauthorizedError } from "@/lib/api-error";

const reviewSchema = z.object({
  studentName: z.string().max(50).optional(),
  theme: z.string().max(100).optional(),
  report: z.object({
    strengths: z.string().optional(),
    improvements: z.string().optional(),
    weaknesses: z.string().optional(),
    recommendations: z.string().optional(),
    summary: z.string().optional(),
  }),
  tagInfo: z.array(z.object({
    name: z.string().max(50),
    rating: z.number().min(1).max(5),
    note: z.string().max(200).optional().nullable(),
  })).optional(),
  promptStageCode: z.string().max(50).optional(),
  currentStageId: z.string().max(50).optional(),
  level: z.string().max(50).optional(),
});

// POST /api/generate/review - 流式复检并优化教学反馈报告
export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return unauthorizedError("未授权访问");
  }

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse("请求体解析失败", 400);
    }
    const result = validateInput(reviewSchema, body);
    if ("error" in result) return result.error;

    return await generateService.reviewFeedback(result.data);
  } catch (error) {
    console.error("Review error:", error);
    const rawMessage = error instanceof Error ? error.message : "未知错误";
    const sanitizedMessage = rawMessage
      .replace(/https?:\/\/[^\s]+/gi, "[URL]")
      .replace(/sk-[a-zA-Z0-9]{8,}/g, "[KEY]");
    return errorResponse(`复检失败: ${sanitizedMessage}`, 500);
  }
}
