import { NextRequest } from "next/server";
import { handleDbError, badRequestError } from "@/lib/api-error";
import { successResponse, errorResponse } from "@/lib/api-response";
import { getAuthUser } from "@/lib/route-auth";
import { initDataSchema } from "@/lib/validations/data-import";
import { sanitizeError } from "@/lib/sensitive-mask";
import * as initDataService from "@/lib/services/init-data-service";

// POST /api/init-data - 初始化预设数据
export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = initDataSchema.safeParse(body);
    if (!parsed.success) {
      return badRequestError("请求参数错误", parsed.error.flatten());
    }

    const result = await initDataService.initializeDefaults();

    if (result.skipped) {
      return successResponse(null, "数据已初始化，跳过");
    }

    return successResponse(
      {
        tags: result.tags,
        themes: result.themes,
        courseStages: result.courseStages,
      },
      "初始化成功"
    );
  } catch (error) {
    console.error("Init error:", sanitizeError(error));
    return handleDbError(error, "初始化数据");
  }
}
