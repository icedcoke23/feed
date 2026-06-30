import { NextRequest } from "next/server";
import * as dataService from "@/lib/services/data-service";
import type { ImportData } from "@/lib/repositories/data-repository";
import { handleDbError, forbiddenError } from "@/lib/api-error";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";

// POST /api/data/import - 导入JSON数据
export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  if (authUser.userRole !== "admin") {
    return forbiddenError("仅管理员可访问");
  }

  // 数据导入限流：每用户每分钟 3 次（重操作）
  const limited = enforceRateLimit(`data-import:${authUser.userId}`, 3, 60_000);
  if (limited) return limited;

  try {
    const body = await request.json();

    if (!body.data) {
      return errorResponse("无效的导入数据格式", 400);
    }

    const mode: "overwrite" | "incremental" = body.mode || "incremental";
    const data = body.data as ImportData;

    // 检查数据总量限制
    const totalItems =
      (data.students?.length || 0) +
      (data.classes?.length || 0) +
      (data.feedbacks?.length || 0) +
      (data.themes?.length || 0) +
      (data.tags?.length || 0) +
      (data.courseStages?.length || 0) +
      (data.classTransfers?.length || 0) +
      (data.teachers?.length || 0);
    if (totalItems > 500) {
      return errorResponse(
        `数据总量超过限制（当前${totalItems}条，最多500条）`,
        400
      );
    }

    const { results, logs } = await dataService.importData(data, mode);

    const totalSuccess = Object.values(results).reduce(
      (sum, r) => sum + r.success,
      0
    );
    const totalFailed = Object.values(results).reduce(
      (sum, r) => sum + r.failed,
      0
    );
    const totalSkipped = Object.values(results).reduce(
      (sum, r) => sum + r.skipped,
      0
    );

    const message =
      mode === "overwrite"
        ? `覆盖导入完成：成功 ${totalSuccess}，失败 ${totalFailed}`
        : `增量导入完成：成功 ${totalSuccess}，跳过 ${totalSkipped}，失败 ${totalFailed}`;

    return successResponse(
      {
        mode,
        results,
        summary: { totalSuccess, totalFailed, totalSkipped },
        logs,
      },
      message
    );
  } catch (error) {
    return handleDbError(error, "导入数据");
  }
}
