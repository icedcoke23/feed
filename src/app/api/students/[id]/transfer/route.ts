import { z } from "zod";
import { withDbError } from "@/lib/route-handlers/with-db-error";
import { withAuth } from "@/lib/route-handlers/with-auth";
import { withValidation } from "@/lib/route-handlers/with-validation";
import { successResponse } from "@/lib/api-response";
import { studentService } from "@/lib/services";

const paramsSchema = z.object({ id: z.string().uuid() });

const bodySchema = z.object({
  targetClassId: z.string().uuid("无效的班级ID"),
});

export const POST = withDbError(
  withAuth(
    withValidation(
      { params: paramsSchema, body: bodySchema },
      async (req, { authUser, params, body }) => {
        const { id } = params as { id: string };
        const result = await studentService.transfer(
          authUser!,
          id,
          body as studentService.TransferInput
        );
        if (result instanceof Response) return result;
        return successResponse(
          result,
          `学员已成功转入 ${(result as { current_class: string | null }).current_class || "新班级"}`
        );
      }
    )
  )
);
