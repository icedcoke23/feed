import { NextRequest } from "next/server";
import { getServerSupabaseClient } from "@/storage/database/supabase-client";
import { validateInput } from "@/lib/validations";
import { z } from "zod";
import { handleDbError, forbiddenError } from "@/lib/api-error";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse } from "@/lib/api-response";

// 课程提示词创建 schema（字段名与数据库列一致）
const createCoursePromptSchema = z.object({
  stage_code: z.string().min(1, "请输入阶段编码"),
  system_prompt: z.string().optional(),
  report_structure: z.string().optional(),
  word_limit: z.string().optional(),
  is_active: z.boolean().optional(),
});

const BRIEF_FIELDS = "id, stage_code, word_limit, is_active, created_at, updated_at";
const FULL_FIELDS = "id, stage_code, system_prompt, report_structure, word_limit, is_active, created_at, updated_at";

// GET /api/course-prompts - 获取启用的课程提示词列表（已登录用户可访问）
export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  const client = getServerSupabaseClient();
  const { searchParams } = new URL(request.url);
  const isFull = searchParams.get("full") === "true";

  try {
    const { data, error } = await client
      .from("course_prompts")
      .select(isFull ? FULL_FIELDS : BRIEF_FIELDS)
      .eq("is_active", true)
      .order("stage_code", { ascending: true });

    if (error) {
      return handleDbError(error, "获取课程提示词");
    }

    return successResponse(data || []);
  } catch (error) {
    return handleDbError(error, "获取课程提示词");
  }
}

// POST /api/course-prompts - 创建课程提示词（仅 admin）
export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  if (authUser.userRole !== "admin") {
    return forbiddenError("仅管理员可访问");
  }

  const client = getServerSupabaseClient();
  const body = await request.json();

  // 校验输入
  const result = validateInput(createCoursePromptSchema, body);
  if ("error" in result) return result.error;
  const validatedData = result.data;

  try {
    const { data, error } = await client
      .from("course_prompts")
      .insert({
        stage_code: validatedData.stage_code,
        system_prompt: validatedData.system_prompt || "",
        report_structure: validatedData.report_structure || "",
        word_limit: validatedData.word_limit || "",
        is_active: validatedData.is_active ?? true,
      })
      .select()
      .single();

    if (error) {
      return handleDbError(error, "创建课程提示词");
    }

    return successResponse(data);
  } catch (error) {
    return handleDbError(error, "创建课程提示词");
  }
}
