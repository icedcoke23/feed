import { NextRequest } from "next/server";
import { validateInput } from "@/lib/validations";
import { insertTagSchema } from "@/storage/database/shared/schema";
import { handleDbError } from "@/lib/api-error";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import * as tagService from "@/lib/services/tag-service";

// GET /api/tags - 获取标签列表
export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") || undefined;

  try {
    const result = await tagService.list(authUser, { category });
    if (result instanceof Response) {
      return result;
    }

    return successResponse(result);
  } catch (error) {
    return handleDbError(error, "获取标签列表");
  }
}

// POST /api/tags - 创建标签
export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  const body = await request.json();

  // 校验输入
  const result = validateInput(insertTagSchema, body);
  if ("error" in result) return result.error;
  const validatedData = result.data;

  try {
    const data = await tagService.create(authUser, {
      ...validatedData,
      isActive: true,
    });
    if (data instanceof Response) {
      return data;
    }

    return successResponse(data);
  } catch (error) {
    return handleDbError(error, "创建标签");
  }
}
