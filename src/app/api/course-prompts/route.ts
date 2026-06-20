import { z } from "zod";
import { withDbError } from "@/lib/route-handlers/with-db-error";
import { withAuth } from "@/lib/route-handlers/with-auth";
import { withValidation } from "@/lib/route-handlers/with-validation";
import { successResponse } from "@/lib/api-response";
import { coursePromptService } from "@/lib/services";
import { insertCoursePromptSchema } from "@/storage/database/shared/schema";

const querySchema = z.object({
  full: z.coerce.boolean().optional(),
});

const bodySchema = insertCoursePromptSchema;

export const GET = withDbError(
  withAuth(
    withValidation(
      { query: querySchema },
      async (req, { authUser, query }) => {
        const result = await coursePromptService.list(
          authUser!,
          query as { full?: boolean }
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
        const result = await coursePromptService.create(
          authUser!,
          body as Parameters<typeof coursePromptService.create>[1]
        );
        if (result instanceof Response) return result;
        return successResponse(result, "创建成功", 201);
      }
    )
  )
);
