import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/storage/database/supabase-client";
import { validateInput } from "@/lib/validations";
import { insertStudentSchema } from "@/storage/database/shared/schema";
import { handleDbError } from "@/lib/api-error";
import { getAuthUser, getTeacherClassIds } from "@/lib/route-auth";
import { successResponse, errorResponse, paginatedResponse } from "@/lib/api-response";
import { parsePagination, getOffset, buildPaginationMeta } from "@/lib/pagination";
import { withLogging } from "@/lib/api-logger";

// GET /api/students - 获取学生列表
export const GET = withLogging(async (request: NextRequest) => {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  // 教师权限隔离：只能查看自己班级的学生
  let teacherClassIds: string[] | null = null;
  const isStaffTeacher = authUser.userRole === "teacher" && authUser.teacherRole === "admin";
  if (authUser.userRole === "teacher" && !isStaffTeacher) {
    teacherClassIds = await getTeacherClassIds(authUser.userId);
    if (teacherClassIds.length === 0) {
      return successResponse([]);
    }
  }

  const client = getServerSupabaseClient();
  const { searchParams } = new URL(request.url);
  const teacherId = searchParams.get("teacherId");
  const classId = searchParams.get("classId");

  // 分页参数
  const { page, limit } = parsePagination(request);
  const offset = getOffset(page, limit);

  try {
    let query = client
      .from("students")
      .select("*", { count: "exact" })
      .or("is_active.eq.true,is_active.is.null")
      .order("created_at", { ascending: false });

    if (teacherId) {
      query = query.eq("current_teacher_id", teacherId);
    }

    if (classId) {
      query = query.eq("class_id", classId);
    }

    // 教师权限隔离：通过 student_classes 表过滤属于教师班级的学生
    if (teacherClassIds) {
      const { data: teacherStudentClasses } = await client
        .from("student_classes")
        .select("student_id")
        .in("class_id", teacherClassIds);
      const teacherStudentIds = [...new Set(teacherStudentClasses?.map((sc: { student_id: string }) => sc.student_id) || [])];
      if (teacherStudentIds.length === 0) {
        return paginatedResponse([], buildPaginationMeta(page, limit, 0));
      }
      query = query.in("id", teacherStudentIds);
    }

    // 教务老师只能看到自己负责的学生
    if (isStaffTeacher) {
      query = query.eq("admin_teacher_id", authUser.userId);
    }

    // 应用分页
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      return handleDbError(error, "获取学生列表");
    }
    if (data && data.length > 0) {
      // 收集所有班级ID和教师ID
      const classIds = [...new Set(data.map((s: { class_id?: string }) => s.class_id).filter(Boolean))];
      const adminTeacherIds = data
        .map((s: { admin_teacher_id?: string }) => s.admin_teacher_id)
        .filter(Boolean);
      const studentIds = data.map((s: { id: string }) => s.id);

      // 并行查询班级、教师、student_classes 信息
      const [classesResult, teachersResult, studentClassesResult] = await Promise.all([
        classIds.length > 0
          ? client.from("classes").select("id, name, grade, schedule, teacher_id").in("id", classIds).or("is_active.eq.true,is_active.is.null")
          : { data: [] },
        adminTeacherIds.length > 0
          ? client.from("teachers").select("id, name, phone").in("id", [...new Set(adminTeacherIds)]).or("is_active.eq.true,is_active.is.null")
          : { data: [] },
        client
          .from("student_classes")
          .select("student_id, class_id, is_primary, classes(id, name, grade, schedule, teacher_id)")
          .in("student_id", studentIds),
      ]);

      // 构建映射
      const classesMap: Record<string, { id: string; name: string; grade?: string; schedule?: string; teacher_id?: string; teacher?: unknown }> = {};
      if (classesResult.data) {
        classesResult.data.forEach((c: { id: string; name: string; grade?: string; schedule?: string; teacher_id?: string }) => {
          classesMap[c.id] = c;
        });
      }

      const teachersMap: Record<string, { id: string; name: string; phone?: string }> = {};
      if (teachersResult.data) {
        teachersResult.data.forEach((t: { id: string; name: string; phone?: string }) => {
          teachersMap[t.id] = t;
        });
      }

      // 合并班级和教师信息
      data.forEach((s: {
        id: string;
        class_id?: string;
        class?: unknown;
        admin_teacher_id?: string;
        admin_teacher?: unknown;
        classes?: unknown[];
      }) => {
        // 通过 student_classes 附加 classes 数组
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const relations = (studentClassesResult.data as any[])?.filter((sc: any) => sc.student_id === s.id) || [];

        s.classes = relations.map((r: any) => {
          const classInfo = r.classes ? { ...r.classes } : classesMap[r.class_id] || {};
          // 附加教师信息
          if (classInfo.teacher_id && teachersMap[classInfo.teacher_id]) {
            classInfo.teacher = teachersMap[classInfo.teacher_id];
          }
          return {
            id: classInfo.id,
            name: classInfo.name,
            grade: classInfo.grade,
            schedule: classInfo.schedule,
            teacher_id: classInfo.teacher_id,
            is_primary: r.is_primary,
            teacher: classInfo.teacher || null,
          };
        });

        // 主班级信息（向后兼容）
        const primaryClass = relations.find((r: any) => r.is_primary);
        if (primaryClass) {
          s.class_id = primaryClass.class_id;
          const primaryClassInfo = primaryClass.classes ? { ...primaryClass.classes } : classesMap[primaryClass.class_id] || {};
          if (primaryClassInfo.teacher_id && teachersMap[primaryClassInfo.teacher_id]) {
            primaryClassInfo.teacher = teachersMap[primaryClassInfo.teacher_id];
          }
          s.class = primaryClassInfo;
        } else if (s.class_id && classesMap[s.class_id]) {
          // 没有主班级标记时，回退到原有 class_id 逻辑
          const classInfo = { ...classesMap[s.class_id] };
          if (classInfo.teacher_id && teachersMap[classInfo.teacher_id]) {
            classInfo.teacher = teachersMap[classInfo.teacher_id];
          }
          s.class = classInfo;
        }
        // 教务教师
        if (s.admin_teacher_id && teachersMap[s.admin_teacher_id]) {
          s.admin_teacher = teachersMap[s.admin_teacher_id];
        }
      });
    }

    return paginatedResponse(data || [], buildPaginationMeta(page, limit, count || 0));
  } catch (error) {
    return handleDbError(error, "获取学生列表");
  }
});

// POST /api/students - 创建学生
export const POST = withLogging(async (request: NextRequest) => {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  const client = getServerSupabaseClient();
  const body = await request.json();

  // 校验输入
  const result = validateInput(insertStudentSchema, body);
  if ("error" in result) return result.error;
  const validatedData = result.data;

  try {
    const { data, error } = await client
      .from("students")
      .insert({
        name: validatedData.name,
        grade: validatedData.grade,
        school: validatedData.school,
        phone: validatedData.phone,
        current_teacher_id: validatedData.currentTeacherId,
        current_class: validatedData.currentClass,
        class_id: validatedData.classId,
        admin_teacher_id: validatedData.adminTeacherId,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      return handleDbError(error, "创建学生");
    }

    return successResponse(data);
  } catch (error) {
    return handleDbError(error, "创建学生");
  }
});
