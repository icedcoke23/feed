import { z } from "zod";
import { withDbError } from "@/lib/route-handlers/with-db-error";
import { withAuth } from "@/lib/route-handlers/with-auth";
import { withValidation } from "@/lib/route-handlers/with-validation";
import { successResponse } from "@/lib/api-response";
import { parseService } from "@/lib/services";

const parseSchema = z.object({
  content: z.string().min(1).max(10000),
  type: z.enum(["students", "themes"]).optional(),
});

export const POST = withDbError(
  withAuth(
    withValidation(
      { body: parseSchema },
      async (_req, { body }) => {
        const { content, type } = body as { content: string; type?: "students" | "themes" };
        const result = await parseService.parseContent(content, type);

        if (result instanceof Response) {
          return result;
        }

        return successResponse(result);
      }
    )
  )
);
