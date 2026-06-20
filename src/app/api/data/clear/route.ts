import { withDbError } from "@/lib/route-handlers/with-db-error";
import { withAuth } from "@/lib/route-handlers/with-auth";
import { forbiddenError } from "@/lib/api-error";
import { successResponse } from "@/lib/api-response";
import { dataService } from "@/lib/services";

export const DELETE = withDbError(
  withAuth(async (req, { authUser }) => {
    if (authUser!.userRole !== "admin") {
      return forbiddenError("仅管理员可执行此操作");
    }

    const result = await dataService.clearAll();
    return successResponse(
      {
        ...result,
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
  })
);
