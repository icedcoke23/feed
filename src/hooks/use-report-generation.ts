"use client";

import { useState, useCallback, useRef } from "react";
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
import { useSSEStream } from "@/hooks/use-sse-stream";

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
  const [metadata, setMetadata] = useState<Record<string, unknown> | null>(null);
  const generatingRef = useRef(false);
  const reviewingRef = useRef(false);

  const generateStream = useSSEStream({
    onMetadata: (meta) => setMetadata((prev) => ({ ...prev, ...meta })),
    onError: (err) => toast.error(`报告生成失败: ${err.message}`),
  });
  const reviewStream = useSSEStream({
    onMetadata: (meta) => setMetadata((prev) => ({ ...prev, ...meta })),
    onError: (err) => toast.error(`报告复检失败: ${err.message}`),
  });

  const handleGenerateReport = useCallback(async (promptStageCode?: string) => {
    if (!selectedStudentId) return;
    if (generatingRef.current || generateStream.isStreaming) {
      console.warn("[Generate] 已有生成任务进行中，忽略重复请求");
      return;
    }
    generatingRef.current = true;

    setGenerating(true);
    setShowStreamingDialog(true);
    setMetadata(null);

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
        note: rating.note || autoDesc || "",
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

    const generateBody = Object.fromEntries(
      Object.entries({
        studentName: student?.name,
        grade: student?.grade,
        className: student?.class_name,
        theme: coursePlans.length > 0 ? coursePlans[0].theme : undefined,
        themeCategory: coursePlans.length > 0 ? coursePlans[0].stage : undefined,
        courseStageInfo,
        tagInfo,
        history: feedbackHistory.slice(0, 3),
        currentStageId: currentStageId || undefined,
        promptStageCode,
      }).filter(([, v]) => v !== undefined && v !== null)
    );

    const result = await generateStream.startStream("/api/generate", generateBody);

    if (result) {
      const sections = parseGeneratedContent(result);

      if (!sections.strengths && !sections.improvements && !sections.recommendations && !sections.summary) {
        toast.warning("报告生成完成，但内容解析可能不完整，请检查并手动调整");
      } else if (!sections.recommendations || !sections.summary) {
        toast.warning("报告生成完成，但教学建议或总结可能缺失，请检查并补充");
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
    generatingRef.current = false;
  }, [selectedStudentId, students, tags, tagRatings, coursePlans, currentStageId, feedbackHistory, setGeneratedReport, generateStream]);

  const handleReviewReport = useCallback(async (promptStageCode?: string) => {
    if (!generatedReport) return;
    if (reviewingRef.current || reviewStream.isStreaming) {
      console.warn("[Review] 已有复检任务进行中，忽略重复请求");
      return;
    }
    reviewingRef.current = true;

    setReviewing(true);
    setShowReviewDialog(true);
    setMetadata(null);

    const student = students.find((s) => s.id === selectedStudentId);
    const theme = themes.find((t) => t.id === selectedThemeId);

    const reviewBody = Object.fromEntries(
      Object.entries({
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
        currentStageId: currentStageId || undefined,
        promptStageCode,
      }).filter(([, v]) => v !== undefined && v !== null)
    );

    const result = await reviewStream.startStream("/api/generate/review", reviewBody);

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
    reviewingRef.current = false;
  }, [generatedReport, students, selectedStudentId, themes, selectedThemeId, tagRatings, tags, currentStageId, setGeneratedReport, reviewStream]);

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
    metadata,
  };
}
