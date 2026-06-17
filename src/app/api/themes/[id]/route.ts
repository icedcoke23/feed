import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/storage/database/supabase-client";
import { validateInput } from "@/lib/validations";
import { insertTeachingThemeSchema } from "@/storage/database/shared/schema";
import { handleDbError } from "@/lib/api-error";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse } from "@/lib/api-response";

// GET /api/themes/[id]
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
      .from("teaching_themes")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return handleDbError(error, "获取主题");
    }

    return successResponse(data);
  } catch (error) {
    return handleDbError(error, "获取主题");
  }
}

// PUT /api/themes/[id]
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

  const result = validateInput(insertTeachingThemeSchema.partial(), body);
  if ("error" in result) return result.error;
  const validatedData = result.data;

  try {
    const { data, error } = await client
      .from("teaching_themes")
      .update({
        name: validatedData.name,
        category: validatedData.category,
        description: validatedData.description,
        sort_order: validatedData.sortOrder,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return handleDbError(error, "更新主题");
    }

    return successResponse(data);
  } catch (error) {
    return handleDbError(error, "更新主题");
  }
}

// DELETE /api/themes/[id]
export async function DELETE(
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
    const { error } = await client
      .from("teaching_themes")
      .update({ is_active: false })
      .eq("id", id);

    if (error) {
      return handleDbError(error, "删除主题");
    }

    return successResponse(null, "删除成功");
  } catch (error) {
    return handleDbError(error, "删除主题");
  }
}
