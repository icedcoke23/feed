import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { handleDbError } from "@/lib/api-error";
import { parsePagination } from "@/lib/pagination";
import * as homeService from "@/lib/services/home-service";

// GET /api/home-data
// 一次返回首页所需的所有数据：学生、班级、教师
export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  const { page, limit } = parsePagination(request);

  try {
    const result = await homeService.getHomeData(authUser, { page, limit });

    if (result instanceof Response) {
      return result;
    }

    return successResponse(result);
  } catch (error) {
    return handleDbError(error, "获取首页数据");
  }
}
