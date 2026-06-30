"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import type {
  TagItem,
  CoursePlan,
  StudentPhoto,
  GeneratedReport,
  FeedbackStudent,
  FeedbackTeacher,
} from "@/types/feedback";
import { useDraftSave } from "@/hooks/use-draft-save";
import { useFeedbackRestore } from "@/hooks/use-feedback-restore";
import { useTagOperations } from "@/hooks/use-tag-operations";
import { useFeedbackSteps } from "@/hooks/use-feedback-steps";
import { useFeedbackSave } from "@/hooks/use-feedback-save";

interface UseFeedbackFormOptions {
  tags: TagItem[];
  setTags: React.Dispatch<React.SetStateAction<TagItem[]>>;
  students: FeedbackStudent[];
  teachers: FeedbackTeacher[];
  adminTeachers: FeedbackTeacher[];
  themes: { id: string; name: string }[];
  fetchFeedbackHistory: (studentId: string) => void;
}

/**
 * 反馈表单主协调 hook。
 * 职责拆分到子 hook：
 * - useTagOperations：标签评分与自定义标签
 * - useFeedbackSteps：步骤导航
 * - useFeedbackSave：保存反馈
 *
 * 本 hook 负责：URL 解析、基础表单状态、草稿保存/恢复、PDF 返回恢复、学员选择同步。
 */
export function useFeedbackForm({
  tags,
  setTags,
  students,
  teachers,
  adminTeachers,
  themes,
  fetchFeedbackHistory,
}: UseFeedbackFormOptions) {
  const searchParams = useSearchParams();
  const studentIdFromUrl = searchParams.get("studentId");
  const stepFromUrl = searchParams.get("step");
  const restoreFromSession = searchParams.get("restore");
  const editIdFromUrl = searchParams.get("editId");

  // 编辑模式
  const [editId] = useState<string | null>(editIdFromUrl);
  const [editLoading, setEditLoading] = useState(!!editIdFromUrl);
  const isEditMode = !!editIdFromUrl;

  // 基础表单状态
  const [selectedStudentId, setSelectedStudentId] = useState(studentIdFromUrl || "");
  const [selectedThemeId, setSelectedThemeId] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [selectedAdminTeacherId, setSelectedAdminTeacherId] = useState("");
  const [feedbackDate, setFeedbackDate] = useState(new Date().toISOString().split("T")[0]);

  // 学员风采照片
  const [studentPhotos, setStudentPhotos] = useState<StudentPhoto[]>([]);

  // 生成的报告内容
  const [generatedReport, setGeneratedReport] = useState<GeneratedReport | null>(null);

  // 课程规划相关状态
  const [hasCoursePlan, setHasCoursePlan] = useState<boolean | null>(null);
  const [coursePlans, setCoursePlans] = useState<CoursePlan[]>([]);
  const [currentStageId, setCurrentStageId] = useState<string | null>(null);

  // 标签操作（子 hook）
  const tagOps = useTagOperations({ tags, setTags });

  // 步骤导航（子 hook）
  const initialStep = restoreFromSession || stepFromUrl
    ? parseInt(stepFromUrl || "4") - 1 || 3
    : 0;
  const steps = useFeedbackSteps({
    initialStep,
    selectedStudentId,
    selectedTeacherId,
    selectedAdminTeacherId,
    selectedTagsCount: tagOps.selectedTagsCount,
    generatedReport,
  });

  // 草稿保存（照片只保留可序列化的 id/url，丢弃 File 对象）
  const draftData = useMemo(
    () => ({
      selectedStudentId,
      selectedThemeId,
      selectedTeacherId,
      selectedAdminTeacherId,
      feedbackDate,
      tagRatings: tagOps.tagRatings,
      generatedReport,
      hasCoursePlan,
      coursePlans,
      currentStageId,
      studentPhotos: studentPhotos.map(({ id, url }) => ({ id, url })),
    }),
    [
      selectedStudentId,
      selectedThemeId,
      selectedTeacherId,
      selectedAdminTeacherId,
      feedbackDate,
      tagOps.tagRatings,
      generatedReport,
      hasCoursePlan,
      coursePlans,
      currentStageId,
      studentPhotos,
    ]
  );

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
    setTagRatings: tagOps.setTagRatings,
    setGeneratedReport,
    setHasCoursePlan,
    setCoursePlans,
    setCurrentStageId,
    setStudentPhotos,
    setCurrentStep: steps.setCurrentStep,
    setEditLoading,
  });

  // 注：PDF 页面返回时的数据恢复由 useFeedbackRestore 处理（通过 localStorage 的 tempReportData）

  // 学员选择时自动同步教师信息：需覆盖 URL 参数、草稿恢复、手动选择等多种
  // selectedStudentId 变化来源，effect 是合适的同步载体，此处 setState 属于
  // 响应状态变化的派生同步而非级联渲染。
  /* eslint-disable react-hooks/set-state-in-effect */
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
  /* eslint-enable react-hooks/set-state-in-effect */

  // 保存（子 hook）
  const { saving, saveFeedback } = useFeedbackSave({
    selectedStudentId,
    selectedThemeId,
    selectedTeacherId,
    selectedAdminTeacherId,
    feedbackDate,
    tagRatings: tagOps.tagRatings,
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
  });

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
    currentStep: steps.currentStep,
    setCurrentStep: steps.setCurrentStep,
    canProceed: steps.canProceed,
    handleNext: steps.handleNext,
    handleBack: steps.handleBack,
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
    tagRatings: tagOps.tagRatings,
    setTagRatings: tagOps.setTagRatings,
    categorizedTags: tagOps.categorizedTags,
    selectedTagsCount: tagOps.selectedTagsCount,
    toggleTag: tagOps.toggleTag,
    updateTagRating: tagOps.updateTagRating,
    updateTagNote: tagOps.updateTagNote,
    customTagName: tagOps.customTagName,
    setCustomTagName: tagOps.setCustomTagName,
    customTagNote: tagOps.customTagNote,
    setCustomTagNote: tagOps.setCustomTagNote,
    customTagRating: tagOps.customTagRating,
    setCustomTagRating: tagOps.setCustomTagRating,
    customTagCategory: tagOps.customTagCategory,
    setCustomTagCategory: tagOps.setCustomTagCategory,
    addingCustomTag: tagOps.addingCustomTag,
    handleAddCustomTag: tagOps.handleAddCustomTag,
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
