import { NextRequest, NextResponse } from "next/server";
import * as dataService from "@/lib/services/data-service";
import { handleDbError, forbiddenError } from "@/lib/api-error";
import { getAuthUser } from "@/lib/route-auth";
import { errorResponse } from "@/lib/api-response";

// POST /api/data/backup - 备份所有数据，返回 JSON 文件下载
export async function POST(request: NextRequest): Promise<NextResponse> {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  if (authUser.userRole !== "admin") {
    return forbiddenError("仅管理员可访问");
  }

  try {
    const backup = await dataService.backupAll();
    const filename = `teaching-feedback-backup-${new Date().toISOString().split("T")[0]}.json`;

    return new NextResponse(JSON.stringify(backup, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return handleDbError(error, "备份数据");
  }
}
