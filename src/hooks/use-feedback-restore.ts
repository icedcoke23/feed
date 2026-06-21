"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import type {
  TagItem,
  TagRating,
  CoursePlan,
  StudentPhoto,
  GeneratedReport,
  FeedbackTeacher,
} from "@/types/feedback";
import type { DraftData } from "@/hooks/use-draft-save";

interface UseFeedbackRestoreOptions {
  editIdFromUrl: string | null;
  restoreFromSession: string | null;
  stepFromUrl: string | null;
  tags: TagItem[];
  teachers: FeedbackTeacher[];
  adminTeachers: FeedbackTeacher[];
  themes: { id: string; name: string }[];
  restoreDraft: () => DraftData | null;
  // setters
  setSelectedStudentId: (v: string) => void;
  setSelectedThemeId: (v: string) => void;
  setSelectedTeacherId: (v: string) => void;
  setSelectedAdminTeacherId: (v: string) => void;
  setFeedbackDate: (v: string) => void;
  setTagRatings: React.Dispatch<React.SetStateAction<Record<string, TagRating>>>;
  setGeneratedReport: React.Dispatch<React.SetStateAction<GeneratedReport | null>>;
  setHasCoursePlan: React.Dispatch<React.SetStateAction<boolean | null>>;
  setCoursePlans: React.Dispatch<React.SetStateAction<CoursePlan[]>>;
  setCurrentStageId: React.Dispatch<React.SetStateAction<string | null>>;
  setStudentPhotos: React.Dispatch<React.SetStateAction<StudentPhoto[]>>;
  setCurrentStep: React.Dispatch<React.SetStateAction<number>>;
  setEditLoading: (v: boolean) => void;
}

/**
 * 处理反馈表单的数据恢复：
 * 1. 从 localStorage 的 tempReportData 恢复（PDF 页返回）
 * 2. 从草稿恢复
 * 3. 编辑模式从 API 加载已有反馈
 */
export function useFeedbackRestore({
  editIdFromUrl,
  restoreFromSession,
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
}: UseFeedbackRestoreOptions) {
  // 从 sessionStorage/localStorage 恢复数据
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
        const parsed = JSON.parse(tempData);
        setSelectedStudentId(parsed.studentId || "");
        setSelectedTeacherId(parsed.teacherId || "");
        setSelectedAdminTeacherId(parsed.adminTeacherId || "");
        setSelectedThemeId(themes.find((t) => t.name === parsed.theme)?.id || "");
        setFeedbackDate(parsed.feedbackDate || new Date().toISOString().split("T")[0]);
        if (parsed.tagRatings && Array.isArray(parsed.tagRatings)) {
          const ratings: Record<string, TagRating> = {};
          parsed.tagRatings.forEach((tag: { name: string; rating: number; note: string }) => {
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
          setStudentPhotos(parsed.studentPhotos.map((p: { id: string; url: string }) => ({ id: p.id, url: p.url })));
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
  }, [
    restoreFromSession, restoreDraft, tags, themes,
    setSelectedStudentId, setSelectedThemeId, setSelectedTeacherId, setSelectedAdminTeacherId,
    setFeedbackDate, setTagRatings, setGeneratedReport, setHasCoursePlan,
    setCoursePlans, setCurrentStageId, setStudentPhotos,
  ]);

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
  }, [
    editIdFromUrl, tags, teachers, adminTeachers, themes,
    setSelectedStudentId, setSelectedTeacherId, setSelectedAdminTeacherId,
    setSelectedThemeId, setFeedbackDate, setTagRatings, setGeneratedReport,
    setHasCoursePlan, setCoursePlans, setCurrentStageId, setStudentPhotos,
    setCurrentStep, setEditLoading,
  ]);
}
