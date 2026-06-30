"use client";

import { useState, useCallback, useRef } from "react";
import { useSWRConfig } from "swr";
import { toast } from "sonner";
import type {
  TagItem,
  TagRating,
  CoursePlan,
  StudentPhoto,
  GeneratedReport,
  FeedbackStudent,
  FeedbackTeacher,
} from "@/types/feedback";
import { feedbackSaveSchema, firstZodError } from "@/lib/validations/client";

export interface UseFeedbackSaveOptions {
  selectedStudentId: string;
  selectedThemeId: string;
  selectedTeacherId: string;
  selectedAdminTeacherId: string;
  feedbackDate: string;
  tagRatings: Record<string, TagRating>;
  tags: TagItem[];
  students: FeedbackStudent[];
  teachers: FeedbackTeacher[];
  adminTeachers: FeedbackTeacher[];
  themes: { id: string; name: string }[];
  generatedReport: GeneratedReport | null;
  hasCoursePlan: boolean | null;
  coursePlans: CoursePlan[];
  currentStageId: string | null;
  studentPhotos: StudentPhoto[];
  editId: string | null;
  clearDraft: () => void;
}

/**
 * 反馈保存逻辑。
 * 从 use-feedback-form 拆分，负责：
 * - 构建 metadata / 请求体
 * - 调用 POST/PUT /api/feedbacks
 * - 保存成功后清除草稿
 *
 * 用 latest-ref 模式保持 saveFeedback 引用稳定，避免依赖列表过长。
 */
export function useFeedbackSave(options: UseFeedbackSaveOptions) {
  const [saving, setSaving] = useState(false);
  // latest-ref：每次渲染更新，saveFeedback 读取最新值，引用保持稳定
  const optionsRef = useRef(options);
  optionsRef.current = options;
  // 并发锁：防止用户重复点击保存按钮导致重复提交
  const savingRef = useRef(false);
  const { mutate: globalMutate } = useSWRConfig();

  const saveFeedback = useCallback(async (): Promise<string | null> => {
    // 并发保护：已有保存进行中时直接返回，避免重复提交
    if (savingRef.current) {
      return null;
    }

    const {
      selectedStudentId,
      selectedThemeId,
      selectedTeacherId,
      selectedAdminTeacherId,
      feedbackDate,
      tagRatings,
      tags,
      students,
      teachers,
      adminTeachers,
      themes,
      generatedReport,
      hasCoursePlan,
      coursePlans,
      currentStageId,
      studentPhotos,
      editId,
      clearDraft,
    } = optionsRef.current;

    if (!selectedStudentId || !generatedReport) {
      toast.error("缺少必要信息，无法保存");
      return null;
    }

    // zod 校验：确保 student_id 非空，feedback_date 可选
    const parsed = feedbackSaveSchema.safeParse({
      student_id: selectedStudentId,
      feedback_date: feedbackDate,
      teacher_id: selectedTeacherId || selectedAdminTeacherId,
    });
    if (!parsed.success) {
      toast.error(firstZodError(parsed.error));
      return null;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      const student = students.find((s) => s.id === selectedStudentId);
      const theme = themes.find((t) => t.id === selectedThemeId);
      const teacher = teachers.find((t) => t.id === selectedTeacherId);
      const adminTeacher = adminTeachers.find((t) => t.id === selectedAdminTeacherId);

      // 构建标签评分数据
      const tagRatingsData: Record<string, number> = {};
      const tagRatingsDetail: Array<{
        name: string;
        rating: number;
        note: string;
        category: string;
      }> = [];
      Object.entries(tagRatings).forEach(([tagId, data]) => {
        const tag = tags.find((t) => t.id === tagId);
        const name = tag?.name || tagId.replace(/^custom-/, "");
        tagRatingsData[name] = data.rating;
        tagRatingsDetail.push({
          name,
          rating: data.rating,
          note: data.note || "",
          category: tag?.category || data.category || "strength",
        });
      });

      // 构建 AI 报告纯文本
      const aiReportText = [
        generatedReport.strengths ? `【学员优点】\n${generatedReport.strengths}` : "",
        generatedReport.improvements ? `【能力提升】\n${generatedReport.improvements}` : "",
        generatedReport.weaknesses ? `【需要提升】\n${generatedReport.weaknesses}` : "",
        generatedReport.recommendations ? `【教学建议】\n${generatedReport.recommendations}` : "",
        generatedReport.summary ? `【总结】\n${generatedReport.summary}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");

      // 构建 metadata
      const metadata: Record<string, unknown> = {
        student_name: student?.name,
        teacher_name: teacher?.name,
        teacher_phone: teacher?.phone,
        admin_teacher_name: adminTeacher?.name,
        admin_teacher_phone: adminTeacher?.phone,
        theme: theme?.name,
        tag_ratings: tagRatingsData,
        tag_ratings_detail: tagRatingsDetail,
        has_course_plan: hasCoursePlan === true && coursePlans.length > 0,
        course_plans: hasCoursePlan === true ? coursePlans : [],
        current_stage_id: currentStageId,
        campus: student?.school || "",
        grade: student?.grade,
        class_name: student?.class_name,
        school: student?.school,
        feedback_date: feedbackDate,
        summary: generatedReport.summary,
        ai_report_sections: {
          strengths: generatedReport.strengths,
          improvements: generatedReport.improvements,
          weaknesses: generatedReport.weaknesses,
          recommendations: generatedReport.recommendations,
        },
        student_photos: studentPhotos.map(({ id, url }) => ({ id, url })),
      };

      // 构建请求体
      const body: Record<string, unknown> = {
        student_id: selectedStudentId,
        teacher_id: selectedTeacherId || selectedAdminTeacherId,
        status: "draft",
        feedback_date: feedbackDate,
        ai_report: aiReportText,
        metadata,
        strengths: tagRatingsDetail
          .filter((t) => t.category === "strength")
          .map((t) => ({ tag: t.name, description: t.note })),
        improvements: tagRatingsDetail
          .filter((t) => t.category === "improvement")
          .map((t) => ({ tag: t.name, description: t.note })),
        weaknesses: tagRatingsDetail
          .filter((t) => t.category === "weakness")
          .map((t) => ({ tag: t.name, description: t.note })),
        suggestions: generatedReport.recommendations,
      };

      if (hasCoursePlan === true && coursePlans.length > 0) {
        body.course_plans = JSON.stringify(coursePlans);
      }

      let response: Response;

      if (editId) {
        response = await fetch(`/api/feedbacks/${editId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });
      } else {
        response = await fetch("/api/feedbacks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "保存失败");
      }

      const result = await response.json();
      const savedId = result.data?.id;

      toast.success("反馈已保存");
      clearDraft();
      // 失效反馈列表缓存，让列表页/详情页重新拉取最新数据
      await globalMutate(
        (key) => typeof key === "string" && key.startsWith("/api/feedbacks")
      );

      return savedId || null;
    } catch (error) {
      console.error("Failed to save feedback:", error);
      toast.error(error instanceof Error ? error.message : "保存失败，请重试");
      return null;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [globalMutate]);

  return { saving, saveFeedback };
}
