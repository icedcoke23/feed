import { NextRequest } from "next/server";
import { handleDbError } from "@/lib/api-error";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { withLogging } from "@/lib/api-logger";
import * as statsService from "@/lib/services/stats-service";

// GET /api/stats - 获取统计数据
export const GET = withLogging(async (request: NextRequest) => {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  try {
    const result = await statsService.getStats(authUser);

    if (result instanceof Response) {
      return result;
    }

    return successResponse(result);
  } catch (error) {
    return handleDbError(error, "获取统计数据");
  }
});
