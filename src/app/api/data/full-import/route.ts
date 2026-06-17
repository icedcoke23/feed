import { NextRequest } from "next/server";
import { getServerSupabaseClient } from "@/storage/database/supabase-client";
import { hashPassword } from "@/lib/auth";
import { forbiddenError } from "@/lib/api-error";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse } from "@/lib/api-response";

function getDefaultTeacherPassword(): string {
  const password = process.env.DEFAULT_TEACHER_PASSWORD;
  if (!password) {
    throw new Error('DEFAULT_TEACHER_PASSWORD environment variable must be set');
  }
  return password;
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

interface ImportResult {
  success: number;
  failed: number;
  mapping?: Record<string, string>;
}

interface ImportResults {
  teachers: ImportResult & { mapping: Record<string, string> };
  adminTeachers: { xinxin: string | null; yanzi: string | null; legacyMapping: Record<string, string> };
  classes: ImportResult & { mapping: Record<string, string>; teacherMapping: Record<string, string> };
  students: ImportResult;
  themes: ImportResult;
  tags: ImportResult;
  courseStages: ImportResult;
}

// 创建或获取默认教务老师
async function ensureDefaultAdminTeachers(
  client: ReturnType<typeof getServerSupabaseClient>,
  logs: string[]
): Promise<{ xinxin: string | null; yanzi: string | null; legacyMapping: Record<string, string> }> {
  const result = { xinxin: null as string | null, yanzi: null as string | null };
  const legacyMapping: Record<string, string> = {};

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

    // 创建 users 表记录
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

    // 创建 teachers 表记录
    const { error: teacherError } = await client.from("teachers").insert({
      id: newId,
      name: adminTeacher.name,
      email: `${adminTeacher.username}@school.com`,
      phone: adminTeacher.phone,
      role: "admin", // teachers表中标记为admin表示教务老师
      is_active: true,
    });

    if (teacherError) {
      // 回滚 users 表
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

  return { ...result, legacyMapping };
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

// POST /api/data/full-import - 完整导入数据
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
    const body = await request.json();
    const { students = [], classes = [], themes = [], tags = [], courseStages = [], teachers = [] } = body.data || body;

    // 检查数据总量限制
    const totalItems = students.length + classes.length + themes.length + tags.length + courseStages.length + teachers.length;
    if (totalItems > 500) {
      return errorResponse(`数据总量超过限制（当前${totalItems}条，最多500条）`, 400);
    }

    const results: ImportResults = {
      teachers: { success: 0, failed: 0, mapping: {} },
      adminTeachers: { xinxin: null, yanzi: null, legacyMapping: {} },
      classes: { success: 0, failed: 0, mapping: {}, teacherMapping: {} },
      students: { success: 0, failed: 0 },
      themes: { success: 0, failed: 0 },
      tags: { success: 0, failed: 0 },
      courseStages: { success: 0, failed: 0 },
    };

    const logs: string[] = [];
    const errors: string[] = [];

    // 判断是新备份格式还是旧备份格式
    const isNewFormat = teachers && teachers.length > 0;
    logs.push(`检测到${isNewFormat ? '新' : '旧'}备份格式`);
    logs.push(`数据统计: 教师${teachers.length}, 班级${classes.length}, 学员${students.length}, 主题${themes.length}, 标签${tags.length}, 课程阶段${courseStages.length}`);

    // ==========================================
    // Step 0: 创建默认教务老师
    // ==========================================
    logs.push("=== 开始创建默认教务老师 ===");
    
    results.adminTeachers = await ensureDefaultAdminTeachers(client, logs);
    logs.push(`✓ 教务老师准备完成: 心心=${results.adminTeachers.xinxin ? '已创建' : '失败'}, 燕子=${results.adminTeachers.yanzi ? '已创建' : '失败'}`);
    logs.push(`  旧ID映射: ${JSON.stringify(results.adminTeachers.legacyMapping)}`);

    // ==========================================
    // Step 1: 创建教师账号
    // ==========================================
    logs.push("=== 开始创建教师账号 ===");

    if (isNewFormat) {
      // 新格式：直接使用备份数据中的教师信息
      for (const teacher of teachers) {
        const teacherData = teacher as Record<string, unknown>;
        const oldId = teacherData.id as string;

        // 跳过教务老师（已经在 Step 0 中创建）— 通过 legacyMapping 检查
        if (results.adminTeachers.legacyMapping[oldId]) {
          // 将教务老师添加到映射表中
          results.teachers.mapping[oldId] = results.adminTeachers.legacyMapping[oldId];
          results.teachers.success++;
          continue;
        }

        const newTeacherId = crypto.randomUUID();
        const teacherName = teacherData.name as string;
        let username = teacherName;
        let success = false;

        // 尝试创建用户（最多重试3次，处理用户名冲突）
        for (let attempt = 0; attempt < 3 && !success; attempt++) {
          const currentUsername = attempt === 0 ? username : `${username}_${Date.now()}`;

          // 创建users表记录 — 仅使用白名单字段
          const { error: userError } = await client.from("users").insert({
            id: newTeacherId,
            username: currentUsername,
            name: teacherName,
            password: await hashPassword(teacherName.toLowerCase().replace(/\s+/g, '')),
            role: (teacherData.role as string) ?? "teacher",
            phone: (teacherData.phone as string) ?? null,
            is_active: (teacherData.is_active as boolean) ?? true,
          });

          if (userError) {
            if (!userError.message.includes("duplicate") || attempt === 2) {
              console.error(`创建教师用户失败 [${teacherName}]:`, userError.message);
              errors.push(`创建教师失败: ${teacherName} - ${userError.message}`);
              results.teachers.failed++;
              break;
            }
            continue;
          }
          success = true;
          username = currentUsername;
        }

        if (!success) continue;

        // 同步创建teachers表记录 — 仅使用白名单字段
        const uniqueEmail = (teacherData.email as string) || `${teacherName}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}@school.com`;
        const { error: teacherError } = await client.from("teachers").insert({
          id: newTeacherId,
          name: teacherName,
          email: uniqueEmail,
          phone: (teacherData.phone as string) ?? null,
          role: (teacherData.role as string) ?? "teacher",
          is_active: (teacherData.is_active as boolean) ?? true,
        });

        if (teacherError) {
          console.error(`创建教师记录失败 [${teacherName}]:`, teacherError.message);
          errors.push(`创建教师记录失败: ${teacherName} - ${teacherError.message}`);
          results.teachers.failed++;
          // 回滚已创建的用户
          await client.from("users").delete().eq("id", newTeacherId);
          continue;
        }

        results.teachers.mapping[oldId] = newTeacherId;
        results.teachers.success++;
      }
    } else {
      // 旧格式：动态从数据库查找教师，建立旧ID到新ID的映射
      // 先获取所有现有教师
      const { data: existingTeachers } = await client
        .from("teachers")
        .select("id, name");
      
      const teacherNameToIdMap = new Map<string, string>();
      existingTeachers?.forEach((t) => {
        teacherNameToIdMap.set(t.name, t.id);
      });

      // 从备份数据中收集所有旧教师ID，通过班级数据推断教师名称
      // 建立旧ID到教师名称的映射（从班级名称推断）
      const legacyIdToName: Record<string, string> = {};
      for (const cls of classes) {
        const clsData = cls as Record<string, unknown>;
        const teacherId = clsData.teacher_id as string;
        const clsName = clsData.name as string;
        if (teacherId && !legacyIdToName[teacherId]) {
          // 从班级名称中提取教师名称（如 "锅-周日10:30" -> "锅"）
          const teacherNameMatch = clsName.match(/^([锅何雷乐鱼铛雪罗]+)/);
          if (teacherNameMatch) {
            const shortName = teacherNameMatch[1];
            const fullName = `小${shortName}`;
            legacyIdToName[teacherId] = fullName;
          }
        }
      }

      // 对每个旧教师ID，查找或创建对应的教师
      const legacyTeacherIds = Object.keys(legacyIdToName);
      
      for (const oldTeacherId of legacyTeacherIds) {
        const teacherName = legacyIdToName[oldTeacherId];
        
        // 先查找是否已存在同名教师
        const existingId = teacherNameToIdMap.get(teacherName);
        if (existingId) {
          results.teachers.mapping[oldTeacherId] = existingId;
          results.teachers.success++;
          logs.push(`✓ 教师已存在: ${teacherName}`);
          continue;
        }

        // 创建新教师
        const newId = crypto.randomUUID();
        
        const { error: userError } = await client.from("users").insert({
          id: newId,
          username: teacherName,
          name: teacherName,
          password: await hashPassword(getDefaultTeacherPassword()),
          role: "teacher",
          is_active: true,
        });

        if (userError) {
          console.error(`创建教师用户失败 [${teacherName}]:`, userError.message);
          errors.push(`创建教师失败: ${teacherName}`);
          results.teachers.failed++;
          continue;
        }

        await client.from("teachers").insert({
          id: newId,
          name: teacherName,
          email: `${teacherName}@school.com`,
          role: "teacher",
          is_active: true,
        });

        results.teachers.mapping[oldTeacherId] = newId;
        teacherNameToIdMap.set(teacherName, newId);
        results.teachers.success++;
      }
    }
    logs.push(`✓ 教师创建完成: 成功 ${results.teachers.success}, 失败 ${results.teachers.failed}`);
    logs.push(`  教师映射表: ${Object.keys(results.teachers.mapping).length} 条`);

    // ==========================================
    // Step 2: 创建班级
    // ==========================================
    logs.push("=== 开始创建班级 ===");
    
    for (const cls of classes) {
      const clsData = cls as Record<string, unknown>;
      const oldClassId = clsData.id as string;
      const newClassId = crypto.randomUUID();
      const newTeacherId = results.teachers.mapping[clsData.teacher_id as string];
      const clsName = clsData.name as string;

      // 如果教师映射找不到，尝试通过班级名称推断教师
      let resolvedTeacherId = newTeacherId;
      if (!resolvedTeacherId) {
        // 从班级名称中提取教师名称（如 "锅-周日10:30" -> "小锅"）
        const teacherNameMatch = clsName.match(/^([锅何雷乐鱼铛雪罗]+)/);
        if (teacherNameMatch) {
          const shortName = teacherNameMatch[1];
          const fullName = `小${shortName}`;
          // 在教师映射中查找匹配名称的教师
          if (isNewFormat) {
            const matchedTeacher = teachers.find((t: Record<string, unknown>) => {
              const name = t.name as string;
              return name === fullName || name === shortName;
            });
            if (matchedTeacher) {
              const mappedId = results.teachers.mapping[matchedTeacher.id as string];
              if (mappedId) {
                resolvedTeacherId = mappedId;
                logs.push(`  班级 [${clsName}] 教师ID未找到映射，通过名称推断为: ${matchedTeacher.name}`);
              }
            }
          } else {
            // 旧格式：在映射表中查找值等于推断名称的条目
            for (const [oldId, newId] of Object.entries(results.teachers.mapping)) {
              // 通过数据库查询获取教师名称已在前面完成，这里直接用映射结果
              resolvedTeacherId = newId;
              logs.push(`  班级 [${clsName}] 教师ID未找到映射，使用映射表中的教师: ${oldId}`);
              break;
            }
          }
        }
      }

      if (!resolvedTeacherId) {
        console.error(`班级 [${clsName}] 的教师ID [${clsData.teacher_id as string}] 未找到映射，且无法推断`);
        errors.push(`班级跳过: ${clsName} - 教师未找到`);
        results.classes.failed++;
        continue;
      }

      // 仅使用白名单字段
      const { error: classError } = await client.from("classes").insert({
        id: newClassId,
        name: clsName,
        grade: (clsData.grade as string) ?? null,
        teacher_id: resolvedTeacherId,
        schedule: (clsData.schedule as string) ?? null,
        description: (clsData.description as string) ?? null,
        is_active: (clsData.is_active as boolean) ?? true,
      });

      if (classError) {
        console.error(`创建班级失败 [${clsName}]:`, classError.message);
        errors.push(`创建班级失败: ${clsName} - ${classError.message}`);
        results.classes.failed++;
        continue;
      }

      results.classes.mapping[oldClassId] = newClassId;
      results.classes.teacherMapping[oldClassId] = resolvedTeacherId;
      results.classes.success++;
    }
    logs.push(`✓ 班级创建完成: 成功 ${results.classes.success}, 失败 ${results.classes.failed}`);

    // ==========================================
    // Step 3: 导入课程阶段
    // ==========================================
    logs.push("=== 开始导入课程阶段 ===");
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
      const { error } = await client.from("course_stages").upsert(stageRecord, { onConflict: "id" });
      if (error) {
        console.error(`导入课程阶段失败 [${stageData.stage_name}]:`, error.message);
        results.courseStages.failed++;
      } else {
        results.courseStages.success++;
      }
    }
    logs.push(`✓ 课程阶段导入完成: 成功 ${results.courseStages.success}, 失败 ${results.courseStages.failed}`);

    // ==========================================
    // Step 4: 导入教学主题
    // ==========================================
    logs.push("=== 开始导入教学主题 ===");
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
      const { error } = await client.from("teaching_themes").upsert(themeRecord, { onConflict: "id" });
      if (error) {
        console.error(`导入教学主题失败 [${themeData.name}]:`, error.message);
        results.themes.failed++;
      } else {
        results.themes.success++;
      }
    }
    logs.push(`✓ 教学主题导入完成: 成功 ${results.themes.success}, 失败 ${results.themes.failed}`);

    // ==========================================
    // Step 5: 导入标签
    // ==========================================
    logs.push("=== 开始导入标签 ===");
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
      const { error } = await client.from("tags").upsert(tagRecord, { onConflict: "id" });
      if (error) {
        console.error(`导入标签失败 [${tagData.name}]:`, error.message);
        results.tags.failed++;
      } else {
        results.tags.success++;
      }
    }
    logs.push(`✓ 标签导入完成: 成功 ${results.tags.success}, 失败 ${results.tags.failed}`);

    // ==========================================
    // Step 6: 导入学员
    // ==========================================
    logs.push("=== 开始导入学员 ===");

    let missingClassCount = 0;
    let teacherFallbackCount = 0;
    let adminTeacherAssigned = { xinxin: 0, yanzi: 0 };
    
    for (const student of students) {
      const studentData = student as Record<string, unknown>;
      const studentName = studentData.name as string;
      const studentClassId = studentData.class_id as string;
      const newStudentId = crypto.randomUUID();
      const newClassId = results.classes.mapping[studentClassId];

      // 如果班级映射找不到，跳过该学员
      if (!newClassId) {
        if (missingClassCount < 5) {
          console.error(`学员 [${studentName}] 的班级ID [${studentClassId}] 未找到映射，跳过`);
          errors.push(`学员跳过: ${studentName} - 班级未找到`);
        }
        missingClassCount++;
        results.students.failed++;
        continue;
      }

      // 获取班级的教师ID（优先使用班级绑定的教师）
      const classTeacherId = results.classes.teacherMapping[studentClassId];

      // 处理 current_teacher_id
      let newTeacherId: string | null = null;
      const currentTeacherId = studentData.current_teacher_id as string | null;
      if (currentTeacherId) {
        newTeacherId = results.teachers.mapping[currentTeacherId];
        if (!newTeacherId && classTeacherId) {
          // 如果教师的映射找不到，使用班级的教师ID作为备选
          newTeacherId = classTeacherId;
          teacherFallbackCount++;
          if (teacherFallbackCount <= 5) {
            logs.push(`  学员 [${studentName}] 的授课教师未找到映射，使用班级教师`);
          }
        }
      } else if (classTeacherId) {
        // 如果学员没有授课教师，使用班级的教师
        newTeacherId = classTeacherId;
      }

      // 处理 admin_teacher_id：根据备份文件中的admin_teacher_id映射
      const legacyAdminTeacherId = studentData.admin_teacher_id as string | null;
      const newAdminTeacherId = getAdminTeacherByLegacyId(
        legacyAdminTeacherId,
        results.adminTeachers.legacyMapping,
        { xinxin: results.adminTeachers.xinxin, yanzi: results.adminTeachers.yanzi }
      );

      // 统计教务老师分配
      if (newAdminTeacherId === results.adminTeachers.xinxin) {
        adminTeacherAssigned.xinxin++;
      } else if (newAdminTeacherId === results.adminTeachers.yanzi) {
        adminTeacherAssigned.yanzi++;
      }

      // 仅使用白名单字段
      const studentRecord = {
        id: newStudentId,
        name: studentName,
        grade: (studentData.grade as string) ?? null,
        school: (studentData.school as string) ?? null,
        phone: (studentData.phone as string) ?? null,
        class_id: newClassId,
        current_teacher_id: newTeacherId,
        admin_teacher_id: newAdminTeacherId,
        current_class: (studentData.current_class as string) ?? null,
        is_active: (studentData.is_active as boolean) ?? true,
      };

      const { error: studentError } = await client.from("students").insert(studentRecord);

      if (studentError) {
        console.error(`导入学员失败 [${studentName}]:`, studentError.message);
        errors.push(`导入学员失败: ${studentName} - ${studentError.message}`);
        results.students.failed++;
        continue;
      }

      results.students.success++;
    }
    
    if (missingClassCount > 5) {
      logs.push(`  ... 共 ${missingClassCount} 名学员因班级未找到而跳过`);
    }
    if (teacherFallbackCount > 0) {
      logs.push(`  共 ${teacherFallbackCount} 名学员使用班级教师作为授课教师`);
    }
    logs.push(`✓ 教务老师分配: 心心 ${adminTeacherAssigned.xinxin} 人, 燕子 ${adminTeacherAssigned.yanzi} 人`);
    logs.push(`✓ 学员导入完成: 成功 ${results.students.success}, 失败 ${results.students.failed}`);

    // 返回结果
    return successResponse({
      format: isNewFormat ? "new" : "legacy",
      results: {
        teachers: {
          success: results.teachers.success,
          failed: results.teachers.failed,
        },
        adminTeachers: {
          xinxin: results.adminTeachers.xinxin ? '已创建' : '失败',
          yanzi: results.adminTeachers.yanzi ? '已创建' : '失败',
        },
        classes: {
          success: results.classes.success,
          failed: results.classes.failed,
        },
        students: {
          success: results.students.success,
          failed: results.students.failed,
          adminTeacherAssigned,
        },
        themes: { success: results.themes.success, failed: results.themes.failed },
        tags: { success: results.tags.success, failed: results.tags.failed },
        courseStages: { success: results.courseStages.success, failed: results.courseStages.failed },
      },
      logs,
      errors: errors.length > 0 ? errors.slice(0, 20) : undefined,
    }, "数据导入完成");
  } catch (error) {
    console.error("Import error:", error);
    return errorResponse("导入失败", 500);
  }
}
