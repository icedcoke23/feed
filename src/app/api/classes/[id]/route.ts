import { z } from "zod";
import { withDbError } from "@/lib/route-handlers/with-db-error";
import { withAuth } from "@/lib/route-handlers/with-auth";
import { withValidation } from "@/lib/route-handlers/with-validation";
import { successResponse } from "@/lib/api-response";
import { classService } from "@/lib/services";

const paramsSchema = z.object({ id: z.string().uuid() });

const bodySchema = z.object({
  name: z.string().min(1).optional(),
  grade: z.string().optional(),
  teacherId: z.string().optional(),
  schedule: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const GET = withDbError(
  withAuth(
    withValidation(
      { params: paramsSchema },
      async (req, { authUser, params }) => {
        const { id } = params as { id: string };
        const result = await classService.findById(authUser!, id);
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
        const result = await classService.update(
          authUser!,
          id,
          body as Parameters<typeof classService.update>[2]
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
        const result = await classService.remove(authUser!, id);
        if (result instanceof Response) return result;
        return successResponse(null, "删除成功");
      }
    )
  )
);
