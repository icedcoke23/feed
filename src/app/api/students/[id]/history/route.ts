import { z } from "zod";
import { withDbError } from "@/lib/route-handlers/with-db-error";
import { withAuth } from "@/lib/route-handlers/with-auth";
import { withValidation } from "@/lib/route-handlers/with-validation";
import { successResponse } from "@/lib/api-response";
import { studentService } from "@/lib/services";

const paramsSchema = z.object({ id: z.string().uuid() });

export const GET = withDbError(
  withAuth(
    withValidation(
      { params: paramsSchema },
      async (req, { authUser, params }) => {
        const { id } = params as { id: string };
        const result = await studentService.history(authUser!, id);
        if (result instanceof Response) return result;
        return successResponse(result);
      }
    )
  )
);
