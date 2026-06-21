import { NextRequest } from "next/server";
import * as dataService from "@/lib/services/data-service";
import { handleDbError, forbiddenError } from "@/lib/api-error";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse } from "@/lib/api-response";

// POST /api/data/reset-admin - 清空所有数据并创建管理员账户
export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  if (authUser.userRole !== "admin") {
    return forbiddenError("仅管理员可访问");
  }

  try {
    const result = await dataService.resetAdmin();

    return successResponse(
      {
        adminCredentials: result.adminCredentials,
        logs: result.logs,
      },
      "数据库已重置，管理员账户已创建"
    );
  } catch (error) {
    return handleDbError(error, "重置数据");
  }
}
