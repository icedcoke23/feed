import { NextRequest } from "next/server";
import { validateInput } from "@/lib/validations";
import { insertTeachingThemeSchema } from "@/storage/database/shared/schema";
import { handleDbError } from "@/lib/api-error";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import * as themeService from "@/lib/services/theme-service";
import type { TeachingTheme } from "@/storage/database/shared/schema";

function toThemeResponse(theme: TeachingTheme) {
  return {
    id: theme.id,
    name: theme.name,
    category: theme.category,
    description: theme.description,
    sort_order: theme.sortOrder,
    is_active: theme.isActive,
  };
}

// GET /api/themes/[id]
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
    const data = await themeService.findById(authUser, id);
    if (data instanceof Response) {
      return data;
    }

    return successResponse(toThemeResponse(data));
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

  const { id } = await params;
  const body = await request.json();

  const result = validateInput(insertTeachingThemeSchema.partial(), body);
  if ("error" in result) return result.error;
  const validatedData = result.data;

  try {
    const data = await themeService.update(authUser, id, validatedData);
    if (data instanceof Response) {
      return data;
    }

    return successResponse(toThemeResponse(data));
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

  const { id } = await params;

  try {
    const result = await themeService.remove(authUser, id);
    if (result instanceof Response) {
      return result;
    }

    return successResponse(null, "删除成功");
  } catch (error) {
    return handleDbError(error, "删除主题");
  }
}
