import { z } from "zod";
import { withDbError } from "@/lib/route-handlers/with-db-error";
import { withAuth } from "@/lib/route-handlers/with-auth";
import { withValidation } from "@/lib/route-handlers/with-validation";
import { generateService } from "@/lib/services";

const tagInfoSchema = z.object({
  name: z.string().max(50),
  category: z.enum(["strength", "improvement", "weakness"]),
  rating: z.number().min(1).max(5),
  note: z.string().max(200).optional().nullable(),
});

const generateSchema = z.object({
  studentName: z.string().min(1).max(50),
  grade: z.string().max(50).optional(),
  className: z.string().max(100).optional(),
  theme: z.string().max(100).optional(),
  themeCategory: z.string().max(50).optional(),
  tagInfo: z.array(tagInfoSchema).optional(),
  ratings: z.record(z.string(), z.number().min(1).max(5)).optional(),
  notes: z.string().max(2000).optional(),
  courseStageInfo: z.string().max(1000).optional(),
  historyFeedback: z.string().max(3000).optional(),
  history: z.array(z.any()).optional(),
  promptStageCode: z.string().max(50).optional(),
  currentStageId: z.string().max(50).optional(),
  level: z.string().max(50).optional(),
});

export const POST = withDbError(
  withAuth(
    withValidation(
      { body: generateSchema },
      async (_req, { body }) => {
        return generateService.generateFeedback(body as generateService.GenerateFeedbackInput);
      }
    )
  )
);
