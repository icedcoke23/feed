import { NextRequest } from "next/server";
import { forbiddenError } from "@/lib/api-error";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import * as batchImportService from "@/lib/services/batch-import-service";

// 教务老师用户名映射（通过用户名动态查询，不再硬编码 UUID）
const ADMIN_TEACHER_USERNAMES: Record<string, string> = {
  "心": "心心",
  "高": "燕子",
};

interface StudentWithAdmin {
  name: string;
  adminType: "心" | "高";
}

// POST /api/batch-import/update-admin-teacher - 批量更新学员教务老师
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
    const { students } = body as { students: StudentWithAdmin[] };

    if (!students || !Array.isArray(students)) {
      return errorResponse("请提供学员数据", 400);
    }

    const result = await batchImportService.updateAdminTeachers(
      students,
      ADMIN_TEACHER_USERNAMES
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
