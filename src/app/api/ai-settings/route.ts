import { z } from "zod";
import { withDbError } from "@/lib/route-handlers/with-db-error";
import { withAuth } from "@/lib/route-handlers/with-auth";
import { withValidation } from "@/lib/route-handlers/with-validation";
import { successResponse, errorResponse } from "@/lib/api-response";
import { aiSettingService } from "@/lib/services";
import { isSafeUrlAsync } from "@/lib/ssrf-guard";

const updateAiSettingsSchema = z.object({
  api_key: z.string().optional(),
  model_id: z.string().optional(),
  base_url: z.string().optional(),
  system_prompt: z.string().optional(),
  use_custom_ai: z.string().optional(),
  max_concurrent: z.string().optional(),
});

export const GET = withDbError(
  withAuth(
    async (req, { authUser }) => {
      const result = await aiSettingService.get(authUser!);
      if (result instanceof Response) return result;
      return successResponse(result);
    }
  )
);

export const PUT = withDbError(
  withAuth(
    withValidation(
      { body: updateAiSettingsSchema },
      async (req, { authUser, body }) => {
        const input = body as aiSettingService.UpdateAISettingsInput;

        // SSRF 防护：校验 base_url
        if (input.base_url) {
          const check = await isSafeUrlAsync(input.base_url);
          if (!check.safe) {
            return errorResponse(`base_url 不安全: ${check.reason}`, 400);
          }
        }

        const result = await aiSettingService.update(authUser!, input);
        if (result instanceof Response) return result;
        return successResponse(result, "设置已更新");
      }
    )
  )
);
