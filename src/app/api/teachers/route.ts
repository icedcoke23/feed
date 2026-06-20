import { z } from "zod";
import { withDbError } from "@/lib/route-handlers/with-db-error";
import { withAuth } from "@/lib/route-handlers/with-auth";
import { withValidation } from "@/lib/route-handlers/with-validation";
import { paginatedResponse, successResponse } from "@/lib/api-response";
import { teacherService } from "@/lib/services";

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
  search: z.string().optional(),
});

const bodySchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  role: z.enum(["teacher", "admin"]).default("teacher"),
});

export const GET = withDbError(
  withAuth(
    withValidation(
      { query: querySchema },
      async (req, { authUser, query }) => {
        const result = await teacherService.list(authUser!, query as {
          page: number;
          limit: number;
          search?: string;
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
        const result = await teacherService.create(
          authUser!,
          body as Parameters<typeof teacherService.create>[1]
        );
        if (result instanceof Response) return result;
        return successResponse(result, "创建成功", 201);
      }
    )
  )
);
