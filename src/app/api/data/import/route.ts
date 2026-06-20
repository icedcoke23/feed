import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/storage/database/supabase-client";
import { hashPassword } from "@/lib/auth";
import { forbiddenError } from "@/lib/api-error";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { clearAllData } from "@/lib/data-utils";

function getDefaultTeacherPassword(): string {
  const password = process.env.DEFAULT_TEACHER_PASSWORD || process.env.ADMIN_DEFAULT_PASSWORD;
  if (!password) {
    return 'teacher123'; // 开发环境默认密码
  }
  return password;
}

interface ImportData {
  exportTime?: string;
  version?: string;
  mode?: "overwrite" | "incremental";
  data?: {
    students?: Record<string, unknown>[];
    classes?: Record<string, unknown>[];
    feedbacks?: Record<string, unknown>[];
    themes?: Record<string, unknown>[];
    tags?: Record<string, unknown>[];
    courseStages?: Record<string, unknown>[];
    classTransfers?: Record<string, unknown>[];
    teachers?: Record<string, unknown>[];
  };
  summary?: Record<string, number>;
}

// 默认教务老师配置（角色为teacher，不是admin）
const DEFAULT_ADMIN_TEACHERS = [
  { 
    username: "心心", 
    name: "心心", 
    password: getDefaultTeacherPassword(), 
    phone: "",
  },
  { 
    username: "燕子", 
    name: "燕子", 
    password: getDefaultTeacherPassword(), 
    phone: "",
  },
];

// 创建或获取默认教务老师
async function ensureDefaultAdminTeachers(
  client: ReturnType<typeof getServerSupabaseClient>
): Promise<{ 
  xinxin: string | null; 
  yanzi: string | null; 
  legacyMapping: Record<string, string>;
  logs: string[] 
}> {
  const result = { xinxin: null as string | null, yanzi: null as string | null };
  const legacyMapping: Record<string, string> = {};
  const logs: string[] = [];

  for (const adminTeacher of DEFAULT_ADMIN_TEACHERS) {
    // 检查是否已存在
    const { data: existingUser } = await client
      .from("users")
      .select("id, name")
      .eq("username", adminTeacher.username)
      .single();

    if (existingUser) {
      if (adminTeacher.username === "心心") result.xinxin = existingUser.id;
      if (adminTeacher.username === "燕子") result.yanzi = existingUser.id;
      logs.push(`✓ 教务老师已存在: ${adminTeacher.name} (${adminTeacher.phone})`);
      continue;
    }

    // 创建新的教务老师（角色为teacher）
    const newId = crypto.randomUUID();

    const { error: userError } = await client.from("users").insert({
      id: newId,
      username: adminTeacher.username,
      name: adminTeacher.name,
      password: await hashPassword(adminTeacher.password),
      role: "teacher", // 改为teacher角色
      is_active: true,
    });

    if (userError) {
      logs.push(`✗ 创建教务老师失败: ${adminTeacher.name} - ${userError.message}`);
      continue;
    }

    const { error: teacherError } = await client.from("teachers").insert({
      id: newId,
      name: adminTeacher.name,
      email: `${adminTeacher.username}@school.com`,
      phone: adminTeacher.phone,
      role: "admin", // teachers表中标记为admin表示教务老师
      is_active: true,
    });

    if (teacherError) {
      await client.from("users").delete().eq("id", newId);
      logs.push(`✗ 创建教务老师记录失败: ${adminTeacher.name} - ${teacherError.message}`);
      continue;
    }

    if (adminTeacher.username === "心心") result.xinxin = newId;
    if (adminTeacher.username === "燕子") result.yanzi = newId;
    logs.push(`✓ 创建教务老师: ${adminTeacher.name} (${adminTeacher.phone})`);
  }

  // 动态建立旧ID映射：查找所有具有admin角色的教师，建立旧ID到当前ID的映射
  const { data: adminTeachers } = await client
    .from("teachers")
    .select("id, name")
    .eq("role", "admin");
  
  adminTeachers?.forEach((t) => {
    if (t.name === "心心" && result.xinxin) {
      legacyMapping[t.id] = result.xinxin;
    } else if (t.name === "燕子" && result.yanzi) {
      legacyMapping[t.id] = result.yanzi;
    }
  });

  return { ...result, legacyMapping, logs };
}

