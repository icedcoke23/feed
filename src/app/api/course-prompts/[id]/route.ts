import { NextRequest } from "next/server";
import { getServerSupabaseClient } from "@/storage/database/supabase-client";
import { validateInput } from "@/lib/validations";
import { z } from "zod";
import { handleDbError, forbiddenError, notFoundError } from "@/lib/api-error";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse } from "@/lib/api-response";

const updateCoursePromptSchema = z.object({
  stage_code: z.string().min(1).optional(),
  system_prompt: z.string().optional(),
  report_structure: z.string().optional(),
  word_limit: z.string().optional(),
  is_active: z.boolean().optional(),
});

// GET /api/course-prompts/[id] - 获取单个课程提示词（已登录用户可访问，返回完整字段）
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
      .from("course_prompts")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      return handleDbError(error, "获取课程提示词");
    }

    if (!data) {
      return notFoundError("课程提示词未找到");
    }

    return successResponse(data);
  } catch (error) {
    return handleDbError(error, "获取课程提示词");
  }
}

// PUT /api/course-prompts/[id] - 更新课程提示词（仅 admin）
export async function PUT(
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
  const body = await request.json();

  const result = validateInput(updateCoursePromptSchema, body);
  if ("error" in result) return result.error;
  const validatedData = result.data;

  try {
    const { data, error } = await client
      .from("course_prompts")
      .update({
        stage_code: validatedData.stage_code,
        system_prompt: validatedData.system_prompt,
        report_structure: validatedData.report_structure,
        word_limit: validatedData.word_limit,
        is_active: validatedData.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return handleDbError(error, "更新课程提示词");
    }

    return successResponse(data);
  } catch (error) {
    return handleDbError(error, "更新课程提示词");
  }
}

// DELETE /api/course-prompts/[id] - 软删除（仅 admin）
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
      .from("course_prompts")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      return handleDbError(error, "删除课程提示词");
    }

    return successResponse(null, "删除成功");
  } catch (error) {
    return handleDbError(error, "删除课程提示词");
  }
}
