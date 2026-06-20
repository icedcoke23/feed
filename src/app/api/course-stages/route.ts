import { z } from "zod";
import { withDbError } from "@/lib/route-handlers/with-db-error";
import { withAuth } from "@/lib/route-handlers/with-auth";
import { withValidation } from "@/lib/route-handlers/with-validation";
import { successResponse } from "@/lib/api-response";
import { courseStageService } from "@/lib/services";
import { insertCourseStageSchema } from "@/storage/database/shared/schema";

const querySchema = z.object({
  theme: z.string().optional(),
  level: z.string().optional(),
});

const bodySchema = insertCourseStageSchema;

export const GET = withDbError(
  withAuth(
    withValidation(
      { query: querySchema },
      async (req, { authUser, query }) => {
        const result = await courseStageService.list(
          authUser!,
          query as { theme?: string; level?: string }
        );
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
        const result = await courseStageService.create(
          authUser!,
          body as Parameters<typeof courseStageService.create>[1]
        );
        if (result instanceof Response) return result;
        return successResponse(result, "创建成功", 201);
      }
    )
  )
);
