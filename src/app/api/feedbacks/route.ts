import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/storage/database/supabase-client";
import { validateInput } from "@/lib/validations";
import { insertFeedbackSchema } from "@/storage/database/shared/schema";
import { z } from "zod";
import { handleDbError, forbiddenError } from "@/lib/api-error";
import { getAuthUser, getTeacherClassIds, canTeacherAccessStudent } from "@/lib/route-auth";
import { successResponse, errorResponse, paginatedResponse } from "@/lib/api-response";
import { parsePagination, getOffset, buildPaginationMeta } from "@/lib/pagination";
import { withLogging } from "@/lib/api-logger";

// 反馈创建 schema：核心字段必填，同时兼容 camelCase 和 snake_case
const createFeedbackSchema = z.object({
  studentId: z.string().min(1, "缺少学员ID").optional(),
  student_id: z.string().min(1, "缺少学员ID").optional(),
  teacherId: z.string().min(1, "缺少教师ID").optional(),
  teacher_id: z.string().min(1, "缺少教师ID").optional(),
  strengths: z.array(z.string()).optional(),
  improvements: z.array(z.string()).optional(),
  weaknesses: z.array(z.string()).optional(),
  teachingPlan: z.string().optional(),
  teaching_plan: z.string().optional(),
  course_plans: z.string().optional(),
  suggestions: z.string().optional(),
  recommendations: z.string().optional(),
  aiReport: z.string().optional(),
  ai_report: z.string().optional(),
  status: z.string().optional(),
  periodStart: z.string().optional(),
  period_start: z.string().optional(),
  periodEnd: z.string().optional(),
  period_end: z.string().optional(),
  feedback_date: z.string().optional(),
  // 额外元数据字段
  student_name: z.string().optional(),
  teacher_name: z.string().optional(),
  teacher_phone: z.string().optional(),
  theme: z.string().optional(),
  tag_ratings: z.record(z.string(), z.number()).optional(),
  has_course_plan: z.boolean().optional(),
  current_stage_id: z.string().optional(),
  campus: z.string().optional(),
  grade: z.string().optional(),
  class_name: z.string().optional(),
  school: z.string().optional(),
  summary: z.string().optional(),
  // 作品信息和能力评分
  workInfo: z.string().optional(),
  work_info: z.string().optional(),
  abilityScores: z.record(z.string(), z.number()).optional(),
  ability_scores: z.record(z.string(), z.number()).optional(),
  // 照片数据
  student_photos: z.array(z.object({ id: z.string(), url: z.string() })).optional(),
}).refine(
  (data) => data.studentId || data.student_id,
  { message: "缺少学员ID" }
).refine(
  (data) => data.teacherId || data.teacher_id,
  { message: "缺少教师ID" }
);

// GET /api/feedbacks - 获取反馈列表
export const GET = withLogging(async (request: NextRequest) => {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  const client = getServerSupabaseClient();
  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get("studentId");
  const teacherId = searchParams.get("teacherId");
  const status = searchParams.get("status");

  // 分页参数
  const { page, limit } = parsePagination(request);
  const offset = getOffset(page, limit);

  try {
    // 教师权限隔离：只能查看自己可见学生的反馈
    let teacherStudentIds: string[] | null = null;
    if (authUser.userRole === "teacher") {
      if (authUser.teacherRole === "admin") {
        // 教务老师：按 admin_teacher_id 过滤学生
        const { data: adminStudents } = await client
          .from("students")
          .select("id")
          .eq("admin_teacher_id", authUser.userId)
          .or("is_active.eq.true,is_active.is.null");
        if (!adminStudents || adminStudents.length === 0) {
          return successResponse([]);
        }
        teacherStudentIds = adminStudents.map((s: { id: string }) => s.id);
      } else {
        // 任课老师：按班级过滤学生
        const classIds = await getTeacherClassIds(authUser.userId);
        if (classIds.length === 0) {
          return successResponse([]);
        }
        const { data: students } = await client
          .from("students")
          .select("id")
          .in("class_id", classIds)
          .or("is_active.eq.true,is_active.is.null");
        if (!students || students.length === 0) {
          return successResponse([]);
        }
        teacherStudentIds = students.map((s: { id: string }) => s.id);
      }
    }

    let query = client
      .from("feedbacks")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (studentId) {
      query = query.eq("student_id", studentId);
    }
    if (teacherId) {
      query = query.eq("teacher_id", teacherId);
    }
    if (status) {
      query = query.eq("status", status);
    }

    // 教师权限隔离：过滤只属于教师班级学生的反馈
    if (teacherStudentIds) {
      query = query.in("student_id", teacherStudentIds);
    }

    // 应用分页
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      return handleDbError(error, "获取反馈列表");
    }

    return paginatedResponse(data || [], buildPaginationMeta(page, limit, count || 0));
  } catch (error) {
    return handleDbError(error, "获取反馈列表");
  }
});

