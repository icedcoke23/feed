import { NextRequest } from "next/server";
import { z } from "zod";
import { validateInput } from "@/lib/validations";
import { handleDbError } from "@/lib/api-error";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import * as studentService from "@/lib/services/student-service";

const transferSchema = z.object({
  targetClassId: z.string().uuid("无效的班级ID"),
});

// POST /api/students/[id]/transfer - 转出学员到新班级
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  const { id } = await params;
  const body = await request.json();

  // 校验输入
  const result = validateInput(transferSchema, body);
  if ("error" in result) return result.error;
  const validatedData = result.data;

  try {
    const data = await studentService.transfer(authUser, id, {
      targetClassId: validatedData.targetClassId,
    });

    if ("error" in data) {
      return data;
    }

    return successResponse(data, "学员已成功转入新班级");
  } catch (error) {
    return handleDbError(error, "转班");
  }
}
