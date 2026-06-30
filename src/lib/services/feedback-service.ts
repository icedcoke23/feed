import { db } from "@/storage/database/drizzle-client";
import {
  feedbacks,
  students,
} from "@/storage/database/shared/schema";
import { eq, inArray, and, or, isNull } from "drizzle-orm";
import * as repo from "@/lib/repositories/feedback-repository";
import * as studentRepo from "@/lib/repositories/student-repository";
import * as authService from "@/lib/services/auth-service";
import { clearStatsCache } from "@/lib/services/stats-service";
import { buildPaginationMeta } from "@/lib/pagination";
import {
  forbiddenError,
  notFoundError,
  badRequestError,
} from "@/lib/api-error";
import { extractLegacyMetadata } from "@/utils/ai-report";
import type { AuthUserResult } from "@/lib/route-auth";
import type { InsertFeedback, Feedback } from "@/storage/database/shared/schema";

function isAdmin(user: AuthUserResult) {
  return user.userRole === "admin" || user.teacherRole === "admin";
}

function isStaffTeacher(user: AuthUserResult) {
  return user.userRole === "teacher" && user.teacherRole === "admin";
}

async function canAccessFeedback(
  user: AuthUserResult,
  feedback: Feedback
): Promise<boolean> {
  if (isAdmin(user)) return true;
  if (isStaffTeacher(user)) {
    const student = await studentRepo.findById(feedback.studentId);
    return student ? student.adminTeacherId === user.userId : false;
  }
  return authService.canTeacherAccessStudent(user.userId, feedback.studentId);
}

async function getAccessibleStudentIds(user: AuthUserResult): Promise<string[]> {
  if (isStaffTeacher(user)) {
    const rows = await db
      .select({ id: students.id })
      .from(students)
      .where(
        and(
          eq(students.adminTeacherId, user.userId),
          or(eq(students.isActive, true), isNull(students.isActive))
        )
      );
    return rows.map((r) => r.id);
  }

  const classIds = await authService.getTeacherClassIds(user.userId);
  if (classIds.length === 0) return [];

  const rows = await db
    .select({ id: students.id })
    .from(students)
    .where(
      and(
        inArray(students.classId, classIds),
        or(eq(students.isActive, true), isNull(students.isActive))
      )
    );
  return rows.map((r) => r.id);
}

function normalizeJsonbItems(value: unknown) {
  if (typeof value === "string") return [{ content: value }];
  if (Array.isArray(value)) return value;
  return undefined;
}

function parseDate(value: unknown): Date | undefined {
  if (value instanceof Date) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return undefined;
}

function migrateAiReport(
  aiReport: unknown,
  metadata: Record<string, unknown>
): { aiReport: string | null | undefined; metadata: Record<string, unknown> } {
  if (aiReport === undefined || aiReport === null) {
    return { aiReport: undefined, metadata };
  }

  if (typeof aiReport === "string") {
    const legacy = extractLegacyMetadata(aiReport);
    if (legacy) {
      return { aiReport: null, metadata: { ...metadata, ...legacy } };
    }
    return { aiReport, metadata };
  }

  if (typeof aiReport === "object") {
    return { aiReport: null, metadata: { ...metadata, ...aiReport } };
  }

  return { aiReport: undefined, metadata };
}

function buildExtraMetadata(
  input: Record<string, unknown>
): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};
  const extraKeys = [
    "student_name",
    "teacher_name",
    "teacher_phone",
    "theme",
    "tag_ratings",
    "has_course_plan",
    "course_plans",
    "current_stage_id",
    "campus",
    "grade",
    "class_name",
    "school",
    "feedback_date",
    "summary",
    "student_photos",
  ];
  for (const key of extraKeys) {
    if (input[key] !== undefined) metadata[key] = input[key];
  }
  return metadata;
}

export interface CreateFeedbackInput {
  studentId?: string;
  student_id?: string;
  teacherId?: string;
  teacher_id?: string;
  strengths?: unknown;
  improvements?: unknown;
  weaknesses?: unknown;
  teachingPlan?: unknown;
  teaching_plan?: unknown;
  course_plans?: unknown;
  suggestions?: string;
  recommendations?: string;
  aiReport?: string | Record<string, unknown>;
  ai_report?: string | Record<string, unknown>;
  status?: string;
  periodStart?: string;
  period_start?: string;
  periodEnd?: string;
  period_end?: string;
  feedback_date?: string;
  workInfo?: unknown;
  work_info?: unknown;
  abilityScores?: unknown;
  ability_scores?: unknown;
  metadata?: Record<string, unknown>;
  student_name?: string;
  teacher_name?: string;
  teacher_phone?: string;
  theme?: string;
  tag_ratings?: Record<string, number>;
  has_course_plan?: boolean;
  current_stage_id?: string;
  campus?: string;
  grade?: string;
  class_name?: string;
  school?: string;
  summary?: string;
  student_photos?: Array<{ id: string; url: string }>;
}

