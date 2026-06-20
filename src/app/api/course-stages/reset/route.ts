import { z } from "zod";
import { withDbError } from "@/lib/route-handlers/with-db-error";
import { withAuth } from "@/lib/route-handlers/with-auth";
import { withValidation } from "@/lib/route-handlers/with-validation";
import { successResponse } from "@/lib/api-response";
import * as courseStageService from "@/lib/services/course-stage-service";

const resetStagesSchema = z.object({
  confirm: z.literal("RESET_COURSE_STAGES"),
});

export const POST = withDbError(
  withAuth(
    withValidation(
      { body: resetStagesSchema },
      async (_req, { authUser, body }) => {
        void body;
        const result = await courseStageService.resetToDefaults(authUser!);

        if ("status" in result) {
          return result;
        }

        return successResponse(result, `已成功重置为默认预设，共 ${result.count} 条数据`);
      }
    )
  )
);
