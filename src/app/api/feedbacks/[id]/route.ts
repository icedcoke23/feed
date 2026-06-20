import { z } from "zod";
import { withDbError } from "@/lib/route-handlers/with-db-error";
import { withAuth } from "@/lib/route-handlers/with-auth";
import { withValidation } from "@/lib/route-handlers/with-validation";
import { successResponse } from "@/lib/api-response";
import { feedbackService } from "@/lib/services";

const paramsSchema = z.object({ id: z.string().uuid() });

const feedbackItemSchema = z.object({
  tag: z.string(),
  description: z.string().optional(),
});

const updateFeedbackSchema = z.object({
  strengths: z.array(feedbackItemSchema).optional(),
  improvements: z.array(feedbackItemSchema).optional(),
  weaknesses: z.array(feedbackItemSchema).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  status: z.string().optional(),
  suggestions: z.string().optional(),
  recommendations: z.string().optional(),
  aiReport: z.string().optional(),
  ai_report: z.string().optional(),
  periodStart: z.string().optional(),
  period_start: z.string().optional(),
  periodEnd: z.string().optional(),
  period_end: z.string().optional(),
  feedback_date: z.string().optional(),
  teachingPlan: z.string().optional(),
  teaching_plan: z.string().optional(),
  workInfo: z.string().optional(),
  work_info: z.string().optional(),
  abilityScores: z.record(z.string(), z.number()).optional(),
  ability_scores: z.record(z.string(), z.number()).optional(),
});

export const GET = withDbError(
  withAuth(
    withValidation(
      { params: paramsSchema },
      async (req, { authUser, params }) => {
        const { id } = params as { id: string };
        const result = await feedbackService.findById(authUser!, id);
        if (result instanceof Response) return result;
        return successResponse(result);
      }
    )
  )
);

export const PUT = withDbError(
  withAuth(
    withValidation(
      { params: paramsSchema, body: updateFeedbackSchema },
      async (req, { authUser, params, body }) => {
        const { id } = params as { id: string };
        const result = await feedbackService.update(
          authUser!,
          id,
          body as feedbackService.UpdateFeedbackInput
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
        const result = await feedbackService.remove(authUser!, id);
        if (result instanceof Response) return result;
        return successResponse(null, "删除成功");
      }
    )
  )
);
