import { NextRequest } from "next/server";
import { handleDbError } from "@/lib/api-error";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { sanitizeError } from "@/lib/sensitive-mask";
import * as courseStageService from "@/lib/services/course-stage-service";

// PATCH /api/course-stages/fix-active - 修复 is_active 字段
export async function PATCH(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  try {
    const result = await courseStageService.fixActiveStages(authUser);
    if (result instanceof Response) {
      return result;
    }

    return successResponse(result, `已修复 ${result.changed} 条记录`);
  } catch (error) {
    console.error("Error fixing is_active:", sanitizeError(error));
    return handleDbError(error, "修复is_active");
  }
}