// POST /api/feedbacks - 创建反馈
export const POST = withLogging(async (request: NextRequest) => {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  const client = getServerSupabaseClient();
  const body = await request.json();

  // 校验输入
  const result = validateInput(createFeedbackSchema, body);
  if ("error" in result) return result.error;
  const validatedData = result.data;

  // 教师权限隔离：检查学生是否在教师班级中
  if (authUser.userRole === "teacher") {
    const targetStudentId = validatedData.student_id || validatedData.studentId;
    if (!targetStudentId || !(await canTeacherAccessStudent(authUser.userId, targetStudentId))) {
      return errorResponse("无权为该学生创建反馈", 403);
    }
  }

  // 教务老师权限验证：只能为自己负责的学生创建反馈
  if (authUser.userRole === "teacher" && authUser.teacherRole === "admin") {
    const targetStudentId = validatedData.student_id || validatedData.studentId;
    const { data: student } = await client
      .from("students")
      .select("admin_teacher_id")
      .eq("id", targetStudentId)
      .single();
    if (!student || student.admin_teacher_id !== authUser.userId) {
      return forbiddenError("您只能为您的学生创建反馈");
    }
  }

  try {
    // 构建插入数据 - 使用snake_case字段名
    const insertData: Record<string, unknown> = {
      student_id: validatedData.student_id || validatedData.studentId,
      teacher_id: validatedData.teacher_id || validatedData.teacherId,
      status: validatedData.status || "draft",
    };

    // 处理学情分析字段
    if (validatedData.strengths) {
      insertData.strengths = typeof validatedData.strengths === "string"
        ? [{ content: validatedData.strengths }]
        : validatedData.strengths;
    }
    if (validatedData.improvements) {
      insertData.improvements = typeof validatedData.improvements === "string"
        ? [{ content: validatedData.improvements }]
        : validatedData.improvements;
    }
    if (validatedData.weaknesses) {
      insertData.weaknesses = typeof validatedData.weaknesses === "string"
        ? [{ content: validatedData.weaknesses }]
        : validatedData.weaknesses;
    }

    // 教学计划/课程规划
    if (validatedData.teaching_plan || validatedData.course_plans) {
      insertData.teaching_plan = validatedData.teaching_plan || validatedData.course_plans || [];
    }

    // 阶段性建议
    if (validatedData.suggestions || validatedData.recommendations) {
      insertData.suggestions = validatedData.suggestions || validatedData.recommendations;
    }

    // 时间相关
    if (validatedData.period_start || validatedData.feedback_date) {
      insertData.period_start = validatedData.period_start || validatedData.feedback_date;
    }
    if (validatedData.period_end) {
      insertData.period_end = validatedData.period_end;
    }

    // 将额外元数据存储到 metadata 字段中
    const metadataObj: Record<string, unknown> = {};
    if (validatedData.student_name) metadataObj.student_name = validatedData.student_name;
    if (validatedData.teacher_name) metadataObj.teacher_name = validatedData.teacher_name;
    if (validatedData.teacher_phone) metadataObj.teacher_phone = validatedData.teacher_phone;
    if (validatedData.theme) metadataObj.theme = validatedData.theme;
    if (validatedData.tag_ratings) metadataObj.tag_ratings = validatedData.tag_ratings;
    if (validatedData.has_course_plan !== undefined) metadataObj.has_course_plan = validatedData.has_course_plan;
    if (validatedData.course_plans) metadataObj.course_plans = validatedData.course_plans;
    if (validatedData.current_stage_id) metadataObj.current_stage_id = validatedData.current_stage_id;
    if (validatedData.campus) metadataObj.campus = validatedData.campus;
    if (validatedData.grade) metadataObj.grade = validatedData.grade;
    if (validatedData.class_name) metadataObj.class_name = validatedData.class_name;
    if (validatedData.school) metadataObj.school = validatedData.school;
    if (validatedData.feedback_date) metadataObj.feedback_date = validatedData.feedback_date;
    if (validatedData.summary) metadataObj.summary = validatedData.summary;
    if (validatedData.student_photos) metadataObj.student_photos = validatedData.student_photos;

    if (Object.keys(metadataObj).length > 0) {
      insertData.metadata = metadataObj;
    }

    // 作品信息
    if (validatedData.workInfo || validatedData.work_info) {
      insertData.work_info = validatedData.workInfo || validatedData.work_info;
    }

    // 能力评分
    if (validatedData.abilityScores || validatedData.ability_scores) {
      insertData.ability_scores = validatedData.abilityScores || validatedData.ability_scores;
    }

    // ai_report 仅存储 AI 生成的纯文本报告
    if (validatedData.ai_report) {
      if (typeof validatedData.ai_report === 'string') {
        // 尝试判断是否为旧格式的 JSON 元数据
        try {
          const parsed = JSON.parse(validatedData.ai_report);
          // 如果解析成功且包含元数据字段，说明是旧格式数据
          if (typeof parsed === 'object' && parsed !== null) {
            // 旧数据兼容：将元数据合并到 metadata，ai_report 不存储
            Object.assign(metadataObj, parsed);
            insertData.metadata = metadataObj;
            insertData.ai_report = null;
          } else {
            // 纯文本内容
            insertData.ai_report = validatedData.ai_report;
          }
        } catch {
          // 解析失败，说明是纯文本 AI 报告
          insertData.ai_report = validatedData.ai_report;
        }
      } else if (typeof validatedData.ai_report === 'object') {
        // 旧格式：ai_report 是一个对象（元数据），迁移到 metadata
        Object.assign(metadataObj, validatedData.ai_report);
        insertData.metadata = metadataObj;
        insertData.ai_report = null;
      }
    }

    const { data, error } = await client
      .from("feedbacks")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error("Create feedback error:", error);
      return handleDbError(error, "创建反馈");
    }

    return successResponse(data);
  } catch (error) {
    return handleDbError(error, "创建反馈");
  }
});
