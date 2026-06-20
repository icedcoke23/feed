import { NextRequest } from "next/server";
import { getServerSupabaseClient } from "@/storage/database/supabase-client";
import { getAuthUser, getTeacherClassIds } from "@/lib/route-auth";
import { successResponse, errorResponse, paginatedResponse } from "@/lib/api-response";
import { handleDbError } from "@/lib/api-error";
import { parsePagination, getOffset, buildPaginationMeta } from "@/lib/pagination";

interface StudentClassRelation {
  student_id: string;
  class_id: string;
  is_primary: boolean;
  classes?: {
    id: string;
    name: string;
    grade?: string;
    schedule?: string;
    teacher_id?: string;
  }[] | null;
}

// GET /api/home-data
// 一次返回首页所需的所有数据：学生、班级、教师
export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  const client = getServerSupabaseClient();
  const { searchParams } = new URL(request.url);

  // 分页参数
  const { page, limit } = parsePagination(request);
  const offset = getOffset(page, limit);

  // 教师权限隔离
  let teacherClassIds: string[] | null = null;
  let isAdminTeacher = false;
  if (authUser.userRole === "teacher") {
    if (authUser.teacherRole === "admin") {
      // 教务老师：按 admin_teacher_id 过滤学生，不按班级
      isAdminTeacher = true;
    } else {
      teacherClassIds = await getTeacherClassIds(authUser.userId);
      if (teacherClassIds.length === 0) {
        return successResponse({
          students: [],
          studentsPagination: { page, limit, total: 0, totalPages: 0 },
          classes: [],
          teachers: [],
          adminTeachers: [],
        });
      }
    }
  }

  try {
    // 并行查询学生、班级、教师、教务教师
    const [studentsResult, classesResult, teachersResult, adminTeachersResult] = await Promise.all([
      // 学生查询
      (async () => {
        let query = client
          .from("students")
          .select("*", { count: "exact" })
          .or("is_active.eq.true,is_active.is.null")
          .order("created_at", { ascending: false });

        if (isAdminTeacher) {
          // 教务老师：只看自己负责的学生
          query = query.eq("admin_teacher_id", authUser.userId);
        } else if (teacherClassIds) {
          // 授课老师：通过 student_classes 表过滤属于自己班级的学生
          const { data: teacherStudentClasses } = await client
            .from("student_classes")
            .select("student_id")
            .in("class_id", teacherClassIds);
          const teacherStudentIds = [...new Set(teacherStudentClasses?.map((sc: { student_id: string }) => sc.student_id) || [])];
          if (teacherStudentIds.length === 0) {
            return { data: [], count: 0, error: null };
          }
          query = query.in("id", teacherStudentIds);
        }

        query = query.range(offset, offset + limit - 1);
        return query;
      })(),
      // 班级查询
      (async () => {
        let query = client
          .from("classes")
          .select("*", { count: "exact" })
          .or("is_active.eq.true,is_active.is.null")
          .order("created_at", { ascending: false });

        // 教务老师不按 teacher_id 过滤班级（其负责学生可能跨班级）
        if (authUser.userRole === "teacher" && authUser.userId && !isAdminTeacher) {
          query = query.eq("teacher_id", authUser.userId);
        }

        return query;
      })(),
      // 教师查询
      client
        .from("teachers")
        .select("id, name, phone, email", { count: "exact" })
        .or("is_active.eq.true,is_active.is.null")
        .order("name", { ascending: true }),
      // 教务教师查询
      client
        .from("teachers")
        .select("id, name, phone, email", { count: "exact" })
        .eq("role", "admin")
        .or("is_active.eq.true,is_active.is.null")
        .order("name", { ascending: true }),
    ]);

    if (studentsResult.error) {
      return handleDbError(studentsResult.error, "获取学生列表");
    }
    if (classesResult.error) {
      return handleDbError(classesResult.error, "获取班级列表");
    }
    if (teachersResult.error) {
      return handleDbError(teachersResult.error, "获取教师列表");
    }
    if (adminTeachersResult.error) {
      return handleDbError(adminTeachersResult.error, "获取教务教师列表");
    }

    const studentsData = studentsResult.data || [];
    const classesData = classesResult.data || [];
    const teachersData = teachersResult.data || [];
    const adminTeachersData = adminTeachersResult.data || [];

    // 为学生数据补充班级和教师信息（与原 students API 逻辑一致）
    if (studentsData.length > 0) {
      const classIds = [...new Set(studentsData.map((s: { class_id?: string }) => s.class_id).filter(Boolean))];
      const adminTeacherIds = studentsData
        .map((s: { admin_teacher_id?: string }) => s.admin_teacher_id)
        .filter(Boolean);
      const studentIds = studentsData.map((s: { id: string }) => s.id);

      const [classesInfoResult, teachersInfoResult, studentClassesResult] = await Promise.all([
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

      const classesMap: Record<string, { id: string; name: string; grade?: string; schedule?: string; teacher_id?: string; teacher?: unknown }> = {};
      if (classesInfoResult.data) {
        classesInfoResult.data.forEach((c: { id: string; name: string; grade?: string; schedule?: string; teacher_id?: string }) => {
          classesMap[c.id] = c;
        });
      }

      const teachersMap: Record<string, { id: string; name: string; phone?: string }> = {};
      if (teachersInfoResult.data) {
        teachersInfoResult.data.forEach((t: { id: string; name: string; phone?: string }) => {
          teachersMap[t.id] = t;
        });
      }

      studentsData.forEach((s: {
        id: string;
        class_id?: string;
        class?: unknown;
        admin_teacher_id?: string;
        admin_teacher?: unknown;
        classes?: unknown[];
      }) => {
        // 通过 student_classes 附加 classes 数组
        const relations = (studentClassesResult.data as StudentClassRelation[] | undefined)?.filter(
          (sc) => sc.student_id === s.id
        ) || [];
        s.classes = relations.map((r) => {
          const classInfo = r.classes?.[0] ? { ...r.classes[0] } : classesMap[r.class_id] || {};
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
        const primaryClass = relations.find((r) => r.is_primary);
        if (primaryClass) {
          s.class_id = primaryClass.class_id;
          const primaryClassInfo = primaryClass.classes?.[0] ? { ...primaryClass.classes[0] } : classesMap[primaryClass.class_id] || {};
          if (primaryClassInfo.teacher_id && teachersMap[primaryClassInfo.teacher_id]) {
            primaryClassInfo.teacher = teachersMap[primaryClassInfo.teacher_id];
          }
          s.class = primaryClassInfo;
        } else if (s.class_id && classesMap[s.class_id]) {
          const classInfo = { ...classesMap[s.class_id] };
          if (classInfo.teacher_id && teachersMap[classInfo.teacher_id]) {
            classInfo.teacher = teachersMap[classInfo.teacher_id];
          }
          s.class = classInfo;
        }
        if (s.admin_teacher_id && teachersMap[s.admin_teacher_id]) {
          s.admin_teacher = teachersMap[s.admin_teacher_id];
        }
      });
    }

    // 为班级数据补充教师信息（与原 classes API 逻辑一致）
    const classTeacherIds = classesData
      .map((c: { teacher_id?: string }) => c.teacher_id)
      .filter(Boolean);

    const classTeachersMap: Record<string, { id: string; name: string; phone?: string }> = {};
    if (classTeacherIds.length > 0) {
      const { data: classTeachersData, error: classTeachersError } = await client
        .from("teachers")
        .select("id, name, phone")
        .in("id", classTeacherIds)
        .or("is_active.eq.true,is_active.is.null");

      if (!classTeachersError && classTeachersData) {
        classTeachersData.forEach((t: { id: string; name: string; phone?: string }) => {
          classTeachersMap[t.id] = t;
        });
      }
    }

    const classesWithTeacher = classesData.map((c: { teacher_id?: string; [key: string]: unknown }) => ({
      ...c,
      teacher: c.teacher_id ? classTeachersMap[c.teacher_id] || null : null,
    }));

    return successResponse({
      students: studentsData,
      studentsPagination: buildPaginationMeta(page, limit, studentsResult.count || 0),
      classes: classesWithTeacher,
      teachers: teachersData,
      adminTeachers: adminTeachersData,
    });
  } catch (error) {
    return handleDbError(error, "获取首页数据");
  }
}
