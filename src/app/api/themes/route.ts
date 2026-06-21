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

// GET /api/themes - 获取教学主题列表
export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") || undefined;

  try {
    const result = await themeService.list(authUser, { category });
    if (result instanceof Response) {
      return result;
    }

    return successResponse(result.map(toThemeResponse));
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

  const body = await request.json();

  // 校验输入
  const result = validateInput(insertTeachingThemeSchema, body);
  if ("error" in result) return result.error;
  const validatedData = result.data;

  try {
    const data = await themeService.create(authUser, {
      ...validatedData,
      isActive: true,
    });
    if (data instanceof Response) {
      return data;
    }

    return successResponse(toThemeResponse(data));
  } catch (error) {
    return handleDbError(error, "创建主题");
  }
}
