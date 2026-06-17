import { NextRequest } from "next/server";
import { getServerSupabaseClient } from "@/storage/database/supabase-client";
import { z } from "zod";
import { validateInput } from "@/lib/validations";
import { handleDbError } from "@/lib/api-error";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse } from "@/lib/api-response";

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

  const client = getServerSupabaseClient();
  const body = await request.json();

  // 校验输入
  const result = validateInput(batchStudentsSchema, body);
  if ("error" in result) return result.error;
  const validatedData = result.data;

  try {
    // 收集所有老师名称并查询对应ID
    const teacherNames = [...new Set(
      validatedData.students
        .filter((s) => s.teacherName)
        .map((s) => s.teacherName)
    )];

    const teacherNameToId: Record<string, string> = {};

    if (teacherNames.length > 0) {
      const { data: teachers, error: teacherError } = await client
        .from("teachers")
        .select("id, name")
        .in("name", teacherNames)
        .or("is_active.eq.true,is_active.is.null");

      if (!teacherError && teachers) {
        teachers.forEach((t) => {
          teacherNameToId[t.name] = t.id;
        });
      }
    }

    // 准备数据
    const studentsData = validatedData.students.map((s) => ({
      name: s.name,
      grade: s.grade || "",
      current_class: s.className || "",
      class_id: validatedData.classId || null,
      current_teacher_id: s.teacherName ? teacherNameToId[s.teacherName] || null : null,
      is_active: true,
      created_at: new Date().toISOString(),
    }));

    // 批量插入
    const { data, error } = await client
      .from("students")
      .insert(studentsData)
      .select();

    if (error) {
      console.error("Batch insert error:", error);
      return handleDbError(error, "批量添加学员");
    }

    return successResponse(data, `成功添加 ${data?.length || 0} 名学员`);
  } catch (error) {
    console.error("Batch add students error:", error);
    return errorResponse("批量添加失败", 500);
  }
}
