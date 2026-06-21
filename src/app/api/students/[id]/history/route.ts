import { NextRequest } from "next/server";
import { handleDbError } from "@/lib/api-error";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import * as studentService from "@/lib/services/student-service";

// GET /api/students/[id]/history - 获取学员历史反馈
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  const { id } = await params;

  try {
    const result = await studentService.history(authUser, id);
    if ("error" in result) {
      return result;
    }
    return successResponse(result);
  } catch (error) {
    console.error("Failed to fetch history:", error);
    return successResponse([]);
  }
}
