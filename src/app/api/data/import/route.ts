import { z } from "zod";
import { withDbError } from "@/lib/route-handlers/with-db-error";
import { withAuth } from "@/lib/route-handlers/with-auth";
import { withValidation } from "@/lib/route-handlers/with-validation";
import { successResponse, errorResponse } from "@/lib/api-response";
import { dataService } from "@/lib/services";

const importSchema = z.object({
  mode: z.enum(["overwrite", "incremental"]).optional().default("incremental"),
  data: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))),
});

export const POST = withDbError(
  withAuth(
    withValidation(
      { body: importSchema },
      async (req, { authUser, body }) => {
        if (authUser!.userRole !== "admin") {
          return errorResponse("仅管理员可访问", 403, "FORBIDDEN");
        }

        const { mode, data } = body as { mode: "overwrite" | "incremental"; data: dataService.ImportData };

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

        const result = await dataService.importData(data, mode);
        const totalSuccess = Object.values(result.results).reduce(
          (sum, r) => sum + r.success,
          0
        );
        const totalFailed = Object.values(result.results).reduce(
          (sum, r) => sum + r.failed,
          0
        );
        const totalSkipped = Object.values(result.results).reduce(
          (sum, r) => sum + r.skipped,
          0
        );

        const message =
          mode === "overwrite"
            ? `覆盖导入完成：成功 ${totalSuccess}，失败 ${totalFailed}`
            : `增量导入完成：成功 ${totalSuccess}，跳过 ${totalSkipped}，失败 ${totalFailed}`;

        return successResponse(
          {
            mode,
            results: result.results,
            summary: { totalSuccess, totalFailed, totalSkipped },
            logs: result.logs,
          },
          message
        );
      }
    )
  )
);
