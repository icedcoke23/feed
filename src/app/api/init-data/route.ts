import { withDbError } from "@/lib/route-handlers/with-db-error";
import { withAuth } from "@/lib/route-handlers/with-auth";
import { successResponse } from "@/lib/api-response";
import { initDataService } from "@/lib/services";

export const POST = withDbError(
  withAuth(async (_req) => {
    const result = await initDataService.initializeDefaults();

    if (result.skipped) {
      return successResponse(null, "数据已初始化，跳过");
    }

    return successResponse(
      {
        tags: result.tags,
        themes: result.themes,
        courseStages: result.courseStages,
      },
      "初始化成功"
    );
  })
);
