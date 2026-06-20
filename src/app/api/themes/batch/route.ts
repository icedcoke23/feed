import { z } from "zod";
import { withDbError } from "@/lib/route-handlers/with-db-error";
import { withAuth } from "@/lib/route-handlers/with-auth";
import { withValidation } from "@/lib/route-handlers/with-validation";
import { successResponse } from "@/lib/api-response";
import * as themeService from "@/lib/services/theme-service";

const themeItemSchema = z.object({
  name: z.string().min(1, "主题名称不能为空"),
  description: z.string().optional(),
  category: z.string().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

const batchCreateThemesSchema = z.object({
  themes: z.array(themeItemSchema).min(1, "请提供主题数据").max(100, "单次最多导入100条主题"),
});

export const POST = withDbError(
  withAuth(
    withValidation(
      { body: batchCreateThemesSchema },
      async (_req, { authUser, body }) => {
        const { themes } = body as { themes: Parameters<typeof themeService.batchCreate>[1] };
        const result = await themeService.batchCreate(authUser!, themes);
        if (result instanceof Response) return result;
        return successResponse(result, `成功导入 ${result.length} 个主题`);
      }
    )
  )
);
