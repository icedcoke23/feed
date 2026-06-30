import { NextRequest } from "next/server";
import { forbiddenError, badRequestError } from "@/lib/api-error";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { getAdminTeacherMappings } from "@/lib/config/default-admins";
import { updateAdminTeacherSchema } from "@/lib/validations/data-import";
import { sanitizeError } from "@/lib/sensitive-mask";
import * as batchImportService from "@/lib/services/batch-import-service";
import { enforceRateLimit } from "@/lib/rate-limit";

// POST /api/batch-import/update-admin-teacher - 批量更新学员教务老师
export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  if (authUser.userRole !== "admin") {
    return forbiddenError("仅管理员可访问");
  }

  // 批量更新限流：每用户每分钟 5 次
  const limited = enforceRateLimit(`batch-admin-teacher:${authUser.userId}`, 5, 60_000);
  if (limited) return limited;

  const adminTeacherMappings = getAdminTeacherMappings();
  if (Object.keys(adminTeacherMappings).length === 0) {
    return badRequestError("未配置 ADMIN_TEACHER_MAPPINGS 环境变量");
  }

  try {
    const body = await request.json();
    const parsed = updateAdminTeacherSchema.safeParse(body);
    if (!parsed.success) {
      return badRequestError("请求参数错误", parsed.error.flatten());
    }

    const result = await batchImportService.updateAdminTeachers(
      parsed.data.students,
      adminTeacherMappings
    );

    return successResponse({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Update admin teacher error:", sanitizeError(error));
    return errorResponse("更新失败", 500);
  }
}
