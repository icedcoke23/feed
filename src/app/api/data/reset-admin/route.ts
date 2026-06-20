import { NextRequest } from "next/server";
import { getServerSupabaseClient } from "@/storage/database/supabase-client";
import { hashPassword } from "@/lib/auth";
import { handleDbError, forbiddenError } from "@/lib/api-error";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse } from "@/lib/api-response";

// 生成随机密码
function generateRandomPassword(length = 16): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  let password = "";
  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  for (let i = 0; i < length; i++) {
    password += chars[array[i] % chars.length];
  }
  return password;
}

// POST /api/data/reset-admin - 清空所有数据并创建管理员账户
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
    const errors: string[] = [];
    const logs: string[] = [];

    // 1. 删除所有业务数据（按外键依赖顺序）
    logs.push("开始删除业务数据...");
    
    // 转班记录
    const { error: transfersError } = await client
      .from("class_transfers")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (transfersError) errors.push(`转班记录删除失败: ${transfersError.message}`);
    else logs.push("✓ 转班记录已删除");

    // 反馈记录
    const { error: feedbacksError } = await client
      .from("feedbacks")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (feedbacksError) errors.push(`反馈记录删除失败: ${feedbacksError.message}`);
    else logs.push("✓ 反馈记录已删除");

    // 学员
    const { error: studentsError } = await client
      .from("students")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (studentsError) errors.push(`学员删除失败: ${studentsError.message}`);
    else logs.push("✓ 学员已删除");

    // 班级
    const { error: classesError } = await client
      .from("classes")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (classesError) errors.push(`班级删除失败: ${classesError.message}`);
    else logs.push("✓ 班级已删除");

    // 教学主题
    const { error: themesError } = await client
      .from("teaching_themes")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (themesError) errors.push(`教学主题删除失败: ${themesError.message}`);
    else logs.push("✓ 教学主题已删除");

    // 标签
    const { error: tagsError } = await client
      .from("tags")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (tagsError) errors.push(`标签删除失败: ${tagsError.message}`);
    else logs.push("✓ 标签已删除");

    // 课程阶段（保留系统预设）
    const { error: stagesError } = await client
      .from("course_stages")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000001");
    if (stagesError) errors.push(`课程阶段删除失败: ${stagesError.message}`);
    else logs.push("✓ 课程阶段已删除");

    // 2. 删除所有教师（从teachers表）
    logs.push("开始删除教师数据...");
    const { error: teachersError } = await client
      .from("teachers")
      .delete()
      .eq("role", "teacher");
    if (teachersError) errors.push(`教师删除失败: ${teachersError.message}`);
    else logs.push("✓ 教师已删除");

    // 3. 删除所有教师用户（从users表）
    const { error: usersError } = await client
      .from("users")
      .delete()
      .eq("role", "teacher");
    if (usersError) errors.push(`教师用户删除失败: ${usersError.message}`);
    else logs.push("✓ 教师用户已删除");

    // 4. 删除旧管理员（如果存在）
    logs.push("开始处理管理员账户...");
    const { error: deleteAdminError } = await client
      .from("users")
      .delete()
      .eq("username", "admin");
    if (deleteAdminError) {
      logs.push(`删除旧管理员: ${deleteAdminError.message}`);
    } else {
      logs.push("✓ 旧管理员已删除");
    }

    // 5. 创建新管理员账户（密码从环境变量读取或随机生成）
    const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD || generateRandomPassword();
    const hashedPassword = await hashPassword(adminPassword);

    const adminId = crypto.randomUUID();
    const { error: createAdminError } = await client
      .from("users")
      .insert({
        id: adminId,
        username: "admin",
        password: hashedPassword,
        name: "管理员",
        role: "admin",
        created_at: new Date().toISOString(),
      });

    if (createAdminError) {
      errors.push(`创建管理员失败: ${createAdminError.message}`);
    } else {
      logs.push("✓ 管理员账户已创建 (admin)");
    }

    if (errors.length > 0) {
      console.error("Reset errors:", errors);
      return errorResponse(errors.join("; "), 500);
    }

    return successResponse({
      adminCredentials: {
        username: "admin",
        passwordHint: process.env.ADMIN_DEFAULT_PASSWORD
          ? "请查看环境变量 ADMIN_DEFAULT_PASSWORD 配置"
          : "密码已随机生成，请查看服务器日志",
      },
      logs,
    }, "数据库已重置，管理员账户已创建");
  } catch (error) {
    return handleDbError(error, "重置数据");
  }
}
