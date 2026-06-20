import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/storage/database/supabase-client";
import { validateInput } from "@/lib/validations";
import { z } from "zod";
import { handleDbError } from "@/lib/api-error";
import { DEFAULT_COZE_MODEL, getDefaultPrompt } from "@/lib/constants/ai";
import { isMaskedKey } from "@/lib/ai-client";
import { isSafeUrlAsync } from "@/lib/ssrf-guard";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { forbiddenError } from "@/lib/api-error";

// API密钥脱敏
function maskApiKey(key: string): string {
  if (!key || key.length <= 8) return "****";
  return key.slice(0, 4) + "****" + key.slice(-4);
}

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

  if (authUser.userRole !== "admin") {
    return forbiddenError("仅管理员可访问");
  }

  const client = getServerSupabaseClient();

  try {
    const { data, error } = await client
      .from("ai_settings")
      .select("*")
      .order("setting_key");

    if (error) {
      return handleDbError(error, "获取AI设置");
    }

    // 转换为对象格式
    const settings: Record<string, string> = {};
    (data || []).forEach((item) => {
      settings[item.setting_key] = item.setting_value || "";
    });

    // 设置默认值
    const defaultSettings = {
      api_key: settings.api_key ? maskApiKey(settings.api_key) : "",
      base_url: settings.base_url || "",
      model_id: settings.model_id || DEFAULT_COZE_MODEL,
      max_concurrent: settings.max_concurrent || "5",
      system_prompt: settings.system_prompt || getDefaultPrompt(),
      use_custom_ai: settings.use_custom_ai || "false",
    };

    return successResponse(defaultSettings);
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

  if (authUser.userRole !== "admin") {
    return forbiddenError("仅管理员可访问");
  }

  const client = getServerSupabaseClient();
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

    // 批量更新设置，跳过掩码值的 api_key
    const updates = Object.entries(result.data)
      .filter(([key, value]) => {
        // 如果是 api_key 且包含掩码，跳过更新
        if (key === "api_key" && typeof value === "string" && isMaskedKey(value)) {
          return false;
        }
        return true;
      })
      .map(([key, value]) => ({
        setting_key: key,
        setting_value: value as string,
        updated_at: new Date().toISOString(),
      }));

    for (const update of updates) {
      await client
        .from("ai_settings")
        .upsert(update, { onConflict: "setting_key" });
    }

    return successResponse(null, "设置已更新");
  } catch (error) {
    return handleDbError(error, "更新AI设置");
  }
}
