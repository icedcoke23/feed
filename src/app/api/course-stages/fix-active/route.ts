import { z } from "zod";
import { withDbError } from "@/lib/route-handlers/with-db-error";
import { withAuth } from "@/lib/route-handlers/with-auth";
import { withValidation } from "@/lib/route-handlers/with-validation";
import { successResponse } from "@/lib/api-response";
import * as courseStageService from "@/lib/services/course-stage-service";

const fixActiveSchema = z.object({
  confirm: z.literal("FIX_ACTIVE"),
});

export const POST = withDbError(
  withAuth(
    withValidation(
      { body: fixActiveSchema },
      async (_req, { authUser, body }) => {
        void body;
        const result = await courseStageService.fixActiveStages(authUser!);

        if ("status" in result) {
          return result;
        }

        return successResponse(
          result,
          `已修复，共 ${result.total} 个活跃阶段，禁用 ${result.changed} 个`
        );
      }
    )
  )
);
