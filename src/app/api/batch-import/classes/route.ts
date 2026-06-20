import { z } from "zod";
import { withDbError } from "@/lib/route-handlers/with-db-error";
import { withAuth } from "@/lib/route-handlers/with-auth";
import { withValidation } from "@/lib/route-handlers/with-validation";
import { successResponse, errorResponse } from "@/lib/api-response";
import { batchImportService } from "@/lib/services";

const classDataSchema = z.object({
  teacherName: z.string().min(1),
  classTime: z.string().min(1),
  courseName: z.string().min(1),
  students: z.array(z.string()),
});

const batchImportSchema = z.object({
  classes: z.array(classDataSchema).min(1),
});

export const POST = withDbError(
  withAuth(
    withValidation(
      { body: batchImportSchema },
      async (req, { authUser, body }) => {
        if (authUser!.userRole !== "admin") {
          return errorResponse("仅管理员可访问", 403, "FORBIDDEN");
        }

        const { classes } = body as { classes: batchImportService.ClassData[] };
        const result = await batchImportService.importClasses(classes);
        return successResponse(result);
      }
    )
  )
);
