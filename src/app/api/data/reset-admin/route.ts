import { z } from "zod";
import { withDbError } from "@/lib/route-handlers/with-db-error";
import { withAuth } from "@/lib/route-handlers/with-auth";
import { withValidation } from "@/lib/route-handlers/with-validation";
import { successResponse } from "@/lib/api-response";
import * as userService from "@/lib/services/user-service";

const resetAdminSchema = z.object({
  confirm: z.literal("RESET_ADMIN"),
});

export const POST = withDbError(
  withAuth(
    withValidation(
      { body: resetAdminSchema },
      async (_req, { authUser, body }) => {
        const result = await userService.ensureDefaultAdmin(authUser!);

        if ("status" in result) {
          return result;
        }

        return successResponse(
          { userId: result.user.id },
          result.isNew ? "默认管理员创建成功" : "默认管理员密码已重置"
        );
      }
    )
  )
);
