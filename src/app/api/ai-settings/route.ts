import { NextRequest } from "next/server";
import { validateInput } from "@/lib/validations";
import { z } from "zod";
import { handleDbError } from "@/lib/api-error";
import { isSafeUrlAsync } from "@/lib/ssrf-guard";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import * as aiSettingService from "@/lib/services/ai-setting-service";

// AI设置更新 schema（字段名与前端一致）
const updateAiSettingsSchema = z.object({
  api_key: z.string().optional(),
  model_id: z.string().optional(),
  base_url: z.string().optional(),
  system_prompt: z.string().optional(),
  use_custom_ai: z.string().optional(),
  max_concurrent: z.string().optional(),
});

// GET /api/ai-settings - 获取所有AI设置
export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  try {
    const result = await aiSettingService.get(authUser);
    if (result instanceof Response) {
      return result;
    }

    return successResponse(result);
  } catch (error) {
    return handleDbError(error, "获取AI设置");
  }
}

// PUT /api/ai-settings - 更新AI设置
export async function PUT(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  const body = await request.json();

  // 校验输入
  const result = validateInput(updateAiSettingsSchema, body);
  if ("error" in result) return result.error;

  try {
    // SSRF 防护：校验 base_url
    if (result.data.base_url) {
      const check = await isSafeUrlAsync(result.data.base_url);
      if (!check.safe) {
        return errorResponse(`base_url 不安全: ${check.reason}`, 400);
      }
    }

    const updated = await aiSettingService.update(authUser, result.data);
    if (updated instanceof Response) {
      return updated;
    }

    return successResponse(null, "设置已更新");
  } catch (error) {
    return handleDbError(error, "更新AI设置");
  }
}
