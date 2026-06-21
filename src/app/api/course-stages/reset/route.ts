import { NextRequest } from "next/server";
import { handleDbError } from "@/lib/api-error";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { sanitizeError } from "@/lib/sensitive-mask";
import * as courseStageService from "@/lib/services/course-stage-service";

// POST /api/course-stages/reset - 重置课程阶段为默认预设
export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  try {
    const result = await courseStageService.resetToDefaults(authUser);
    if (result instanceof Response) {
      return result;
    }

    return successResponse(result, `已成功重置为默认预设，共 ${result.count} 条数据`);
  } catch (error) {
    console.error("Exception in reset course-stages:", sanitizeError(error));
    return handleDbError(error, "重置课程阶段");
  }
}
