import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateInput } from "@/lib/validations";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import * as studentService from "@/lib/services/student-service";

const studentItemSchema = z.object({
  name: z.string().min(1, "学员姓名不能为空"),
  grade: z.string().optional().default(""),
  className: z.string().optional().default(""),
  teacherName: z.string().optional(),
});

const batchStudentsSchema = z.object({
  students: z.array(studentItemSchema).min(1, "请提供学员数据").max(100, "单次最多导入100条记录"),
  classId: z.string().optional(),
});

// POST /api/students/batch - 批量添加学员
export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  const body = await request.json();

  // 校验输入
  const result = validateInput(batchStudentsSchema, body);
  if ("error" in result) return result.error;
  const validatedData = result.data;

  try {
    const data = await studentService.batchCreate(authUser, {
      students: validatedData.students,
      classId: validatedData.classId,
    });

    if (data instanceof NextResponse) {
      return data;
    }

    return successResponse(data.data, `成功添加 ${data.count} 名学员`);
  } catch (error) {
    console.error("Batch add students error:", error);
    return errorResponse("批量添加失败", 500);
  }
}
