import { z } from "zod";
import { withDbError } from "@/lib/route-handlers/with-db-error";
import { withAuth } from "@/lib/route-handlers/with-auth";
import { withValidation } from "@/lib/route-handlers/with-validation";
import { successResponse } from "@/lib/api-response";
import { tagService } from "@/lib/services";
import { insertTagSchema } from "@/storage/database/shared/schema";

const querySchema = z.object({
  category: z.string().optional(),
});

export const GET = withDbError(
  withAuth(
    withValidation(
      { query: querySchema },
      async (req, { authUser, query }) => {
        const result = await tagService.list(authUser!, query as { category?: string });
        if (result instanceof Response) return result;
        return successResponse(result);
      }
    )
  )
);

export const POST = withDbError(
  withAuth(
    withValidation(
      { body: insertTagSchema },
      async (req, { authUser, body }) => {
        const result = await tagService.create(
          authUser!,
          body as Parameters<typeof tagService.create>[1]
        );
        if (result instanceof Response) return result;
        return successResponse(result, "创建成功", 201);
      }
    )
  )
);
