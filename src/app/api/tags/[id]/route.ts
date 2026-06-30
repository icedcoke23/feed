import { NextRequest } from "next/server";
import { validateInput } from "@/lib/validations";
import { insertTagSchema } from "@/storage/database/shared/schema";
import { handleDbError } from "@/lib/api-error";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import * as tagService from "@/lib/services/tag-service";

// GET /api/tags/[id] - 获取单个标签
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  const { id } = await params;

  try {
    const data = await tagService.findById(authUser, id);
    if (data instanceof Response) {
      return data;
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

  const { id } = await params;
  const body = await request.json();

  const result = validateInput(insertTagSchema.partial(), body);
  if ("error" in result) return result.error;
  const validatedData = result.data;

  try {
    const data = await tagService.update(authUser, id, validatedData);
    if (data instanceof Response) {
      return data;
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

  const { id } = await params;

  try {
    const result = await tagService.remove(authUser, id);
    if (result instanceof Response) {
      return result;
    }

    return successResponse(null, "删除成功");
  } catch (error) {
    return handleDbError(error, "删除标签");
  }
}
