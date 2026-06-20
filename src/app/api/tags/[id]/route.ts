import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/storage/database/supabase-client";
import { validateInput } from "@/lib/validations";
import { insertTagSchema } from "@/storage/database/shared/schema";
import { handleDbError } from "@/lib/api-error";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse } from "@/lib/api-response";

// GET /api/tags/[id] - 获取单个标签
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
      .from("tags")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return handleDbError(error, "获取标签");
    }

    return successResponse(data);
  } catch (error) {
    return handleDbError(error, "获取标签");
  }
}

// PUT /api/tags/[id] - 更新标签
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

  const result = validateInput(insertTagSchema.partial(), body);
  if ("error" in result) return result.error;
  const validatedData = result.data;

  try {
    const { data, error } = await client
      .from("tags")
      .update({
        category: validatedData.category,
        name: validatedData.name,
        description: validatedData.description,
        sort_order: validatedData.sortOrder,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return handleDbError(error, "更新标签");
    }

    return successResponse(data);
  } catch (error) {
    return handleDbError(error, "更新标签");
  }
}

// DELETE /api/tags/[id] - 删除标签（软删除）
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
      .from("tags")
      .update({ is_active: false })
      .eq("id", id);

    if (error) {
      return handleDbError(error, "删除标签");
    }

    return successResponse(null, "删除成功");
  } catch (error) {
    return handleDbError(error, "删除标签");
  }
}
