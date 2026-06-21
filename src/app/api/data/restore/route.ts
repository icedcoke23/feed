import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as dataService from "@/lib/services/data-service";
import type { BackupData, RestoreSelection } from "@/lib/services/data-service";
import { handleDbError, forbiddenError } from "@/lib/api-error";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse } from "@/lib/api-response";

const restoreSchema = z.object({
  data: z.any(),
  selections: z.array(z.string()).min(1, { message: "至少选择一个恢复项" }),
});

// POST /api/data/restore - 按选择项从备份中恢复数据
export async function POST(request: NextRequest): Promise<NextResponse> {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  if (authUser.userRole !== "admin") {
    return forbiddenError("仅管理员可访问");
  }

  try {
    const body = await request.json();
    const parsed = restoreSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("请求参数错误", 400);
    }

    const { data, selections } = parsed.data;
    const backup = data as unknown as BackupData;

    // 基本格式校验
    if (!backup.version || !backup.backupAt) {
      return errorResponse("无效的备份文件格式", 400);
    }

    const validSelections = selections.filter((s): s is RestoreSelection =>
      [
        "users",
        "teachers",
        "classes",
        "students",
        "classTransfers",
        "feedbacks",
        "themes",
        "tags",
        "courseStages",
        "aiSettings",
        "coursePrompts",
      ].includes(s)
    );

    if (validSelections.length === 0) {
      return errorResponse("没有有效的恢复项", 400);
    }

    const { results, logs } = await dataService.restoreData(backup, validSelections);

    return successResponse(
      { results, logs, selections: validSelections },
      "数据恢复完成"
    );
  } catch (error) {
    return handleDbError(error, "恢复数据");
  }
}
