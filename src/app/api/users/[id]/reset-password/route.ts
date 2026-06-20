import { z } from "zod";
import { withDbError } from "@/lib/route-handlers/with-db-error";
import { withAuth } from "@/lib/route-handlers/with-auth";
import { withValidation } from "@/lib/route-handlers/with-validation";
import { successResponse } from "@/lib/api-response";
import { userService } from "@/lib/services";

const paramsSchema = z.object({ id: z.string().uuid() });
const bodySchema = z.object({
  newPassword: z.string().min(6, "新密码至少6个字符"),
});

export const POST = withDbError(
  withAuth(
    withValidation(
      { params: paramsSchema, body: bodySchema },
      async (req, { authUser, params, body }) => {
        const { id } = params as { id: string };
        const result = await userService.resetPassword(
          authUser!,
          id,
          body as userService.ResetPasswordInput
        );
        if (result instanceof Response) return result;
        return successResponse(result, "密码重置成功");
      }
    )
  )
);
