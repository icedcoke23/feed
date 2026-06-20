import { z } from "zod";
import { withDbError } from "@/lib/route-handlers/with-db-error";
import { withAuth } from "@/lib/route-handlers/with-auth";
import { withValidation } from "@/lib/route-handlers/with-validation";
import { paginatedResponse, successResponse } from "@/lib/api-response";
import { studentService } from "@/lib/services";
import { insertStudentSchema } from "@/storage/database/shared/schema";

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
  teacherId: z.string().optional(),
  classId: z.string().optional(),
  search: z.string().optional(),
});

export const GET = withDbError(
  withAuth(
    withValidation(
      { query: querySchema },
      async (req, { authUser, query }) => {
        const result = await studentService.list(
          authUser!,
          query as studentService.ListStudentsQuery
        );
        if (result instanceof Response) return result;
        return paginatedResponse(result.data, result.pagination);
      }
    )
  )
);

export const POST = withDbError(
  withAuth(
    withValidation(
      { body: insertStudentSchema },
      async (req, { authUser, body }) => {
        const result = await studentService.create(
          authUser!,
          body as z.infer<typeof insertStudentSchema>
        );
        if (result instanceof Response) return result;
        return successResponse(result, "创建成功", 201);
      }
    )
  )
);
