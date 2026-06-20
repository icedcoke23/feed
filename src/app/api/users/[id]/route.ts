import { z } from "zod";
import { withDbError } from "@/lib/route-handlers/with-db-error";
import { withAuth } from "@/lib/route-handlers/with-auth";
import { withValidation } from "@/lib/route-handlers/with-validation";
import { successResponse } from "@/lib/api-response";
import { userService } from "@/lib/services";

const paramsSchema = z.object({ id: z.string().uuid() });

const bodySchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  role: z.enum(["admin", "teacher"]).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(6, "密码至少6个字符").optional(),
  teacherRole: z.enum(["teacher", "admin"]).optional(),
});

export const GET = withDbError(
  withAuth(
    withValidation(
      { params: paramsSchema },
      async (req, { authUser, params }) => {
        const { id } = params as { id: string };
        const result = await userService.findById(authUser!, id);
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
        const result = await userService.update(
          authUser!,
          id,
          body as Parameters<typeof userService.update>[2]
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
        const result = await userService.remove(authUser!, id);
        if (result instanceof Response) return result;
        return successResponse(null, "删除成功");
      }
    )
  )
);
