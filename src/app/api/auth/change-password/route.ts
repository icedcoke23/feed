import { NextRequest } from "next/server";
import { withDbError } from "@/lib/route-handlers/with-db-error";
import { withAuth } from "@/lib/route-handlers/with-auth";
import { withValidation } from "@/lib/route-handlers/with-validation";
import { z } from "zod";
import { db } from "@/storage/database/drizzle-client";
import { users } from "@/storage/database/shared/schema";
import { eq } from "drizzle-orm";
import { comparePassword, hashPassword } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";

const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, "请输入旧密码"),
  newPassword: z.string().min(6, "新密码至少6个字符"),
});

export const POST = withDbError(
  withAuth(
    withValidation(
      { body: changePasswordSchema },
      async (req: NextRequest, { authUser, body }) => {
        const { oldPassword, newPassword } = body as {
          oldPassword: string;
          newPassword: string;
        };

        const rows = await db
          .select()
          .from(users)
          .where(eq(users.id, authUser!.userId))
          .limit(1);
        const user = rows[0];
        if (!user) {
          return errorResponse("用户不存在", 404);
        }

        // 验证旧密码
        if (!(await comparePassword(oldPassword, user.password))) {
          return errorResponse("旧密码错误", 400, "INVALID_PASSWORD");
        }

        // 加密新密码并更新
        const hashed = await hashPassword(newPassword);
        await db
          .update(users)
          .set({ password: hashed })
          .where(eq(users.id, user.id));

        return successResponse(null, "密码修改成功");
      }
    )
  )
);
