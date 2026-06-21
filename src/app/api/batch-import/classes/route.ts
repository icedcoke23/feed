import { NextRequest } from "next/server";
import { forbiddenError } from "@/lib/api-error";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import * as batchImportService from "@/lib/services/batch-import-service";

interface ClassData {
  teacherName: string;
  classTime: string;
  courseName: string;
  students: string[];
}

// POST /api/batch-import/classes - 批量导入班级
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
    const { classes } = body as { classes: ClassData[] };

    if (!classes || !Array.isArray(classes)) {
      return errorResponse("请提供班级数据", 400);
    }

    const result = await batchImportService.importClasses(classes);

    return successResponse(result);
  } catch (error) {
    console.error("Batch import error:", error);
    return errorResponse("导入失败", 500);
  }
}