function buildCreatePayload(
  input: CreateFeedbackInput,
  studentId: string,
  defaultTeacherId: string
): InsertFeedback {
  const teacherId = input.teacherId || input.teacher_id || defaultTeacherId;

  let metadata: Record<string, unknown> = {};
  if (input.metadata && typeof input.metadata === "object") {
    Object.assign(metadata, input.metadata);
  }
  Object.assign(metadata, buildExtraMetadata(input as Record<string, unknown>));

  const aiReportValue = input.aiReport ?? input.ai_report;
  const migrated = migrateAiReport(aiReportValue, metadata);
  metadata = migrated.metadata;

  const payload: InsertFeedback = {
    studentId,
    teacherId,
    status: input.status || "draft",
  };

  const strengths = normalizeJsonbItems(input.strengths);
  if (strengths !== undefined) payload.strengths = strengths as InsertFeedback["strengths"];

  const improvements = normalizeJsonbItems(input.improvements);
  if (improvements !== undefined) payload.improvements = improvements as InsertFeedback["improvements"];

  const weaknesses = normalizeJsonbItems(input.weaknesses);
  if (weaknesses !== undefined) payload.weaknesses = weaknesses as InsertFeedback["weaknesses"];

  const teachingPlan = input.teachingPlan || input.teaching_plan || input.course_plans;
  if (teachingPlan !== undefined) payload.teachingPlan = teachingPlan as InsertFeedback["teachingPlan"];

  const suggestions = input.suggestions || input.recommendations;
  if (suggestions !== undefined) payload.suggestions = suggestions;

  if (migrated.aiReport !== undefined) payload.aiReport = migrated.aiReport;

  if (Object.keys(metadata).length > 0) payload.metadata = metadata;

  const workInfo = input.workInfo ?? input.work_info;
  if (workInfo !== undefined) payload.workInfo = workInfo as InsertFeedback["workInfo"];

  const abilityScores = input.abilityScores ?? input.ability_scores;
  if (abilityScores !== undefined) payload.abilityScores = abilityScores as InsertFeedback["abilityScores"];

  const periodStart = parseDate(input.periodStart ?? input.period_start ?? input.feedback_date);
  if (periodStart !== undefined) payload.periodStart = periodStart;

  const periodEnd = parseDate(input.periodEnd ?? input.period_end);
  if (periodEnd !== undefined) payload.periodEnd = periodEnd;

  return payload;
}

export interface UpdateFeedbackInput {
  strengths?: unknown;
  improvements?: unknown;
  weaknesses?: unknown;
  metadata?: Record<string, unknown>;
  status?: string;
  suggestions?: string;
  recommendations?: string;
  aiReport?: string | Record<string, unknown>;
  ai_report?: string | Record<string, unknown>;
  periodStart?: string;
  period_start?: string;
  periodEnd?: string;
  period_end?: string;
  feedback_date?: string;
  teachingPlan?: unknown;
  teaching_plan?: unknown;
  workInfo?: unknown;
  work_info?: unknown;
  abilityScores?: unknown;
  ability_scores?: unknown;
}

