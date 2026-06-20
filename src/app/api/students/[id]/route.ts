import { z } from "zod";
import { withDbError } from "@/lib/route-handlers/with-db-error";
import { withAuth } from "@/lib/route-handlers/with-auth";
import { withValidation } from "@/lib/route-handlers/with-validation";
import { successResponse } from "@/lib/api-response";
import { studentService } from "@/lib/services";
import { insertStudentSchema } from "@/storage/database/shared/schema";

const paramsSchema = z.object({ id: z.string().uuid() });

const bodySchema = insertStudentSchema.partial();

export const GET = withDbError(
  withAuth(
    withValidation(
      { params: paramsSchema },
      async (req, { authUser, params }) => {
        const { id } = params as { id: string };
        const result = await studentService.findById(authUser!, id);
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
        const result = await studentService.update(
          authUser!,
          id,
          body as z.infer<typeof bodySchema>
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
        const result = await studentService.remove(authUser!, id);
        if (result instanceof Response) return result;
        return successResponse(null, "删除成功");
      }
    )
  )
);
