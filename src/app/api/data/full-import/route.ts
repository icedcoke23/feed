import { z } from "zod";
import { withDbError } from "@/lib/route-handlers/with-db-error";
import { withAuth } from "@/lib/route-handlers/with-auth";
import { withValidation } from "@/lib/route-handlers/with-validation";
import { successResponse, errorResponse } from "@/lib/api-response";
import { dataService } from "@/lib/services";

const fullImportSchema = z.object({
  data: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))),
});

export const POST = withDbError(
  withAuth(
    withValidation(
      { body: fullImportSchema },
      async (req, { authUser, body }) => {
        if (authUser!.userRole !== "admin") {
          return errorResponse("仅管理员可访问", 403, "FORBIDDEN");
        }

        const { data } = body as { data: dataService.ImportData };

        const totalItems = Object.values(data).reduce(
          (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0),
          0
        );
        if (totalItems > 500) {
          return errorResponse(
            `数据总量超过限制（当前${totalItems}条，最多500条）`,
            400
          );
        }

        const result = await dataService.fullImport(data);

        return successResponse(
          {
            format: result.format,
            results: {
              teachers: { success: result.results.teachers.success, failed: result.results.teachers.failed },
              classes: { success: result.results.classes.success, failed: result.results.classes.failed },
              students: { success: result.results.students.success, failed: result.results.students.failed },
              themes: { success: result.results.themes.success, failed: result.results.themes.failed },
              tags: { success: result.results.tags.success, failed: result.results.tags.failed },
              courseStages: { success: result.results.courseStages.success, failed: result.results.courseStages.failed },
            },
            logs: result.logs,
          },
          "数据导入完成"
        );
      }
    )
  )
);
