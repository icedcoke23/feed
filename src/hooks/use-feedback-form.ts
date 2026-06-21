"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import type {
  TagItem,
  TagRating,
  CoursePlan,
  StudentPhoto,
  GeneratedReport,
  CategorizedTags,
  FeedbackStudent,
  FeedbackTeacher,
} from "@/types/feedback";
import { useDraftSave } from "@/hooks/use-draft-save";
import { useFeedbackRestore } from "@/hooks/use-feedback-restore";

interface UseFeedbackFormOptions {
  tags: TagItem[];
  setTags: React.Dispatch<React.SetStateAction<TagItem[]>>;
  students: FeedbackStudent[];
  teachers: FeedbackTeacher[];
  adminTeachers: FeedbackTeacher[];
  themes: { id: string; name: string }[];
  fetchFeedbackHistory: (studentId: string) => void;
}

export function useFeedbackForm({ tags, setTags, students, teachers, adminTeachers, themes, fetchFeedbackHistory }: UseFeedbackFormOptions) {
  const searchParams = useSearchParams();
  const studentIdFromUrl = searchParams.get("studentId");
  const stepFromUrl = searchParams.get("step");
  const restoreFromSession = searchParams.get("restore");
  const editIdFromUrl = searchParams.get("editId");

  // 编辑模式
  const [editId] = useState<string | null>(editIdFromUrl);
  const [editLoading, setEditLoading] = useState(!!editIdFromUrl);
  const isEditMode = !!editIdFromUrl;

  // 步骤状态
  const [currentStep, setCurrentStep] = useState(() => {
    if (restoreFromSession || stepFromUrl) {
      return parseInt(stepFromUrl || "4") - 1 || 3;
    }
    return 0;
  });

  // 表单数据
  const [selectedStudentId, setSelectedStudentId] = useState(studentIdFromUrl || "");
  const [selectedThemeId, setSelectedThemeId] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [selectedAdminTeacherId, setSelectedAdminTeacherId] = useState("");
  const [feedbackDate, setFeedbackDate] = useState(new Date().toISOString().split("T")[0]);

  // 标签评分
  const [tagRatings, setTagRatings] = useState<Record<string, TagRating>>({});

  // 自定义标签
  const [customTagName, setCustomTagName] = useState("");
  const [customTagNote, setCustomTagNote] = useState("");
  const [customTagRating, setCustomTagRating] = useState(3);
  const [customTagCategory, setCustomTagCategory] = useState<string>("strength");
  const [addingCustomTag, setAddingCustomTag] = useState(false);

  // 学员风采照片
  const [studentPhotos, setStudentPhotos] = useState<StudentPhoto[]>([]);

  // 生成的报告内容
  const [generatedReport, setGeneratedReport] = useState<GeneratedReport | null>(null);

  // 课程规划相关状态
  const [hasCoursePlan, setHasCoursePlan] = useState<boolean | null>(null);
  const [coursePlans, setCoursePlans] = useState<CoursePlan[]>([]);
  const [currentStageId, setCurrentStageId] = useState<string | null>(null);

  // 分类标签
  const categorizedTags: CategorizedTags = useMemo(() => {
    return {
      strength: tags.filter((t) => t.category === "strength"),
      improvement: tags.filter((t) => t.category === "improvement"),
      weakness: tags.filter((t) => t.category === "weakness"),
    };
  }, [tags]);

  const selectedTagsCount = Object.keys(tagRatings).length;

  // 草稿保存 hook（照片只保留可序列化的 id/url，丢弃 File 对象）
  const draftData = useMemo(() => ({
    selectedStudentId,
    selectedThemeId,
    selectedTeacherId,
    selectedAdminTeacherId,
    feedbackDate,
    tagRatings,
    generatedReport,
    hasCoursePlan,
    coursePlans,
    currentStageId,
    studentPhotos: studentPhotos.map(({ id, url }) => ({ id, url })),
  }), [
    selectedStudentId, selectedThemeId, selectedTeacherId, selectedAdminTeacherId,
    feedbackDate, tagRatings, generatedReport, hasCoursePlan, coursePlans, currentStageId,
    studentPhotos,
  ]);

  const { hasDraft, restoreDraft, clearDraft } = useDraftSave(
    isEditMode ? null : draftData
  );

  // 从 sessionStorage/localStorage 恢复 + 编辑模式加载（提取到 useFeedbackRestore）
  useFeedbackRestore({
    editIdFromUrl,
    restoreFromSession,
    stepFromUrl,
    tags,
    teachers,
    adminTeachers,
    themes,
    restoreDraft,
    setSelectedStudentId,
    setSelectedThemeId,
    setSelectedTeacherId,
    setSelectedAdminTeacherId,
    setFeedbackDate,
    setTagRatings,
    setGeneratedReport,
    setHasCoursePlan,
    setCoursePlans,
    setCurrentStageId,
    setStudentPhotos,
    setCurrentStep,
    setEditLoading,
  });

  // 从PDF页面返回时恢复数据
  useEffect(() => {
    const step = searchParams.get("step");
    if (step === "4") {
      try {
        const tempData = sessionStorage.getItem("tempReportData");
        if (tempData) {
          const report = JSON.parse(tempData);
          if (report.strengths || report.improvements || report.recommendations || report.summary) {
            setGeneratedReport({
              strengths: report.strengths || "",
              improvements: report.improvements || "",
              weaknesses: report.weaknesses || "",
              recommendations: report.recommendations || "",
              summary: report.summary || "",
            });
          }
          if (report.tagRatings && Array.isArray(report.tagRatings)) {
            const ratings: Record<string, TagRating> = {};
            report.tagRatings.forEach((tag: { name: string; rating: number; note: string }) => {
              const isCustom = !tags.some((t) => t.name === tag.name);
              const tagId = isCustom
                ? `custom-${tag.name}`
                : tags.find((t) => t.name === tag.name)?.id;
              if (tagId) {
                ratings[tagId] = { rating: tag.rating, note: tag.note, isCustom };
              }
            });
            setTagRatings(ratings);
          }
          if (report.hasCoursePlan !== undefined) {
            setHasCoursePlan(report.hasCoursePlan);
          }
          if (report.coursePlans && Array.isArray(report.coursePlans)) {
            setCoursePlans(report.coursePlans);
          }
          if (report.studentId) {
            setSelectedStudentId(report.studentId);
          }
          sessionStorage.removeItem("tempReportData");
        }
      } catch (e) {
        console.error("Failed to restore temp report data:", e);
      }
    }
  }, [searchParams, tags, setGeneratedReport, setTagRatings, setHasCoursePlan, setCoursePlans, setSelectedStudentId]);

  // 学员选择时自动同步教师信息
  useEffect(() => {
    if (selectedStudentId && students.length > 0) {
      fetchFeedbackHistory(selectedStudentId);
      const student = students.find((s) => s.id === selectedStudentId);
      if (student) {
        if (student.admin_teacher?.id) {
          setSelectedAdminTeacherId(student.admin_teacher.id);
        }
        if (student.class?.teacher_id) {
          setSelectedTeacherId(student.class.teacher_id);
        } else if (student.admin_teacher?.id) {
          setSelectedTeacherId(student.admin_teacher.id);
        }
      }
    }
  }, [selectedStudentId, students, fetchFeedbackHistory, setSelectedAdminTeacherId, setSelectedTeacherId]);

  // 标签操作
  const toggleTag = useCallback((tagId: string) => {
    setTagRatings((prev) => {
      if (prev[tagId]) {
        const newRatings = { ...prev };
        delete newRatings[tagId];
        return newRatings;
      }
      return { ...prev, [tagId]: { rating: 3, note: "" } };
    });
  }, []);

  const updateTagRating = useCallback((tagId: string, rating: number) => {
    setTagRatings((prev) => ({ ...prev, [tagId]: { ...prev[tagId], rating } }));
  }, []);

  const updateTagNote = useCallback((tagId: string, note: string) => {
    setTagRatings((prev) => ({ ...prev, [tagId]: { ...prev[tagId], note } }));
  }, []);

  // 添加自定义标签
  const handleAddCustomTag = useCallback(async () => {
    if (!customTagName.trim()) return;

    setAddingCustomTag(true);
    const category = customTagCategory || "strength";
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const saveResponse = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          category,
          name: customTagName,
          description: customTagNote || "",
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const savedTag = await saveResponse.json();

      if (!saveResponse.ok) {
        toast.error("保存标签失败");
        return;
      }

      if (savedTag.data) {
        setTags((prev) => [...prev, savedTag.data]);
        setTagRatings((prev) => ({
          ...prev,
          [savedTag.data.id]: { rating: customTagRating, note: customTagNote, isCustom: true, category: customTagCategory },
        }));
      } else {
        const tempId = `custom-${Date.now()}`;
        setTagRatings((prev) => ({
          ...prev,
          [tempId]: { rating: customTagRating, note: customTagNote, isCustom: true, category: customTagCategory },
        }));
      }

      setCustomTagName("");
      setCustomTagNote("");
      setCustomTagRating(3);
    } catch (error) {
      console.error("Failed to add custom tag:", error);
      const tempId = `custom-${Date.now()}`;
      setTagRatings((prev) => ({
        ...prev,
        [tempId]: { rating: customTagRating, note: customTagNote, isCustom: true, category: customTagCategory },
      }));
      setCustomTagName("");
      setCustomTagNote("");
      setCustomTagRating(3);
    } finally {
      setAddingCustomTag(false);
    }
  }, [customTagName, customTagNote, customTagRating, customTagCategory, setTags]);

  // 保存状态
  const [saving, setSaving] = useState(false);

  // 保存反馈到数据库
  const saveFeedback = useCallback(async (): Promise<string | null> => {
    if (!selectedStudentId || !generatedReport) {
      toast.error("缺少必要信息，无法保存");
      return null;
    }

    setSaving(true);
    try {
      const student = students.find((s) => s.id === selectedStudentId);
      const theme = themes.find((t) => t.id === selectedThemeId);
      const teacher = teachers.find((t) => t.id === selectedTeacherId);
      const adminTeacher = adminTeachers.find((t) => t.id === selectedAdminTeacherId);

      // 构建标签评分数据
      const tagRatingsData: Record<string, number> = {};
      const tagRatingsDetail: Array<{ name: string; rating: number; note: string; category: string }> = [];
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
      ].filter(Boolean).join("\n\n");

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

      return savedId || null;
    } catch (error) {
      console.error("Failed to save feedback:", error);
      toast.error(error instanceof Error ? error.message : "保存失败，请重试");
      return null;
    } finally {
      setSaving(false);
    }
  }, [selectedStudentId, generatedReport, students, teachers, adminTeachers, themes, selectedThemeId, selectedTeacherId, selectedAdminTeacherId, feedbackDate, tagRatings, tags, hasCoursePlan, coursePlans, currentStageId, editId, clearDraft, studentPhotos]);

  // 步骤导航
  const canProceed = useCallback(() => {
    switch (currentStep) {
      case 0:
        return selectedStudentId !== "";
      case 1:
        return selectedTeacherId !== "" || selectedAdminTeacherId !== "";
      case 2:
        return selectedTagsCount >= 1;
      case 3:
        return generatedReport !== null;
      default:
        return true;
    }
  }, [currentStep, selectedStudentId, selectedTeacherId, selectedAdminTeacherId, selectedTagsCount, generatedReport]);

  const handleNext = useCallback(() => {
    if (canProceed() && currentStep < 5) {
      setCurrentStep((prev) => prev + 1);
    }
  }, [canProceed, currentStep]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  return {
    // 编辑模式
    editId,
    isEditMode,
    editLoading,
    // 草稿
    hasDraft,
    restoreDraft,
    clearDraft,
    // 步骤
    currentStep,
    setCurrentStep,
    canProceed,
    handleNext,
    handleBack,
    // 表单
    selectedStudentId,
    setSelectedStudentId,
    selectedThemeId,
    setSelectedThemeId,
    selectedTeacherId,
    setSelectedTeacherId,
    selectedAdminTeacherId,
    setSelectedAdminTeacherId,
    feedbackDate,
    setFeedbackDate,
    // 标签
    tagRatings,
    setTagRatings,
    categorizedTags,
    selectedTagsCount,
    toggleTag,
    updateTagRating,
    updateTagNote,
    customTagName,
    setCustomTagName,
    customTagNote,
    setCustomTagNote,
    customTagRating,
    setCustomTagRating,
    customTagCategory,
    setCustomTagCategory,
    addingCustomTag,
    handleAddCustomTag,
    // 课程规划
    hasCoursePlan,
    setHasCoursePlan,
    coursePlans,
    setCoursePlans,
    currentStageId,
    setCurrentStageId,
    // 报告
    generatedReport,
    setGeneratedReport,
    // 照片
    studentPhotos,
    setStudentPhotos,
    // 保存
    saving,
    saveFeedback,
  };
}
