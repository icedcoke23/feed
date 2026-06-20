import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/storage/database/supabase-client";
import { validateInput } from "@/lib/validations";
import { z } from "zod";
import { DEFAULT_COURSE_STAGES } from "@/lib/constants/course-stages";
import { handleDbError, forbiddenError } from "@/lib/api-error";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse } from "@/lib/api-response";

// 课程阶段创建 schema
const createCourseStageSchema = z.object({
  stageCode: z.string().min(1, "请输入阶段编码"),
  stageName: z.string().min(1, "请输入阶段名称"),
  theme: z.string().min(1, "请输入主题"),
  level: z.string().min(1, "请输入级别"),
  description: z.string().optional(),
  content: z.string().optional(),
  goal: z.string().optional(),
  sortOrder: z.number().optional(),
});

// GET /api/course-stages - 获取课程阶段预设列表
export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  const client = getServerSupabaseClient();
  const { searchParams } = new URL(request.url);
  const theme = searchParams.get("theme");
  const level = searchParams.get("level");

  try {
    // 尝试从数据库获取 - 使用 or 条件同时获取 is_active 为 true 或 null 的记录
    let query = client
      .from("course_stages")
      .select("*")
      .or("is_active.eq.true,is_active.is.null") // 兼容 is_active 为 true 或 null 的记录
      .order("sort_order", { ascending: true });

    if (theme) {
      query = query.eq("theme", theme);
    }
    if (level) {
      query = query.eq("level", level);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching course stages:", error);
      // 如果出错，返回默认预设
      let filteredStages = DEFAULT_COURSE_STAGES;
      if (theme) {
        filteredStages = filteredStages.filter(s => s.theme === theme);
      }
      if (level) {
        filteredStages = filteredStages.filter(s => s.level === level);
      }
      return successResponse(filteredStages);
    }

    // 如果数据库有数据，返回数据库数据
    if (data && data.length > 0) {
      return successResponse(data);
    }

    // 如果数据库没有数据，返回默认预设
    let filteredStages = DEFAULT_COURSE_STAGES;
    if (theme) {
      filteredStages = filteredStages.filter(s => s.theme === theme);
    }
    if (level) {
      filteredStages = filteredStages.filter(s => s.level === level);
    }
    return successResponse(filteredStages);
  } catch (error) {
    console.error("Exception in GET course-stages:", error);
    // 如果出错，返回默认预设
    let filteredStages = DEFAULT_COURSE_STAGES;
    if (theme) {
      filteredStages = filteredStages.filter(s => s.theme === theme);
    }
    if (level) {
      filteredStages = filteredStages.filter(s => s.level === level);
    }
    return successResponse(filteredStages);
  }
}

// POST /api/course-stages - 创建课程阶段预设
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
  const result = validateInput(createCourseStageSchema, body);
  if ("error" in result) return result.error;
  const validatedData = result.data;

  try {
    const { data, error } = await client
      .from("course_stages")
      .insert({
        stage_code: validatedData.stageCode,
        stage_name: validatedData.stageName,
        theme: validatedData.theme,
        level: validatedData.level,
        description: validatedData.description,
        content: validatedData.content,
        goal: validatedData.goal,
        sort_order: validatedData.sortOrder || 0,
        is_active: true, // 显式设置为 true，确保可以被查询到
      })
      .select()
      .single();

    if (error) {
      return handleDbError(error, "创建课程阶段");
    }

    return successResponse(data);
  } catch (error) {
    return handleDbError(error, "创建课程阶段");
  }
}
