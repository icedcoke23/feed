import { z } from "zod";
import { withDbError } from "@/lib/route-handlers/with-db-error";
import { withAuth } from "@/lib/route-handlers/with-auth";
import { withValidation } from "@/lib/route-handlers/with-validation";
import { paginatedResponse, successResponse } from "@/lib/api-response";
import { feedbackService } from "@/lib/services";

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
  studentId: z.string().optional(),
  teacherId: z.string().optional(),
  status: z.string().optional(),
});

const feedbackItemSchema = z.object({
  tag: z.string(),
  description: z.string().optional(),
});

const createFeedbackSchema = z
  .object({
    studentId: z.string().min(1, "缺少学员ID").optional(),
    student_id: z.string().min(1, "缺少学员ID").optional(),
    teacherId: z.string().min(1, "缺少教师ID").optional(),
    teacher_id: z.string().min(1, "缺少教师ID").optional(),
    strengths: z.array(feedbackItemSchema).optional(),
    improvements: z.array(feedbackItemSchema).optional(),
    weaknesses: z.array(feedbackItemSchema).optional(),
    teachingPlan: z.string().optional(),
    teaching_plan: z.string().optional(),
    course_plans: z.string().optional(),
    suggestions: z.string().optional(),
    recommendations: z.string().optional(),
    aiReport: z.string().optional(),
    ai_report: z.string().optional(),
    status: z.string().optional(),
    periodStart: z.string().optional(),
    period_start: z.string().optional(),
    periodEnd: z.string().optional(),
    period_end: z.string().optional(),
    feedback_date: z.string().optional(),
    student_name: z.string().optional(),
    teacher_name: z.string().optional(),
    teacher_phone: z.string().optional(),
    theme: z.string().optional(),
    tag_ratings: z.record(z.string(), z.number()).optional(),
    has_course_plan: z.boolean().optional(),
    current_stage_id: z.string().optional(),
    campus: z.string().optional(),
    grade: z.string().optional(),
    class_name: z.string().optional(),
    school: z.string().optional(),
    summary: z.string().optional(),
    workInfo: z.string().optional(),
    work_info: z.string().optional(),
    abilityScores: z.record(z.string(), z.number()).optional(),
    ability_scores: z.record(z.string(), z.number()).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    student_photos: z.array(z.object({ id: z.string(), url: z.string() })).optional(),
  })
  .refine(
    (data) => data.studentId || data.student_id,
    { message: "缺少学员ID" }
  );

export const GET = withDbError(
  withAuth(
    withValidation(
      { query: querySchema },
      async (req, { authUser, query }) => {
        const result = await feedbackService.list(
          authUser!,
          query as feedbackService.ListFeedbacksQuery
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
      { body: createFeedbackSchema },
      async (req, { authUser, body }) => {
        const result = await feedbackService.create(
          authUser!,
          body as feedbackService.CreateFeedbackInput
        );
        if (result instanceof Response) return result;
        return successResponse(result, "创建成功", 201);
      }
    )
  )
);
