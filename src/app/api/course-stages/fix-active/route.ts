import { NextRequest } from "next/server";
import { getServerSupabaseClient } from "@/storage/database/supabase-client";
import { handleDbError, forbiddenError } from "@/lib/api-error";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse } from "@/lib/api-response";

// PATCH /api/course-stages/fix-active - 修复 is_active 字段
export async function PATCH(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  if (authUser.userRole !== "admin") {
    return forbiddenError("仅管理员可访问");
  }

  const client = getServerSupabaseClient();

  try {
    // 将所有 is_active 为 null 的记录更新为 true
    const { data, error } = await client
      .from("course_stages")
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .is("is_active", null)
      .select();

    if (error) {
      return handleDbError(error, "修复is_active");
    }

    return successResponse(data, `已修复 ${data?.length || 0} 条记录`);
  } catch (error) {
    console.error("Error fixing is_active:", error);
    return errorResponse("Internal server error", 500);
  }
}
