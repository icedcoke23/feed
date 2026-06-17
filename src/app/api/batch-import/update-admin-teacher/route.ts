import { NextRequest } from "next/server";
import { getServerSupabaseClient } from "@/storage/database/supabase-client";
import { forbiddenError } from "@/lib/api-error";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse } from "@/lib/api-response";

// 教务老师用户名映射（通过用户名动态查询，不再硬编码 UUID）
const ADMIN_TEACHER_USERNAMES: Record<string, string> = {
  "心": "心心",
  "高": "燕子",
};

interface StudentWithAdmin {
  name: string;
  adminType: "心" | "高";
}

// POST /api/batch-import/update-admin-teacher - 批量更新学员教务老师
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
    const { students } = body as { students: StudentWithAdmin[] };
    
    if (!students || !Array.isArray(students)) {
      return errorResponse("请提供学员数据", 400);
    }
    
    // 动态查询教务老师ID，避免硬编码 UUID
    const adminTeacherIds: Record<string, string | null> = {};
    for (const [key, username] of Object.entries(ADMIN_TEACHER_USERNAMES)) {
      const { data } = await client
        .from("users")
        .select("id")
        .eq("username", username)
        .single();
      adminTeacherIds[key] = data?.id || null;
    }
    
    const results = {
      success: true,
      updated: 0,
      notFound: [] as string[],
      errors: [] as string[],
    };
    
    for (const student of students) {
      const adminTeacherId = adminTeacherIds[student.adminType];
      
      if (!adminTeacherId) {
        results.errors.push(`未找到教务老师: ${student.adminType}`);
        continue;
      }
      
      // 更新学员的教务老师
      const { error, count } = await client
        .from("students")
        .update({ admin_teacher_id: adminTeacherId })
        .eq("name", student.name);
      
      if (error) {
        results.errors.push(`更新失败: ${student.name} - ${error.message}`);
      } else if (count === 0) {
        results.notFound.push(student.name);
      } else {
        results.updated++;
      }
    }
    
    return successResponse(results);
  } catch (error) {
    console.error("Update admin teacher error:", error);
    return errorResponse("更新失败", 500);
  }
}
