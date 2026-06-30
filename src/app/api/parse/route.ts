import { NextRequest } from "next/server";
import { z } from "zod";
import { validateInput } from "@/lib/validations";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { sanitizeError } from "@/lib/sensitive-mask";
import { parseService } from "@/lib/services";
import { enforceRateLimit } from "@/lib/rate-limit";

const parseSchema = z.object({
  content: z.string().min(1).max(10000),
  type: z.enum(["students", "themes", "tags"]).optional(),
});

// POST /api/parse - AI智能解析数据
export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  // AI 解析限流：每用户每分钟 10 次
  const limited = enforceRateLimit(`parse:${authUser.userId}`, 10, 60_000);
  if (limited) return limited;

  const body = await request.json();
  const result = validateInput(parseSchema, body);
  if ("error" in result) return result.error;
  const { content, type } = result.data;

  try {
    const parsed = await parseService.parseContent(content, type);
    // service 返回 Response 表示配置错误（已含统一错误格式）
    if (parsed instanceof Response) {
      return parsed;
    }
    return successResponse(parsed);
  } catch (error) {
    console.error("Parse error:", sanitizeError(error));
    return errorResponse("解析失败，请检查输入格式", 500);
  }
}
