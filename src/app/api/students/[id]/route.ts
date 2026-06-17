import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/storage/database/supabase-client";
import { validateInput } from "@/lib/validations";
import { insertStudentSchema } from "@/storage/database/shared/schema";
import { handleDbError } from "@/lib/api-error";
import { getAuthUser, getTeacherClassIds, canTeacherAccessStudent } from "@/lib/route-auth";
import { successResponse, errorResponse } from "@/lib/api-response";

// GET /api/students/[id] - 获取单个学生详情（含历史反馈）
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  const client = getServerSupabaseClient();
  const { id } = await params;

  try {
    // 获取学生信息
    const { data: student, error: studentError } = await client
      .from("students")
      .select("*")
      .eq("id", id)
      .single();

    if (studentError) {
      return handleDbError(studentError, "获取学生");
    }

    if (!student) {
      return errorResponse("Student not found", 404);
    }

    // 并行查询班级信息、教务教师信息、历史反馈、转班记录、student_classes
    const [classResult, teacherResult, feedbacksResult, transfersResult, studentClassesResult] = await Promise.all([
      student.class_id
        ? client.from("classes").select("id, name, grade, schedule, teacher_id").eq("id", student.class_id).single()
        : Promise.resolve({ data: null }),
      student.admin_teacher_id
        ? client.from("teachers").select("id, name, phone").eq("id", student.admin_teacher_id).single()
        : Promise.resolve({ data: null }),
      client.from("feedbacks").select("*").eq("student_id", id).order("created_at", { ascending: false }),
      client.from("class_transfers").select("*").eq("student_id", id).order("transferred_at", { ascending: false }),
      client
        .from("student_classes")
        .select("class_id, is_primary, classes(id, name, grade, schedule, teacher_id)")
        .eq("student_id", id),
    ]);

    // 合并班级信息
    if (classResult.data) {
      student.class = classResult.data;
      // 班级教师信息
      if (classResult.data.teacher_id) {
        const { data: classTeacher } = await client
          .from("teachers")
          .select("id, name, phone")
          .eq("id", classResult.data.teacher_id)
          .single();
        if (classTeacher) {
          student.class.teacher = classTeacher;
        }
      }
    }

    // 通过 student_classes 附加 classes 数组
    if (studentClassesResult.data && studentClassesResult.data.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const scData = studentClassesResult.data as any[];

      // 收集所有班级的 teacher_id
      const classTeacherIds = scData
        .map((sc: any) => sc.classes?.teacher_id)
        .filter(Boolean) as string[];

      // 批量查询教师信息
      let teachersMap: Record<string, { id: string; name: string; phone?: string }> = {};
      if (classTeacherIds.length > 0) {
        const { data: classTeachersData } = await client
          .from("teachers")
          .select("id, name, phone")
          .in("id", [...new Set(classTeacherIds)]);
        if (classTeachersData) {
          classTeachersData.forEach((t: { id: string; name: string; phone?: string }) => {
            teachersMap[t.id] = t;
          });
        }
      }

      student.classes = scData.map((sc: any) => {
        const classInfo = sc.classes || {};
        return {
          id: classInfo.id,
          name: classInfo.name,
          grade: classInfo.grade,
          schedule: classInfo.schedule,
          teacher_id: classInfo.teacher_id,
          is_primary: sc.is_primary,
          teacher: classInfo.teacher_id ? teachersMap[classInfo.teacher_id] || null : null,
        };
      });

      // 主班级信息（向后兼容）
      const primaryClass = scData.find((sc: any) => sc.is_primary);
      if (primaryClass) {
        const primaryClassInfo = primaryClass.classes ? { ...primaryClass.classes } : {};
        if (primaryClassInfo.teacher_id && teachersMap[primaryClassInfo.teacher_id]) {
          primaryClassInfo.teacher = teachersMap[primaryClassInfo.teacher_id];
        }
        student.class = primaryClassInfo;
        student.class_id = primaryClass.class_id;
      }
    }

    // 合并教务教师信息
    if (teacherResult.data) {
      student.admin_teacher = teacherResult.data;
    }

    if (feedbacksResult.error) {
      return handleDbError(feedbacksResult.error, "获取学生反馈");
    }

    if (transfersResult.error) {
      return handleDbError(transfersResult.error, "获取转班记录");
    }

    return successResponse({
      ...student,
      feedbacks: feedbacksResult.data || [],
      transfers: transfersResult.data || [],
    });
  } catch (error) {
    return handleDbError(error, "获取学生");
  }
}

// PUT /api/students/[id] - 更新学生信息
export async function PUT(
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

  // 教师权限隔离：通过 student_classes 检查是否有权操作该学生
  if (authUser.userRole === "teacher") {
    const hasAccess = await canTeacherAccessStudent(authUser.userId, id);
    if (!hasAccess) {
      return errorResponse("无权操作该学生", 403);
    }
    // 检查教师不能将学生转移到自己不负责的班级
    if (body.classId) {
      const classIds = await getTeacherClassIds(authUser.userId);
      if (!classIds.includes(body.classId)) {
        return errorResponse("无权将学生转移到该班级", 403);
      }
    }
  }

  const result = validateInput(insertStudentSchema.partial(), body);
  if ("error" in result) return result.error;
  const validatedData = result.data;

  try {
    const { data, error } = await client
      .from("students")
      .update({
        name: validatedData.name,
        grade: validatedData.grade,
        school: validatedData.school,
        phone: validatedData.phone,
        current_teacher_id: validatedData.currentTeacherId,
        current_class: validatedData.currentClass,
        class_id: body.classId,
        admin_teacher_id: body.adminTeacherId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return handleDbError(error, "更新学生");
    }

    return successResponse(data);
  } catch (error) {
    return handleDbError(error, "更新学生");
  }
}

// DELETE /api/students/[id] - 软删除学生
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  const client = getServerSupabaseClient();
  const { id } = await params;

  // 教师权限隔离：通过 student_classes 检查是否有权删除该学生
  if (authUser.userRole === "teacher") {
    const hasAccess = await canTeacherAccessStudent(authUser.userId, id);
    if (!hasAccess) {
      return errorResponse("无权删除该学生", 403);
    }
  }

  try {
    const { error } = await client
      .from("students")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      return handleDbError(error, "删除学生");
    }

    return successResponse(null, "删除成功");
  } catch (error) {
    return handleDbError(error, "删除学生");
  }
}
