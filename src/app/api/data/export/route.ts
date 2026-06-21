import { NextRequest, NextResponse } from "next/server";
import * as dataService from "@/lib/services/data-service";
import { handleDbError, forbiddenError } from "@/lib/api-error";
import { getAuthUser } from "@/lib/route-auth";
import { errorResponse } from "@/lib/api-response";

// GET /api/data/export - 导出所有数据为JSON
export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  if (authUser.userRole !== "admin") {
    return forbiddenError("仅管理员可访问");
  }

  try {
    const exportData = await dataService.exportAll();
    return NextResponse.json(exportData);
  } catch (error) {
    return handleDbError(error, "导出数据");
  }
}
