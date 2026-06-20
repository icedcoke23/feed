import { z } from "zod";
import { withDbError } from "@/lib/route-handlers/with-db-error";
import { withAuth } from "@/lib/route-handlers/with-auth";
import { withValidation } from "@/lib/route-handlers/with-validation";
import { successResponse, errorResponse } from "@/lib/api-response";
import { batchImportService } from "@/lib/services";
import { getAdminTeacherMappings } from "@/lib/config/default-admins";

const updateAdminTeacherSchema = z.object({
  students: z.array(
    z.object({
      name: z.string().min(1, "学员姓名不能为空"),
      adminType: z.string().min(1, "教务老师类型不能为空"),
    })
  ).min(1, "请提供学员数据").max(500, "单次最多处理500条记录"),
});

export const POST = withDbError(
  withAuth(
    withValidation(
      { body: updateAdminTeacherSchema },
      async (req, { authUser, body }) => {
        if (authUser!.userRole !== "admin") {
          return errorResponse("仅管理员可访问", 403, "FORBIDDEN");
        }

        const mappings = getAdminTeacherMappings();
        if (Object.keys(mappings).length === 0) {
          return errorResponse("未配置 ADMIN_TEACHER_MAPPINGS 环境变量", 400);
        }

        const input = body as { students: batchImportService.UpdateAdminTeacherInput[] };
        const result = await batchImportService.updateAdminTeachers(input.students, mappings);

        return successResponse(result, `成功更新 ${result.updated} 条记录`);
      }
    )
  )
);
