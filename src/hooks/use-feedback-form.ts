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
  ReportData,
} from "@/types/feedback";
import { useDraftSave, type DraftData } from "@/hooks/use-draft-save";

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
  const [editId, setEditId] = useState<string | null>(editIdFromUrl);
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

  // 从 sessionStorage/localStorage 恢复数据（优先从 PDF 页返回时写入的 tempReportData）
  useEffect(() => {
    if (!restoreFromSession) return;

    const applyDraft = (draft: DraftData) => {
      setSelectedStudentId(draft.selectedStudentId || "");
      setSelectedThemeId(draft.selectedThemeId || "");
      setFeedbackDate(draft.feedbackDate || new Date().toISOString().split("T")[0]);
      if (draft.tagRatings) {
        setTagRatings(draft.tagRatings as Record<string, TagRating>);
      }
      if (draft.generatedReport) {
        setGeneratedReport(draft.generatedReport as GeneratedReport);
      }
      if (draft.hasCoursePlan !== undefined) {
        setHasCoursePlan(draft.hasCoursePlan);
      }
      if (draft.coursePlans) {
        setCoursePlans(draft.coursePlans as CoursePlan[]);
      }
      if (draft.currentStageId) {
        setCurrentStageId(draft.currentStageId);
      }
      if (draft.studentPhotos) {
        setStudentPhotos(draft.studentPhotos.map((p) => ({ id: p.id, url: p.url })));
      }
    };

    try {
      const tempData = localStorage.getItem("tempReportData");
      if (tempData) {
        const parsed = JSON.parse(tempData) as ReportData;
        setSelectedStudentId(parsed.studentId || "");
        setSelectedTeacherId(parsed.teacherId || "");
        setSelectedAdminTeacherId(parsed.adminTeacherId || "");
        setSelectedThemeId(themes.find((t) => t.name === parsed.theme)?.id || "");
        setFeedbackDate(parsed.feedbackDate || new Date().toISOString().split("T")[0]);
        if (parsed.tagRatings && Array.isArray(parsed.tagRatings)) {
          const ratings: Record<string, TagRating> = {};
          parsed.tagRatings.forEach((tag) => {
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
        if (parsed.strengths || parsed.improvements || parsed.weaknesses || parsed.recommendations || parsed.summary) {
          setGeneratedReport({
            strengths: parsed.strengths || "",
            improvements: parsed.improvements || "",
            weaknesses: parsed.weaknesses || "",
            recommendations: parsed.recommendations || "",
            summary: parsed.summary || "",
          });
        }
        if (parsed.hasCoursePlan !== undefined) {
          setHasCoursePlan(parsed.hasCoursePlan);
        }
        if (parsed.coursePlans) {
          setCoursePlans(parsed.coursePlans);
        }
        if (parsed.currentStageId) {
          setCurrentStageId(parsed.currentStageId);
        }
        if (parsed.studentPhotos) {
          setStudentPhotos(parsed.studentPhotos.map((p) => ({ id: p.id, url: p.url })));
        }
        localStorage.removeItem("tempReportData");
        return;
      }
    } catch {
      // ignore
    }

    const draft = restoreDraft();
    if (draft) {
      applyDraft(draft);
    }
  }, [restoreFromSession, restoreDraft, tags, themes]);

  // 编辑模式：从 API 加载已有反馈数据并预填表单
  useEffect(() => {
    if (!editIdFromUrl) return;

    let cancelled = false;

    const loadFeedbackForEdit = async () => {
      setEditLoading(true);
      try {
        const response = await fetch(`/api/feedbacks/${editIdFromUrl}`, { credentials: "include" });
        if (!response.ok) {
          if (!cancelled) toast.error("加载反馈数据失败");
          return;
        }
        const result = await response.json();
        const fb = result.data;
        if (!fb) return;

        // 预填学生
        if (fb.student_id) {
          if (!cancelled) setSelectedStudentId(fb.student_id);
        }

        // 预填标签评分
        const metadata = fb.metadata as Record<string, unknown> | null;
        if (metadata?.tag_ratings_detail && Array.isArray(metadata.tag_ratings_detail)) {
          const ratings: Record<string, TagRating> = {};
          (metadata.tag_ratings_detail as Array<{ name: string; rating: number; note: string; category: string }>).forEach((tag) => {
            const isCustom = !tags.some((t) => t.name === tag.name);
            const tagId = isCustom
              ? `custom-${tag.name}`
              : tags.find((t) => t.name === tag.name)?.id;
            if (tagId) {
              ratings[tagId] = { rating: tag.rating, note: tag.note || "", isCustom, category: tag.category };
            }
          });
          if (!cancelled) setTagRatings(ratings);
        }

        // 预填课程规划
        if (metadata?.has_course_plan !== undefined) {
          if (!cancelled) setHasCoursePlan(metadata.has_course_plan as boolean);
        }
        if (metadata?.course_plans && Array.isArray(metadata.course_plans)) {
          if (!cancelled) setCoursePlans(metadata.course_plans as CoursePlan[]);
        }
        if (metadata?.current_stage_id) {
          if (!cancelled) setCurrentStageId(metadata.current_stage_id as string);
        }

        // 预填报告
        const sections = metadata?.ai_report_sections as Record<string, string> | null;
        if (sections) {
          if (!cancelled) {
            setGeneratedReport({
              strengths: sections.strengths || "",
              improvements: sections.improvements || "",
              weaknesses: sections.weaknesses || "",
              recommendations: sections.recommendations || "",
              summary: (metadata?.summary as string) || "",
            });
          }
        } else if (fb.ai_report) {
          // 兼容：从 ai_report 文本中提取
          if (!cancelled) {
            setGeneratedReport({
              strengths: "",
              improvements: "",
              weaknesses: "",
              recommendations: fb.suggestions || "",
              summary: "",
            });
          }
        }

        // 预填反馈日期
        if (metadata?.feedback_date) {
          if (!cancelled) setFeedbackDate(metadata.feedback_date as string);
        } else if (fb.period_start) {
          if (!cancelled) setFeedbackDate(fb.period_start);
        }

        // 预填教师
        if (metadata?.teacher_name && teachers.length > 0) {
          const teacher = teachers.find((t) => t.name === metadata.teacher_name);
          if (teacher && !cancelled) {
            setSelectedTeacherId(teacher.id);
          }
        }

        // 预填教务教师
        if (metadata?.admin_teacher_name && adminTeachers.length > 0) {
          const adminTeacher = adminTeachers.find((t) => t.name === metadata.admin_teacher_name);
          if (adminTeacher && !cancelled) {
            setSelectedAdminTeacherId(adminTeacher.id);
          }
        }

        // 从 metadata 恢复电话号码作为回退（当教师不在数组中时仍可使用）
        if (metadata?.teacher_phone && !cancelled) {
          // 如果已找到教师但没有电话，或教师未找到，存储 metadata 中的电话
          const foundTeacher = teachers.find((t) => t.name === metadata.teacher_name) || adminTeachers.find((t) => t.name === metadata.teacher_name);
          if (!foundTeacher || !foundTeacher.phone) {
            console.info(`[useFeedbackForm] 从 metadata 恢复教师电话: ${metadata.teacher_phone}`);
          }
        }
        if (metadata?.admin_teacher_phone && !cancelled) {
          const foundAdmin = adminTeachers.find((t) => t.name === metadata.admin_teacher_name) || teachers.find((t) => t.name === metadata.admin_teacher_name);
          if (!foundAdmin || !foundAdmin.phone) {
            console.info(`[useFeedbackForm] 从 metadata 恢复教务电话: ${metadata.admin_teacher_phone}`);
          }
        }

        // 预填主题
        if (metadata?.theme && themes.length > 0) {
          const theme = themes.find((t) => t.name === metadata.theme);
          if (theme && !cancelled) {
            setSelectedThemeId(theme.id);
          }
        }

        // 预填照片
        if (metadata?.student_photos && Array.isArray(metadata.student_photos)) {
          if (!cancelled) {
            setStudentPhotos(
              (metadata.student_photos as Array<{ id: string; url: string }>).map((p) => ({
                id: p.id,
                url: p.url,
              }))
            );
          }
        }

        // 编辑模式直接跳到导出步骤
        if (!cancelled) setCurrentStep(5);
      } catch (error) {
        console.error("Failed to load feedback for edit:", error);
        if (!cancelled) toast.error("加载反馈数据失败");
      } finally {
        if (!cancelled) setEditLoading(false);
      }
    };

    // 等待 tags 数据加载完成后再预填
    if (tags.length > 0) {
      loadFeedbackForEdit();
    }

    return () => {
      cancelled = true;
    };
  }, [editIdFromUrl, tags, teachers, adminTeachers, themes]);

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
  }, [searchParams, tags]);

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
  }, [selectedStudentId, students, fetchFeedbackHistory]);

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
    // 跳过 AI 解析，直接使用前端选择的分类
    const category = customTagCategory || "strength";
    try {
      // 10秒超时保护
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
  }, [customTagName, customTagNote, customTagRating, customTagCategory]);

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
        // 学情分析字段
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

      // 课程规划
      if (hasCoursePlan === true && coursePlans.length > 0) {
        body.course_plans = JSON.stringify(coursePlans);
      }

      let response: Response;

      if (editId) {
        // 编辑模式：使用 PUT 更新
        response = await fetch(`/api/feedbacks/${editId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });
      } else {
        // 创建模式：使用 POST
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
      // 保存成功后清除草稿
      clearDraft();

      return savedId || null;
    } catch (error) {
      console.error("Failed to save feedback:", error);
      toast.error(error instanceof Error ? error.message : "保存失败，请重试");
      return null;
    } finally {
      setSaving(false);
    }
  }, [selectedStudentId, generatedReport, students, teachers, themes, selectedThemeId, selectedTeacherId, selectedAdminTeacherId, feedbackDate, tagRatings, tags, hasCoursePlan, coursePlans, currentStageId, editId, clearDraft, studentPhotos]);

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
