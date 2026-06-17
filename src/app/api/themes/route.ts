import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/storage/database/supabase-client";
import { validateInput } from "@/lib/validations";
import { insertTeachingThemeSchema } from "@/storage/database/shared/schema";
import { handleDbError } from "@/lib/api-error";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse } from "@/lib/api-response";

// GET /api/themes - 获取教学主题列表
export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  const client = getServerSupabaseClient();
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");

  try {
    let query = client
      .from("teaching_themes")
      .select("*")
      .or("is_active.eq.true,is_active.is.null")
      .order("sort_order", { ascending: true });

    if (category) {
      query = query.eq("category", category);
    }

    const { data, error } = await query;

    if (error) {
      return handleDbError(error, "获取主题列表");
    }

    return successResponse(data);
  } catch (error) {
    return handleDbError(error, "获取主题列表");
  }
}

// POST /api/themes - 创建教学主题
export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  const client = getServerSupabaseClient();
  const body = await request.json();

  // 校验输入
  const result = validateInput(insertTeachingThemeSchema, body);
  if ("error" in result) return result.error;
  const validatedData = result.data;

  try {
    const { data, error } = await client
      .from("teaching_themes")
      .insert({
        name: validatedData.name,
        category: validatedData.category,
        description: validatedData.description,
        sort_order: validatedData.sortOrder || 0,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      return handleDbError(error, "创建主题");
    }

    return successResponse(data);
  } catch (error) {
    return handleDbError(error, "创建主题");
  }
}
