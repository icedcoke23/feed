import { describe, expect, test } from "vitest";
import { toSnakeCaseFeedback } from "@/lib/services/snake-case-mappers";
import { extractLegacyMetadata } from "@/utils/ai-report";
import type { feedbacks } from "@/storage/database/shared/schema";

type FeedbackRow = typeof feedbacks.$inferSelect;

function makeFeedback(overrides: Partial<FeedbackRow> = {}): FeedbackRow {
  return {
    id: "fb-1",
    studentId: "s-1",
    teacherId: "t-1",
    strengths: null,
    improvements: null,
    weaknesses: null,
    teachingPlan: null,
    suggestions: null,
    aiReport: null,
    metadata: null,
    workInfo: null,
    abilityScores: null,
    version: 1,
    parentFeedbackId: null,
    status: "draft",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: null,
    periodStart: null,
    periodEnd: null,
    ...overrides,
  };
}

describe("toSnakeCaseFeedback", () => {
  test("将 camelCase 字段映射为 snake_case", () => {
    const fb = makeFeedback({
      studentId: "student-abc",
      teacherId: "teacher-xyz",
      teachingPlan: [{ content: "plan" }],
      parentFeedbackId: "parent-1",
      periodStart: new Date("2026-06-01"),
      periodEnd: new Date("2026-06-30"),
    });

    const result = toSnakeCaseFeedback(fb);

    expect(result.id).toBe("fb-1");
    expect(result.student_id).toBe("student-abc");
    expect(result.teacher_id).toBe("teacher-xyz");
    expect(result.teaching_plan).toEqual([{ content: "plan" }]);
    expect(result.parent_feedback_id).toBe("parent-1");
    expect(result.period_start).toEqual(new Date("2026-06-01"));
    expect(result.period_end).toEqual(new Date("2026-06-30"));
    expect(result.version).toBe(1);
    expect(result.status).toBe("draft");
  });

  test("null 字段保持 null", () => {
    const fb = makeFeedback({
      strengths: null,
      aiReport: null,
      metadata: null,
      updatedAt: null,
    });

    const result = toSnakeCaseFeedback(fb);

    expect(result.strengths).toBeNull();
    expect(result.ai_report).toBeNull();
    expect(result.metadata).toBeNull();
    expect(result.updated_at).toBeNull();
  });

  test("完整字段映射无遗漏", () => {
    const fb = makeFeedback({
      strengths: [{ tag: "专注" }],
      improvements: [{ content: "练习" }],
      weaknesses: [{ tag: "粗心" }],
      teachingPlan: [{ stage: "1" }],
      suggestions: "多练习",
      aiReport: "raw text",
      metadata: { theme: "数学" },
      workInfo: { photos: [] },
      abilityScores: [8, 7, 9],
      version: 3,
      parentFeedbackId: "p-2",
      status: "published",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-02"),
      periodStart: new Date("2026-01-01"),
      periodEnd: new Date("2026-01-31"),
    });

    const result = toSnakeCaseFeedback(fb);

    expect(result).toEqual({
      id: "fb-1",
      student_id: "s-1",
      teacher_id: "t-1",
      strengths: [{ tag: "专注" }],
      improvements: [{ content: "练习" }],
      weaknesses: [{ tag: "粗心" }],
      teaching_plan: [{ stage: "1" }],
      suggestions: "多练习",
      ai_report: "raw text",
      metadata: { theme: "数学" },
      work_info: { photos: [] },
      ability_scores: [8, 7, 9],
      version: 3,
      parent_feedback_id: "p-2",
      status: "published",
      created_at: new Date("2026-01-01"),
      updated_at: new Date("2026-01-02"),
      period_start: new Date("2026-01-01"),
      period_end: new Date("2026-01-31"),
    });
  });
});

describe("extractLegacyMetadata", () => {
  test("JSON 字符串解析为对象", () => {
    const result = extractLegacyMetadata('{"theme":"数学","tags":[]}');
    expect(result).toEqual({ theme: "数学", tags: [] });
  });

  test("纯文本返回 null", () => {
    const result = extractLegacyMetadata("这是一段纯文本，不是 JSON");
    expect(result).toBeNull();
  });

  test("null 返回 null", () => {
    const result = extractLegacyMetadata(null);
    expect(result).toBeNull();
  });

  test("空字符串返回 null", () => {
    const result = extractLegacyMetadata("");
    expect(result).toBeNull();
  });

  test("JSON 数组返回对象（数组也是对象）", () => {
    const result = extractLegacyMetadata('[1,2,3]');
    expect(result).toEqual([1, 2, 3]);
  });

  test("JSON 数字返回 null（非对象）", () => {
    const result = extractLegacyMetadata("42");
    expect(result).toBeNull();
  });
});
