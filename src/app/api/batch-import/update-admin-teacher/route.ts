import { NextRequest } from "next/server";
import { forbiddenError, badRequestError } from "@/lib/api-error";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { getAdminTeacherMappings } from "@/lib/config/default-admins";
import * as batchImportService from "@/lib/services/batch-import-service";

// POST /api/batch-import/update-admin-teacher - 批量更新学员教务老师
export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  if (authUser.userRole !== "admin") {
    return forbiddenError("仅管理员可访问");
  }

  const adminTeacherMappings = getAdminTeacherMappings();
  if (Object.keys(adminTeacherMappings).length === 0) {
    return badRequestError("未配置 ADMIN_TEACHER_MAPPINGS 环境变量");
  }

  try {
    const body = await request.json();
    const { students } = body as { students: batchImportService.UpdateAdminTeacherInput[] };

    if (!students || !Array.isArray(students)) {
      return errorResponse("请提供学员数据", 400);
    }

    const result = await batchImportService.updateAdminTeachers(
      students,
      adminTeacherMappings
    );

    return successResponse({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Update admin teacher error:", error);
    return errorResponse("更新失败", 500);
  }
}
