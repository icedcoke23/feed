import { NextRequest } from "next/server";
import * as dataService from "@/lib/services/data-service";
import { handleDbError, forbiddenError } from "@/lib/api-error";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse } from "@/lib/api-response";

// DELETE /api/data/clear - 清空所有业务数据
export async function DELETE(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  if (authUser.userRole !== "admin") {
    return forbiddenError("仅管理员可执行此操作");
  }

  try {
    const result = await dataService.clearAll();

    return successResponse(
      {
        details: result.details,
        notes: [
          "所有学员数据已清空",
          "所有班级数据已清空",
          "所有反馈记录已清空",
          "所有转班记录已清空",
          "所有教学主题已清空",
          "所有标签已清空",
          "所有课程阶段已清空",
          "所有教师用户已清空",
          "管理员用户已保留",
        ],
      },
      "所有业务数据和教师用户已清空，管理员用户已保留"
    );
  } catch (error) {
    return handleDbError(error, "清空数据");
  }
}
