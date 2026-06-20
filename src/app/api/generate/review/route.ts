import { z } from "zod";
import { withDbError } from "@/lib/route-handlers/with-db-error";
import { withAuth } from "@/lib/route-handlers/with-auth";
import { withValidation } from "@/lib/route-handlers/with-validation";
import { generateService } from "@/lib/services";

const reviewSchema = z.object({
  studentName: z.string().max(50).optional(),
  theme: z.string().max(100).optional(),
  report: z.object({
    strengths: z.string().optional(),
    improvements: z.string().optional(),
    weaknesses: z.string().optional(),
    recommendations: z.string().optional(),
    summary: z.string().optional(),
  }),
  tagInfo: z.array(
    z.object({
      name: z.string().max(50),
      rating: z.number().min(1).max(5),
      note: z.string().max(200).optional().nullable(),
    })
  ).optional(),
  promptStageCode: z.string().max(50).optional(),
  currentStageId: z.string().max(50).optional(),
  level: z.string().max(50).optional(),
});

export const POST = withDbError(
  withAuth(
    withValidation(
      { body: reviewSchema },
      async (_req, { body }) => {
        return generateService.reviewFeedback(body as generateService.ReviewFeedbackInput);
      }
    )
  )
);