// 根据备份文件中的admin_teacher_id映射到新的教务老师ID
function getAdminTeacherByLegacyId(
  legacyAdminTeacherId: string | null,
  legacyMapping: Record<string, string>,
  adminTeachers: { xinxin: string | null; yanzi: string | null }
): string | null {
  if (!legacyAdminTeacherId) {
    // 如果没有教务老师，默认分配给心心
    return adminTeachers.xinxin;
  }
  
  // 查找映射
  const newId = legacyMapping[legacyAdminTeacherId];
  if (newId) {
    return newId;
  }
  
  // 如果映射找不到，默认分配给心心
  return adminTeachers.xinxin;
}

// POST /api/data/import - 导入JSON数据
export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  if (authUser.userRole !== "admin") {
    return forbiddenError("仅管理员可访问");
  }

  const client = getServerSupabaseClient();

  try {
    const body: ImportData = await request.json();

    if (!body.data) {
      return errorResponse("无效的导入数据格式", 400);
    }

    const mode = body.mode || "incremental";
    const {
      students = [],
      classes = [],
      feedbacks = [],
      themes = [],
      tags = [],
      courseStages = [],
      classTransfers = [],
      teachers = [],
    } = body.data;

    // 检查数据总量限制
    const totalItems = students.length + classes.length + feedbacks.length + themes.length + tags.length + courseStages.length + classTransfers.length + teachers.length;
    if (totalItems > 500) {
      return errorResponse(`数据总量超过限制（当前${totalItems}条，最多500条）`, 400);
    }

    const results = {
      students: { success: 0, failed: 0, skipped: 0 },
      classes: { success: 0, failed: 0, skipped: 0 },
      feedbacks: { success: 0, failed: 0, skipped: 0 },
      themes: { success: 0, failed: 0, skipped: 0 },
      tags: { success: 0, failed: 0, skipped: 0 },
      courseStages: { success: 0, failed: 0, skipped: 0 },
      classTransfers: { success: 0, failed: 0, skipped: 0 },
      teachers: { success: 0, failed: 0, skipped: 0 },
    };

    const logs: string[] = [];
    const adminTeacherAssigned = { xinxin: 0, yanzi: 0 };

    // ==========================================
    // Step 0: 创建默认教务老师
    // ==========================================
    logs.push("=== 创建默认教务老师 ===");
    const adminTeachers = await ensureDefaultAdminTeachers(client);
    logs.push(...adminTeachers.logs);
    logs.push(`  旧ID映射: ${JSON.stringify(adminTeachers.legacyMapping)}`);

    // 教师ID映射表：旧ID -> 新ID
    const teacherIdMapping: Record<string, string> = { ...adminTeachers.legacyMapping };

    // 覆盖模式：先清空现有数据
    if (mode === "overwrite") {
      logs.push("=== 清空现有数据 ===");
      const { errors: clearErrors } = await clearAllData(client);
      if (clearErrors.length > 0) {
        logs.push(...clearErrors.map(e => `✗ ${e}`));
      }
      logs.push("✓ 数据清空完成");
    }

    const isOverwrite = mode === "overwrite";

    // ==========================================
    // Step 1: 导入教师用户
    // ==========================================
    if (teachers.length > 0) {
      logs.push("=== 导入教师 ===");
      for (const teacher of teachers) {
        const teacherData = teacher as Record<string, unknown>;
        const oldId = teacherData.id as string;
        
        // 跳过教务老师（已经创建过了）— 通过 legacyMapping 检查
        if (adminTeachers.legacyMapping[oldId]) {
          results.teachers.skipped++;
          continue;
        }
        
        const newId = crypto.randomUUID();
        
        // 检查用户名是否已存在
        const username = (teacherData.username as string) || (teacherData.name as string);
        const { data: existingUser } = await client
          .from("users")
          .select("id")
          .eq("username", username)
          .single();

        if (existingUser) {
          // 用户已存在，使用现有ID
          teacherIdMapping[oldId] = existingUser.id;
          results.teachers.skipped++;
          continue;
        }

        // 创建新的教师用户 — 仅使用白名单字段
        const { error: userError } = await client.from("users").insert({
          id: newId,
          username: username,
          name: teacherData.name as string,
          password: await hashPassword((teacherData.password as string) || (teacherData.name as string)?.toLowerCase()),
          role: (teacherData.role as string) ?? "teacher",
          phone: (teacherData.phone as string) ?? null,
          is_active: (teacherData.is_active as boolean) ?? true,
        });

        if (userError) {
          logs.push(`✗ 创建教师失败: ${teacherData.name} - ${userError.message}`);
          results.teachers.failed++;
          continue;
        }

        // 同步到teachers表 — 仅使用白名单字段
        await client.from("teachers").insert({
          id: newId,
          name: teacherData.name as string,
          email: (teacherData.email as string) || `${username}@school.com`,
          phone: (teacherData.phone as string) ?? null,
          role: (teacherData.role as string) ?? "teacher",
          is_active: (teacherData.is_active as boolean) ?? true,
        });

        teacherIdMapping[oldId] = newId;
        results.teachers.success++;
      }
      logs.push(`✓ 教师导入完成: 成功 ${results.teachers.success}, 跳过 ${results.teachers.skipped}, 失败 ${results.teachers.failed}`);
    }

    // ==========================================
    // Step 2: 导入课程阶段
    // ==========================================
    if (courseStages.length > 0) {
      logs.push("=== 导入课程阶段 ===");
      for (const stage of courseStages) {
        const stageData = stage as Record<string, unknown>;
        const stageRecord = {
          id: stageData.id as string,
          stage_code: stageData.stage_code as string,
          stage_name: stageData.stage_name as string,
          theme: stageData.theme as string,
          level: stageData.level as string,
          description: (stageData.description as string) ?? null,
          content: (stageData.content as string) ?? null,
          goal: (stageData.goal as string) ?? null,
          sort_order: (stageData.sort_order as number) ?? 0,
          is_active: (stageData.is_active as boolean) ?? true,
          created_at: stageData.created_at as string,
          updated_at: (stageData.updated_at as string) ?? null,
        };
        const { error } = await client
          .from("course_stages")
          .upsert(stageRecord, { onConflict: "id" });
        if (error) {
          results.courseStages.failed++;
        } else {
          results.courseStages.success++;
        }
      }
      logs.push(`✓ 课程阶段: 成功 ${results.courseStages.success}, 失败 ${results.courseStages.failed}`);
    }

    // ==========================================
    // Step 3: 导入主题
    // ==========================================
    if (themes.length > 0) {
      logs.push("=== 导入教学主题 ===");
      for (const theme of themes) {
        const themeData = theme as Record<string, unknown>;
        const themeRecord = {
          id: themeData.id as string,
          name: themeData.name as string,
          category: (themeData.category as string) ?? null,
          description: (themeData.description as string) ?? null,
          sort_order: (themeData.sort_order as number) ?? 0,
          is_active: (themeData.is_active as boolean) ?? true,
        };
        const { error } = await client
          .from("teaching_themes")
          .upsert(themeRecord, { onConflict: "id" });
        if (error) {
          results.themes.failed++;
        } else {
          results.themes.success++;
        }
      }
      logs.push(`✓ 教学主题: 成功 ${results.themes.success}, 失败 ${results.themes.failed}`);
    }

    // ==========================================
    // Step 4: 导入标签
    // ==========================================
    if (tags.length > 0) {
      logs.push("=== 导入标签 ===");
      for (const tag of tags) {
        const tagData = tag as Record<string, unknown>;
        const tagRecord = {
          id: tagData.id as string,
          category: tagData.category as string,
          name: tagData.name as string,
          description: (tagData.description as string) ?? null,
          sort_order: (tagData.sort_order as number) ?? 0,
          is_active: (tagData.is_active as boolean) ?? true,
        };
        const { error } = await client
          .from("tags")
          .upsert(tagRecord, { onConflict: "id" });
        if (error) {
          results.tags.failed++;
        } else {
          results.tags.success++;
        }
      }
      logs.push(`✓ 标签: 成功 ${results.tags.success}, 失败 ${results.tags.failed}`);
    }

    // ==========================================
    // Step 5: 导入班级
    // ==========================================
    const classIdMapping: Record<string, string> = {};
    const classTeacherMapping: Record<string, string | null> = {};
    
    if (classes.length > 0) {
      logs.push("=== 导入班级 ===");
      for (const cls of classes) {
        const clsData = cls as Record<string, unknown>;
        const oldId = clsData.id as string;
        const newId = isOverwrite ? oldId : crypto.randomUUID();
        
        // 处理教师ID映射
        let teacherId = clsData.teacher_id as string | null;
        if (teacherId && teacherIdMapping[teacherId]) {
          teacherId = teacherIdMapping[teacherId];
        }

        const classRecord = {
          id: newId,
          name: clsData.name as string,
          grade: (clsData.grade as string) ?? null,
          teacher_id: teacherId,
          schedule: (clsData.schedule as string) ?? null,
          description: (clsData.description as string) ?? null,
          is_active: (clsData.is_active as boolean) ?? true,
        };

        const { error } = isOverwrite 
          ? await client.from("classes").insert(classRecord)
          : await client.from("classes").upsert(classRecord, { onConflict: "id" });

        if (error) {
          logs.push(`✗ 班级失败: ${clsData.name} - ${error.message}`);
          results.classes.failed++;
        } else {
          classIdMapping[oldId] = newId;
          classTeacherMapping[newId] = teacherId;
          results.classes.success++;
        }
      }
      logs.push(`✓ 班级: 成功 ${results.classes.success}, 失败 ${results.classes.failed}`);
    }

    // ==========================================
    // Step 6: 导入学员
    // ==========================================
    if (students.length > 0) {
      logs.push("=== 导入学员 ===");
      for (const student of students) {
        const studentData = student as Record<string, unknown>;
        const oldId = studentData.id as string;
        const newId = isOverwrite ? oldId : crypto.randomUUID();
        
        // 处理班级ID映射
        let classId = studentData.class_id as string | null;
        if (classId && classIdMapping[classId]) {
          classId = classIdMapping[classId];
        }

        // 处理授课教师ID映射
        let currentTeacherId = studentData.current_teacher_id as string | null;
        if (currentTeacherId && teacherIdMapping[currentTeacherId]) {
          currentTeacherId = teacherIdMapping[currentTeacherId];
        } else if (currentTeacherId && classId && classTeacherMapping[classId]) {
          // 如果教师ID映射找不到，使用班级的教师
          currentTeacherId = classTeacherMapping[classId];
        } else if (classId && classTeacherMapping[classId]) {
          // 如果学员没有授课教师，使用班级的教师
          currentTeacherId = classTeacherMapping[classId];
        }

        // 根据备份文件中的admin_teacher_id映射到新的教务老师
        const legacyAdminTeacherId = studentData.admin_teacher_id as string | null;
        const adminTeacherId = getAdminTeacherByLegacyId(
          legacyAdminTeacherId,
          adminTeachers.legacyMapping,
          { xinxin: adminTeachers.xinxin, yanzi: adminTeachers.yanzi }
        );
        
        // 统计教务老师分配
        if (adminTeacherId === adminTeachers.xinxin) {
          adminTeacherAssigned.xinxin++;
        } else if (adminTeacherId === adminTeachers.yanzi) {
          adminTeacherAssigned.yanzi++;
        }

        const studentRecord = {
          id: newId,
          name: studentData.name as string,
          grade: (studentData.grade as string) ?? null,
          school: (studentData.school as string) ?? null,
          phone: (studentData.phone as string) ?? null,
          class_id: classId,
          current_teacher_id: currentTeacherId,
          admin_teacher_id: adminTeacherId,
          current_class: (studentData.current_class as string) ?? null,
          is_active: (studentData.is_active as boolean) ?? true,
        };

        const { error } = isOverwrite 
          ? await client.from("students").insert(studentRecord)
          : await client.from("students").upsert(studentRecord, { onConflict: "id" });

        if (error) {
          results.students.failed++;
        } else {
          results.students.success++;
        }
      }
      logs.push(`✓ 学员: 成功 ${results.students.success}, 失败 ${results.students.failed}`);
      logs.push(`  教务老师分配: 心心 ${adminTeacherAssigned.xinxin} 人, 燕子 ${adminTeacherAssigned.yanzi} 人`);
    }

    // ==========================================
    // Step 7: 导入反馈记录
    // ==========================================
    if (feedbacks.length > 0) {
      logs.push("=== 导入反馈记录 ===");
      for (const feedback of feedbacks) {
        const feedbackData = feedback as Record<string, unknown>;
        const newId = isOverwrite ? feedbackData.id : crypto.randomUUID();
        
        // 处理学员ID映射
        const studentId = feedbackData.student_id as string;
        // 学员ID通常不变，因为学员已经导入

        const feedbackRecord = {
          id: newId,
          student_id: studentId,
          teacher_id: feedbackData.teacher_id as string,
          strengths: (feedbackData.strengths as unknown[]) ?? null,
          improvements: (feedbackData.improvements as unknown[]) ?? null,
          weaknesses: (feedbackData.weaknesses as unknown[]) ?? null,
          teaching_plan: (feedbackData.teaching_plan as unknown[]) ?? null,
          suggestions: (feedbackData.suggestions as string) ?? null,
          ai_report: (feedbackData.ai_report as string) ?? null,
          metadata: (feedbackData.metadata as Record<string, unknown>) ?? null,
          work_info: (feedbackData.work_info as Record<string, unknown>) ?? null,
          ability_scores: (feedbackData.ability_scores as unknown[]) ?? null,
          version: (feedbackData.version as number) ?? 1,
          parent_feedback_id: (feedbackData.parent_feedback_id as string) ?? null,
          status: (feedbackData.status as string) ?? "draft",
          created_at: feedbackData.created_at as string,
          updated_at: (feedbackData.updated_at as string) ?? null,
          period_start: (feedbackData.period_start as string) ?? null,
          period_end: (feedbackData.period_end as string) ?? null,
        };

        const { error } = isOverwrite 
          ? await client.from("feedbacks").insert(feedbackRecord)
          : await client.from("feedbacks").upsert(feedbackRecord, { onConflict: "id" });

        if (error) {
          results.feedbacks.failed++;
        } else {
          results.feedbacks.success++;
        }
      }
      logs.push(`✓ 反馈记录: 成功 ${results.feedbacks.success}, 失败 ${results.feedbacks.failed}`);
    }

    // ==========================================
    // Step 8: 导入转班记录
    // ==========================================
    if (classTransfers.length > 0) {
      logs.push("=== 导入转班记录 ===");
      for (const transfer of classTransfers) {
        const transferData = transfer as Record<string, unknown>;
        const newId = isOverwrite ? transferData.id : crypto.randomUUID();

        const transferRecord = {
          id: newId,
          student_id: transferData.student_id as string,
          from_teacher_id: (transferData.from_teacher_id as string) ?? null,
          to_teacher_id: transferData.to_teacher_id as string,
          from_class: (transferData.from_class as string) ?? null,
          to_class: (transferData.to_class as string) ?? null,
          reason: (transferData.reason as string) ?? null,
          transferred_at: (transferData.transferred_at as string) ?? null,
        };

        const { error } = isOverwrite 
          ? await client.from("class_transfers").insert(transferRecord)
          : await client.from("class_transfers").upsert(transferRecord, { onConflict: "id" });

        if (error) {
          results.classTransfers.failed++;
        } else {
          results.classTransfers.success++;
        }
      }
      logs.push(`✓ 转班记录: 成功 ${results.classTransfers.success}, 失败 ${results.classTransfers.failed}`);
    }

    const totalSuccess = Object.values(results).reduce((sum, r) => sum + r.success, 0);
    const totalFailed = Object.values(results).reduce((sum, r) => sum + r.failed, 0);
    const totalSkipped = Object.values(results).reduce((sum, r) => sum + r.skipped, 0);

    const message = mode === "overwrite"
      ? `覆盖导入完成：成功 ${totalSuccess}，失败 ${totalFailed}`
      : `增量导入完成：成功 ${totalSuccess}，跳过 ${totalSkipped}，失败 ${totalFailed}`;

    return successResponse({
      mode,
      results,
      summary: {
        totalSuccess,
        totalFailed,
        totalSkipped,
        adminTeacherAssigned,
      },
      logs,
    }, message);
  } catch (error) {
    console.error("Import error:", error);
    return errorResponse("导入数据失败", 500);
  }
}
