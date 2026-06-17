import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/storage/database/supabase-client";
import { validateInput } from "@/lib/validations";
import { z } from "zod";
import { handleDbError } from "@/lib/api-error";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse } from "@/lib/api-response";

const updateClassSchema = z.object({
  name: z.string().min(1).optional(),
  grade: z.string().optional(),
  teacherId: z.string().optional(),
  schedule: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

// GET /api/classes/[id]
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
    const { data, error } = await client
      .from("classes")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("[Classes GET/id] Query error:", error);
      return handleDbError(error, "获取班级");
    }

    // 获取教师信息
    let teacher = null;
    if (data.teacher_id) {
      const { data: teacherData } = await client
        .from("teachers")
        .select("id, name, phone")
        .eq("id", data.teacher_id)
        .single();
      teacher = teacherData;
    }

    return successResponse({ ...data, teacher });
  } catch (error) {
    return handleDbError(error, "获取班级");
  }
}

// PUT /api/classes/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const client = getServerSupabaseClient();
  const { id } = await params;
  const body = await request.json();

  const result = validateInput(updateClassSchema, body);
  if ("error" in result) return result.error;
  const validatedData = result.data;

  // 从 JWT 验证当前用户信息
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权", 401);
  }
  const userId = authUser.userId;
  const userRole = authUser.userRole;

  try {
    // 验证必须绑定老师
    if (!validatedData.teacherId) {
      console.error("[Classes PUT] Missing teacherId");
      return errorResponse("必须选择授课老师", 400);
    }

    // 如果是教师，检查是否有权限修改这个班级
    if (userRole === "teacher" && userId) {
      const { data: existingClass, error: checkError } = await client
        .from("classes")
        .select("teacher_id")
        .eq("id", id)
        .single();

      if (checkError) {
        console.error("[Classes PUT] Check error:", checkError);
        return errorResponse(checkError.message, 500);
      }

      if (existingClass?.teacher_id !== userId) {
        console.error("[Classes PUT] Permission denied");
        return errorResponse("无权修改此班级", 403);
      }

      // 教师不能将班级转给其他老师
      if (validatedData.teacherId !== userId) {
        console.error("[Classes PUT] Cannot transfer class");
        return errorResponse("不能将班级转给其他老师", 403);
      }
    }

    const updateData = {
      name: validatedData.name,
      grade: validatedData.grade || "",
      teacher_id: validatedData.teacherId,
      schedule: validatedData.schedule || "",
      description: validatedData.description || "",
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await client
      .from("classes")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[Classes PUT] Update error:", error);
      return handleDbError(error, "更新班级");
    }

    return successResponse(data);
  } catch (error) {
    return handleDbError(error, "更新班级");
  }
}

// DELETE /api/classes/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const client = getServerSupabaseClient();
  const { id } = await params;

  // 从 JWT 验证当前用户信息
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权", 401);
  }
  const userId = authUser.userId;
  const userRole = authUser.userRole;

  try {
    // 如果是教师，检查是否有权限删除这个班级
    if (userRole === "teacher" && userId) {
      const { data: existingClass, error: checkError } = await client
        .from("classes")
        .select("teacher_id")
        .eq("id", id)
        .single();

      if (checkError) {
        console.error("[Classes DELETE] Check error:", checkError);
        return handleDbError(checkError, "验证删除权限");
      }

      if (existingClass?.teacher_id !== userId) {
        console.error("[Classes DELETE] Permission denied");
        return errorResponse("无权删除此班级", 403);
      }
    }

    const { error } = await client
      .from("classes")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      console.error("[Classes DELETE] Delete error:", error);
      return errorResponse(error.message, 500);
    }

    return successResponse(null, "删除成功");
  } catch (error) {
    return handleDbError(error, "删除班级");
  }
}
