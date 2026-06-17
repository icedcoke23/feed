"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import type {
  FeedbackStudent,
  TagItem,
  TagRating,
  CoursePlan,
  FeedbackHistory,
  GeneratedReport,
} from "@/types/feedback";
import { generateDescriptionByRating, parseGeneratedContent } from "@/lib/feedback-utils";
import { useSSEStream, type ConnectionStatus } from "@/hooks/use-sse-stream";

interface UseReportGenerationOptions {
  students: FeedbackStudent[];
  tags: TagItem[];
  themes: { id: string; name: string }[];
  selectedStudentId: string;
  selectedThemeId: string;
  tagRatings: Record<string, TagRating>;
  coursePlans: CoursePlan[];
  currentStageId: string | null;
  feedbackHistory: FeedbackHistory[];
  generatedReport: GeneratedReport | null;
  setGeneratedReport: (report: GeneratedReport | null) => void;
}

export function useReportGeneration({
  students,
  tags,
  themes,
  selectedStudentId,
  selectedThemeId,
  tagRatings,
  coursePlans,
  currentStageId,
  feedbackHistory,
  generatedReport,
  setGeneratedReport,
}: UseReportGenerationOptions) {
  const [generating, setGenerating] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [showStreamingDialog, setShowStreamingDialog] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);

  const generateStream = useSSEStream();
  const reviewStream = useSSEStream();

  const handleGenerateReport = useCallback(async () => {
    if (!selectedStudentId) return;

    setGenerating(true);
    setShowStreamingDialog(true);

    const student = students.find((s) => s.id === selectedStudentId);
    const selectedTags = tags.filter((t) => tagRatings[t.id]);

    const customTags = Object.entries(tagRatings)
      .filter(([, data]) => data.isCustom)
      .map(([id, data]) => ({
        id,
        name: id.replace(/^custom-/, ""),
        category: data.category || "strength",
        description: data.note,
      }));

    const allTags = [...selectedTags, ...customTags];
    const tagInfo = allTags.map((tag) => {
      const rating = tagRatings[tag.id];
      const autoDesc = generateDescriptionByRating(tag.name, rating.rating, tag.category);
      return {
        name: tag.name,
        category: tag.category,
        rating: rating.rating,
        note: rating.note || autoDesc,
      };
    });

    const courseStageInfo =
      coursePlans.length > 0
        ? coursePlans
            .map((p) => {
              const status =
                p.id === currentStageId
                  ? "当前阶段"
                  : currentStageId &&
                    coursePlans.findIndex((plan) => plan.id === p.id) <
                      coursePlans.findIndex((plan) => plan.id === currentStageId)
                    ? "已学内容"
                    : "待学内容";
              return `${p.stage}(${p.theme})[${status}]: ${p.content}`;
            })
            .join("；")
        : undefined;

    const result = await generateStream.startStream("/api/generate", {
      studentName: student?.name,
      grade: student?.grade,
      className: student?.class_name,
      theme: coursePlans.length > 0 ? coursePlans[0].theme : undefined,
      themeCategory: coursePlans.length > 0 ? coursePlans[0].stage : undefined,
      courseStageInfo,
      tagInfo,
      history: feedbackHistory.slice(0, 3),
    });

    if (result) {
      const sections = parseGeneratedContent(result);

      if (!sections.strengths && !sections.improvements && !sections.recommendations) {
        toast.warning("报告生成完成，但内容解析可能不完整，请检查并手动调整");
      } else {
        toast.success("报告生成完成");
      }

      setGeneratedReport(sections);

      setTimeout(() => {
        setShowStreamingDialog(false);
      }, 500);
    } else {
      toast.error("报告生成失败，请重试");
      setShowStreamingDialog(false);
    }

    setGenerating(false);
  }, [selectedStudentId, students, tags, tagRatings, coursePlans, currentStageId, feedbackHistory, setGeneratedReport, generateStream]);

  const handleReviewReport = useCallback(async () => {
    if (!generatedReport) return;

    setReviewing(true);
    setShowReviewDialog(true);

    const student = students.find((s) => s.id === selectedStudentId);
    const theme = themes.find((t) => t.id === selectedThemeId);

    const result = await reviewStream.startStream("/api/generate/review", {
      studentName: student?.name,
      theme: theme?.name,
      report: generatedReport,
      tagInfo: Object.entries(tagRatings).map(([tagId, data]) => {
        const tag = tags.find((t) => t.id === tagId);
        return {
          name: tag?.name || tagId.replace(/^custom-/, ""),
          rating: data.rating,
          note: data.note,
        };
      }),
    });

    if (result) {
      const sections = parseGeneratedContent(result);
      setGeneratedReport(sections);

      toast.success("报告复检完成");

      setTimeout(() => {
        setShowReviewDialog(false);
      }, 500);
    } else {
      toast.error("报告复检失败，请重试");
      setShowReviewDialog(false);
    }

    setReviewing(false);
  }, [generatedReport, students, selectedStudentId, themes, selectedThemeId, tagRatings, tags, setGeneratedReport, reviewStream]);

  return {
    generating,
    reviewing,
    streamingContent: generateStream.streamingContent,
    isStreaming: generateStream.isStreaming,
    connectionStatus: generateStream.connectionStatus,
    abortStream: generateStream.abortStream,
    showStreamingDialog,
    setShowStreamingDialog,
    reviewContent: reviewStream.streamingContent,
    isReviewStreaming: reviewStream.isStreaming,
    reviewConnectionStatus: reviewStream.connectionStatus,
    abortReviewStream: reviewStream.abortStream,
    showReviewDialog,
    setShowReviewDialog,
    handleGenerateReport,
    handleReviewReport,
  };
}
