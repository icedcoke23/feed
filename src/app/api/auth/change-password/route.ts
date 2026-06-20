import { withDbError } from "@/lib/route-handlers/with-db-error";
import { withAuth } from "@/lib/route-handlers/with-auth";
import { withValidation } from "@/lib/route-handlers/with-validation";
import { z } from "zod";
import { successResponse } from "@/lib/api-response";
import { authService } from "@/lib/services";

const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, "请输入旧密码"),
  newPassword: z.string().min(6, "新密码至少6个字符"),
});

export const POST = withDbError(
  withAuth(
    withValidation(
      { body: changePasswordSchema },
      async (req, { authUser, body }) => {
        const result = await authService.changePassword(authUser!.userId, body as authService.ChangePasswordInput);
        if (result instanceof Response) return result;
        return successResponse(null, "密码修改成功");
      }
    )
  )
);
