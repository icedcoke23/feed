import { withDbError } from "@/lib/route-handlers/with-db-error";
import { withAuth } from "@/lib/route-handlers/with-auth";
import { withValidation } from "@/lib/route-handlers/with-validation";
import { successResponse } from "@/lib/api-response";
import { themeService } from "@/lib/services";
import { z } from "zod";
import { insertTeachingThemeSchema } from "@/storage/database/shared/schema";

const querySchema = z.object({
  category: z.string().optional(),
});

const bodySchema = insertTeachingThemeSchema;

export const GET = withDbError(
  withAuth(
    withValidation(
      { query: querySchema },
      async (req, { authUser, query }) => {
        const result = await themeService.list(authUser!, query as { category?: string });
        if (result instanceof Response) return result;
        return successResponse(result);
      }
    )
  )
);

export const POST = withDbError(
  withAuth(
    withValidation(
      { body: bodySchema },
      async (req, { authUser, body }) => {
        const result = await themeService.create(
          authUser!,
          body as Parameters<typeof themeService.create>[1]
        );
        if (result instanceof Response) return result;
        return successResponse(result, "创建成功", 201);
      }
    )
  )
);
