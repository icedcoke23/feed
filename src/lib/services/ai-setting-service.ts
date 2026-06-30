import * as repo from "@/lib/repositories/ai-setting-repository";
import { forbiddenError } from "@/lib/api-error";
import { DEFAULT_COZE_MODEL, getDefaultPrompt } from "@/lib/constants/ai";
import { isMaskedKey } from "@/lib/ai-client";
import { maskApiKey, maskUrl } from "@/lib/sensitive-mask";
import { isAdmin } from "@/lib/services/auth-utils";
import type { AuthUserResult } from "@/lib/route-auth";
import type { AiSetting, InsertAiSetting } from "@/storage/database/shared/schema";

export interface AISettingsResponse {
  api_key: string;
  base_url: string;
  model_id: string;
  max_concurrent: string;
  system_prompt: string;
  use_custom_ai: string;
}

function toResponse(settings: AiSetting | null): AISettingsResponse {
  if (!settings) {
    return {
      api_key: "",
      base_url: "",
      model_id: DEFAULT_COZE_MODEL,
      max_concurrent: "5",
      system_prompt: getDefaultPrompt(),
      use_custom_ai: "false",
    };
  }

  return {
    api_key: settings.apiKey ? maskApiKey(settings.apiKey) ?? "" : "",
    base_url: maskUrl(settings.baseUrl) ?? "",
    model_id: settings.modelId || DEFAULT_COZE_MODEL,
    max_concurrent: String(settings.maxConcurrent ?? 5),
    system_prompt: settings.systemPrompt || getDefaultPrompt(),
    use_custom_ai: String(settings.useCustomAi ?? false),
  };
}

export async function get(user: AuthUserResult): Promise<AISettingsResponse | Response> {
  if (!isAdmin(user)) return forbiddenError("仅管理员可访问");
  const settings = await repo.get();
  return toResponse(settings);
}

export interface UpdateAISettingsInput {
  api_key?: string;
  base_url?: string;
  model_id?: string;
  max_concurrent?: string;
  system_prompt?: string;
  use_custom_ai?: string;
}

export async function update(
  user: AuthUserResult,
  input: UpdateAISettingsInput
): Promise<AISettingsResponse | Response> {
  if (!isAdmin(user)) return forbiddenError("仅管理员可访问");

  const updateData: Partial<InsertAiSetting> = {};

  if (input.api_key !== undefined && !isMaskedKey(input.api_key)) {
    updateData.apiKey = input.api_key;
  }
  if (input.base_url !== undefined) {
    updateData.baseUrl = input.base_url;
  }
  if (input.model_id !== undefined) {
    updateData.modelId = input.model_id;
  }
  if (input.max_concurrent !== undefined) {
    const parsed = parseInt(input.max_concurrent, 10);
    updateData.maxConcurrent = Number.isNaN(parsed) ? 5 : parsed;
  }
  if (input.system_prompt !== undefined) {
    updateData.systemPrompt = input.system_prompt;
  }
  if (input.use_custom_ai !== undefined) {
    updateData.useCustomAi = input.use_custom_ai === "true";
  }

  const updated = await repo.update(updateData);
  return toResponse(updated);
}

/** 返回未脱敏的原始设置，供 /api/ai-settings/test 使用。 */
export async function getRaw(user: AuthUserResult): Promise<AiSetting | null | Response> {
  if (!isAdmin(user)) return forbiddenError("仅管理员可访问");
  return repo.get();
}
