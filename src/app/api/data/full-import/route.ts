import { NextRequest } from "next/server";
import * as dataService from "@/lib/services/data-service";
import type { ImportData } from "@/lib/repositories/data-repository";
import { handleDbError, forbiddenError } from "@/lib/api-error";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse } from "@/lib/api-response";

// POST /api/data/full-import - 完整导入数据（保留原 ID，先清空再导入）
export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  if (authUser.userRole !== "admin") {
    return forbiddenError("仅管理员可访问");
  }

  try {
    const body = await request.json();
    const data = (body.data || body) as ImportData;

    // 检查数据总量限制
    const totalItems =
      (data.students?.length || 0) +
      (data.classes?.length || 0) +
      (data.themes?.length || 0) +
      (data.tags?.length || 0) +
      (data.courseStages?.length || 0) +
      (data.teachers?.length || 0);
    if (totalItems > 500) {
      return errorResponse(
        `数据总量超过限制（当前${totalItems}条，最多500条）`,
        400
      );
    }

    const { results, logs, errors, format } = await dataService.fullImport(data);

    return successResponse(
      {
        format,
        results,
        logs,
        errors: errors.length > 0 ? errors.slice(0, 20) : undefined,
      },
      "数据导入完成"
    );
  } catch (error) {
    return handleDbError(error, "导入");
  }
}
