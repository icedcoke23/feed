import { z } from "zod";
import { withDbError } from "@/lib/route-handlers/with-db-error";
import { withAuth } from "@/lib/route-handlers/with-auth";
import { withValidation } from "@/lib/route-handlers/with-validation";
import { paginatedResponse, successResponse } from "@/lib/api-response";
import { classService } from "@/lib/services";

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
  search: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
});

const bodySchema = z.object({
  name: z.string().min(1, "请输入班级名称"),
  grade: z.string().optional(),
  teacherId: z.string().min(1, "必须选择授课老师"),
  schedule: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const GET = withDbError(
  withAuth(
    withValidation(
      { query: querySchema },
      async (req, { authUser, query }) => {
        const result = await classService.list(authUser!, query as {
          page: number;
          limit: number;
          search?: string;
          isActive?: boolean;
        });
        if (result instanceof Response) return result;
        return paginatedResponse(result.data, result.pagination);
      }
    )
  )
);

export const POST = withDbError(
  withAuth(
    withValidation(
      { body: bodySchema },
      async (req, { authUser, body }) => {
        const result = await classService.create(
          authUser!,
          body as Parameters<typeof classService.create>[1]
        );
        if (result instanceof Response) return result;
        return successResponse(result, "创建成功", 201);
      }
    )
  )
);
