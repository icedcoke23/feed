import { NextRequest } from "next/server";
import { z } from "zod";
import { validateInput } from "@/lib/validations";
import * as generateService from "@/lib/services/generate-service";
import { getAuthUser } from "@/lib/route-auth";
import { errorResponse } from "@/lib/api-response";
import { unauthorizedError } from "@/lib/api-error";
import { sanitizeError } from "@/lib/sensitive-mask";
import { enforceRateLimit } from "@/lib/rate-limit";

const generateSchema = z.object({
  studentName: z.string().min(1).max(50),
  grade: z.string().max(50).optional(),
  className: z.string().max(100).optional(),
  theme: z.string().max(100).optional(),
  themeCategory: z.string().max(50).optional(),
  tagInfo: z.array(z.object({
    name: z.string().max(50),
    category: z.enum(["strength", "improvement", "weakness"]),
    rating: z.number().min(1).max(5),
    note: z.string().max(200).optional().nullable(),
  })).optional(),
  ratings: z.record(z.string(), z.number().min(1).max(5)).optional(),
  notes: z.string().max(2000).optional(),
  courseStageInfo: z.string().max(1000).optional(),
  historyFeedback: z.string().max(3000).optional(),
  history: z.array(z.any()).optional(),
  promptStageCode: z.string().max(50).optional(),
  currentStageId: z.string().max(50).optional(),
  level: z.string().max(50).optional(),
});

// POST /api/generate - 流式生成教学反馈报告
export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return unauthorizedError("未授权访问");
  }

  // AI 生成限流：每用户每分钟 10 次（LLM 调用成本高）
  const limited = enforceRateLimit(`generate:${authUser.userId}`, 10, 60_000);
  if (limited) return limited;

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse("请求体解析失败", 400);
    }
    const result = validateInput(generateSchema, body);
    if ("error" in result) return result.error;

    return await generateService.generateFeedback(result.data);
  } catch (error) {
    console.error("Generate error:", sanitizeError(error));
    const rawMessage = error instanceof Error ? error.message : "未知错误";
    const sanitizedMessage = rawMessage
      .replace(/https?:\/\/[^\s]+/gi, "[URL]")
      .replace(/sk-[a-zA-Z0-9]{8,}/g, "[KEY]");
    return errorResponse(`生成失败: ${sanitizedMessage}`, 500);
  }
}
