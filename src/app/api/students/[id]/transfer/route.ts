import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/storage/database/supabase-client";
import { z } from "zod";
import { validateInput } from "@/lib/validations";
import { handleDbError, forbiddenError } from "@/lib/api-error";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse } from "@/lib/api-response";

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

  const client = getServerSupabaseClient();
  const { id } = await params;
  const body = await request.json();

  // 校验输入
  const result = validateInput(transferSchema, body);
  if ("error" in result) return result.error;
  const validatedData = result.data;

  // 权限校验：admin 可操作所有学生，teacher 需验证归属
  if (authUser.userRole !== "admin") {
    const { data: student } = await client
      .from("students")
      .select("admin_teacher_id, current_teacher_id")
      .eq("id", id)
      .single();
    if (!student) {
      return errorResponse("学生不存在", 404);
    }
    if (authUser.teacherRole === "admin" && student.admin_teacher_id !== authUser.userId) {
      return forbiddenError("无权操作此学生");
    }
    if (authUser.teacherRole === "teacher" && student.current_teacher_id !== authUser.userId) {
      return forbiddenError("无权操作此学生");
    }
  }

  try {
    // 获取目标班级信息（包含 teacher_id）
    const { data: targetClass, error: classError } = await client
      .from("classes")
      .select("id, name, grade, teacher_id")
      .eq("id", validatedData.targetClassId)
      .single();

    if (classError || !targetClass) {
      return errorResponse("目标班级不存在", 400);
    }

    // 获取当前学生信息
    const { data: student, error: studentError } = await client
      .from("students")
      .select("id, class_id, current_teacher_id")
      .eq("id", id)
      .single();

    if (studentError || !student) {
      return errorResponse("学员不存在", 404);
    }

    // 使用 RPC 原子转班（插入转班记录 + 更新学生班级）
    const { error: rpcError } = await client.rpc("transfer_student", {
      p_student_id: id,
      p_from_class_id: student.class_id,
      p_to_class_id: targetClass.id,
      p_from_teacher_id: student.current_teacher_id,
      p_to_teacher_id: targetClass.teacher_id,
    });

    if (rpcError) {
      return handleDbError(rpcError, "转班");
    }

    return successResponse({
      ...student,
      class_id: targetClass.id,
      current_class: targetClass.name,
      current_teacher_id: targetClass.teacher_id,
      updated_at: new Date().toISOString(),
    }, `学员已成功转入 ${targetClass.name}`);
  } catch (error) {
    return handleDbError(error, "转班");
  }
}
