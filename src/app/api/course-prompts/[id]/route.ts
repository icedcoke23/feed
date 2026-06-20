import { z } from "zod";
import { withDbError } from "@/lib/route-handlers/with-db-error";
import { withAuth } from "@/lib/route-handlers/with-auth";
import { withValidation } from "@/lib/route-handlers/with-validation";
import { successResponse } from "@/lib/api-response";
import { coursePromptService } from "@/lib/services";
import { insertCoursePromptSchema } from "@/storage/database/shared/schema";

const paramsSchema = z.object({ id: z.string().uuid() });

const bodySchema = insertCoursePromptSchema.partial();

export const GET = withDbError(
  withAuth(
    withValidation(
      { params: paramsSchema },
      async (req, { authUser, params }) => {
        const { id } = params as { id: string };
        const result = await coursePromptService.findById(authUser!, id);
        if (result instanceof Response) return result;
        return successResponse(result);
      }
    )
  )
);

export const PUT = withDbError(
  withAuth(
    withValidation(
      { params: paramsSchema, body: bodySchema },
      async (req, { authUser, params, body }) => {
        const { id } = params as { id: string };
        const result = await coursePromptService.update(
          authUser!,
          id,
          body as Parameters<typeof coursePromptService.update>[2]
        );
        if (result instanceof Response) return result;
        return successResponse(result, "更新成功");
      }
    )
  )
);

export const DELETE = withDbError(
  withAuth(
    withValidation(
      { params: paramsSchema },
      async (req, { authUser, params }) => {
        const { id } = params as { id: string };
        return coursePromptService.remove(authUser!, id);
      }
    )
  )
);
