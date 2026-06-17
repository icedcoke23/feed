import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/storage/database/supabase-client";
import { validateInput } from "@/lib/validations";
import { z } from "zod";
import { handleDbError, forbiddenError } from "@/lib/api-error";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse } from "@/lib/api-response";

const updateCourseStageSchema = z.object({
  stageName: z.string().min(1).optional(),
  theme: z.string().min(1).optional(),
  level: z.string().min(1).optional(),
  description: z.string().optional(),
  content: z.string().optional(),
  goal: z.string().optional(),
  sortOrder: z.number().optional(),
  isActive: z.boolean().optional(),
});

// GET /api/course-stages/[id] - 获取单个课程阶段
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
      .from("course_stages")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return handleDbError(error, "获取课程阶段");
    }

    if (!data) {
      return errorResponse("Not found", 404);
    }

    return successResponse(data);
  } catch (error) {
    return handleDbError(error, "获取课程阶段");
  }
}

// PUT /api/course-stages/[id] - 更新课程阶段
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

  const result = validateInput(updateCourseStageSchema, body);
  if ("error" in result) return result.error;
  const validatedData = result.data;

  try {
    const { data, error } = await client
      .from("course_stages")
      .update({
        stage_name: validatedData.stageName,
        theme: validatedData.theme,
        level: validatedData.level,
        description: validatedData.description,
        content: validatedData.content,
        goal: validatedData.goal,
        sort_order: validatedData.sortOrder,
        is_active: validatedData.isActive,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return handleDbError(error, "更新课程阶段");
    }

    return successResponse(data);
  } catch (error) {
    return handleDbError(error, "更新课程阶段");
  }
}

// DELETE /api/course-stages/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  if (authUser.userRole !== "admin") {
    return forbiddenError("仅管理员可访问");
  }

  const client = getServerSupabaseClient();
  const { id } = await params;

  try {
    const { error } = await client
      .from("course_stages")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      return handleDbError(error, "删除课程阶段");
    }

    return successResponse(null, "删除成功");
  } catch (error) {
    return handleDbError(error, "删除课程阶段");
  }
}