function buildUpdatePayload(
  input: UpdateFeedbackInput,
  existingMetadata: Record<string, unknown> | null,
  newVersion: number
): Partial<InsertFeedback> & { version: number; updatedAt: Date } {
  const payload: Partial<InsertFeedback> & { version: number; updatedAt: Date } = {
    version: newVersion,
    updatedAt: new Date(),
  };

  const strengths = normalizeJsonbItems(input.strengths);
  if (strengths !== undefined) payload.strengths = strengths as InsertFeedback["strengths"];

  const improvements = normalizeJsonbItems(input.improvements);
  if (improvements !== undefined) payload.improvements = improvements as InsertFeedback["improvements"];

  const weaknesses = normalizeJsonbItems(input.weaknesses);
  if (weaknesses !== undefined) payload.weaknesses = weaknesses as InsertFeedback["weaknesses"];

  const teachingPlan = input.teachingPlan ?? input.teaching_plan;
  if (teachingPlan !== undefined) payload.teachingPlan = teachingPlan as InsertFeedback["teachingPlan"];

  const suggestions = input.suggestions ?? input.recommendations;
  if (suggestions !== undefined) payload.suggestions = suggestions;

  const workInfo = input.workInfo ?? input.work_info;
  if (workInfo !== undefined) payload.workInfo = workInfo as InsertFeedback["workInfo"];

  const abilityScores = input.abilityScores ?? input.ability_scores;
  if (abilityScores !== undefined) payload.abilityScores = abilityScores as InsertFeedback["abilityScores"];

  const periodStart = parseDate(input.periodStart ?? input.period_start ?? input.feedback_date);
  if (periodStart !== undefined) payload.periodStart = periodStart;

  const periodEnd = parseDate(input.periodEnd ?? input.period_end);
  if (periodEnd !== undefined) payload.periodEnd = periodEnd;

  if (input.status !== undefined) payload.status = input.status;

  let metadata: Record<string, unknown> = {};
  if (existingMetadata && typeof existingMetadata === "object") {
    Object.assign(metadata, existingMetadata);
  }
  if (input.metadata && typeof input.metadata === "object") {
    Object.assign(metadata, input.metadata);
  }

  const aiReportValue = input.aiReport ?? input.ai_report;
  const migrated = migrateAiReport(aiReportValue, metadata);
  metadata = migrated.metadata;

  if (migrated.aiReport !== undefined) payload.aiReport = migrated.aiReport;
  if (Object.keys(metadata).length > 0) payload.metadata = metadata;

  return payload;
}

export interface ListFeedbacksQuery {
  page: number;
  limit: number;
  studentId?: string;
  teacherId?: string;
  status?: string;
}

export async function list(user: AuthUserResult, query: ListFeedbacksQuery) {
  const options: repo.ListFeedbacksOptions = { ...query };

  if (user.userRole === "teacher") {
    const studentIds = await getAccessibleStudentIds(user);
    if (studentIds.length === 0) {
      return {
        data: [],
        pagination: buildPaginationMeta(query.page, query.limit, 0),
      };
    }
    options.studentIds = studentIds;
  }

  const result = await repo.list(options);
  return {
    data: result.data,
    pagination: buildPaginationMeta(query.page, query.limit, result.count),
  };
}

export async function findById(user: AuthUserResult, id: string) {
  const feedback = await repo.findById(id);
  if (!feedback) return notFoundError("反馈不存在");

  const allowed = await canAccessFeedback(user, feedback);
  if (!allowed) return forbiddenError("权限不足");

  return feedback;
}

export async function create(user: AuthUserResult, input: CreateFeedbackInput) {
  const studentId = input.studentId || input.student_id;
  if (!studentId) return badRequestError("缺少学员ID");

  if (user.userRole === "teacher") {
    const canAccess = await authService.canTeacherAccessStudent(
      user.userId,
      studentId
    );
    if (!canAccess) return forbiddenError("无权为该学生创建反馈");

    if (isStaffTeacher(user)) {
      const student = await studentRepo.findById(studentId);
      if (!student || student.adminTeacherId !== user.userId) {
        return forbiddenError("您只能为您的学生创建反馈");
      }
    }
  }

  const payload = buildCreatePayload(input, studentId, user.userId);
  const result = await repo.create(payload);
  clearStatsCache();
  return result;
}

export async function update(
  user: AuthUserResult,
  id: string,
  input: UpdateFeedbackInput
) {
  const existing = await repo.findById(id);
  if (!existing) return notFoundError("反馈不存在");

  const allowed = await canAccessFeedback(user, existing);
  if (!allowed) return forbiddenError("权限不足");

  const result = await db.transaction(async (tx) => {
    const rows = await tx
      .select({ version: feedbacks.version })
      .from(feedbacks)
      .where(eq(feedbacks.id, id))
      .limit(1);
    const current = rows[0];
    if (!current) return notFoundError("反馈不存在");

    const payload = buildUpdatePayload(
      input,
      existing.metadata as Record<string, unknown> | null,
      current.version + 1
    );
    const updated = await tx
      .update(feedbacks)
      .set(payload)
      .where(eq(feedbacks.id, id))
      .returning();
    return updated[0];
  });

  if (result instanceof Response) return result;
  clearStatsCache();
  return result;
}

export async function remove(user: AuthUserResult, id: string) {
  const existing = await repo.findById(id);
  if (!existing) return notFoundError("反馈不存在");

  const allowed = await canAccessFeedback(user, existing);
  if (!allowed) return forbiddenError("权限不足");

  await repo.remove(id);
  clearStatsCache();
}
