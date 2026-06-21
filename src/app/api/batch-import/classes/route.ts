import { NextRequest } from "next/server";
import { forbiddenError, badRequestError } from "@/lib/api-error";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { batchImportClassSchema } from "@/lib/validations/data-import";
import { sanitizeError } from "@/lib/sensitive-mask";
import * as batchImportService from "@/lib/services/batch-import-service";

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
    const parsed = batchImportClassSchema.safeParse(body);
    if (!parsed.success) {
      return badRequestError("请求参数错误", parsed.error.flatten());
    }

    const result = await batchImportService.importClasses(parsed.data.classes);

    return successResponse(result);
  } catch (error) {
    console.error("Batch import error:", sanitizeError(error));
    return errorResponse("导入失败", 500);
  }
}
