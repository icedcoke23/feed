"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import type {
  FeedbackStudent,
  TagItem,
  FeedbackTheme,
  FeedbackTeacher,
  FeedbackHistory,
  CourseStagePreset,
} from "@/types/feedback";
import {
  fetcher,
  STUDENTS_KEY,
  TAGS_KEY,
  THEMES_KEY,
  TEACHERS_ROLE_KEY,
  ADMIN_TEACHERS_KEY,
  COURSE_STAGES_KEY,
} from "@/lib/swr";

export function useFeedbackData() {
  // 用 SWR 获取 6 个数据源，跨组件自动去重（与 use-settings-data 共享缓存）
  const {
    data: studentsData,
    isLoading: studentsLoading,
    error: studentsError,
    mutate: mutateStudents,
  } = useSWR<FeedbackStudent[]>(STUDENTS_KEY, fetcher);
  const { data: tagsData, isLoading: tagsLoading, error: tagsError, mutate: mutateTags } =
    useSWR<TagItem[]>(TAGS_KEY, fetcher);
  const { data: themesData, isLoading: themesLoading, error: themesError } =
    useSWR<FeedbackTheme[]>(THEMES_KEY, fetcher);
  const { data: teachersData, isLoading: teachersLoading, error: teachersError } =
    useSWR<FeedbackTeacher[]>(TEACHERS_ROLE_KEY, fetcher);
  const {
    data: adminTeachersData,
    isLoading: adminTeachersLoading,
    error: adminTeachersError,
  } = useSWR<FeedbackTeacher[]>(ADMIN_TEACHERS_KEY, fetcher);
  const { data: stagesData, isLoading: stagesLoading, error: stagesError } =
    useSWR<CourseStagePreset[]>(COURSE_STAGES_KEY, fetcher);

  const students = studentsData ?? [];
  const tags = tagsData ?? [];
  const themes = themesData ?? [];
  const teachers = teachersData ?? [];
  const adminTeachers = adminTeachersData ?? [];
  const courseStagePresets = stagesData ?? [];

  const loading =
    studentsLoading ||
    tagsLoading ||
    themesLoading ||
    teachersLoading ||
    adminTeachersLoading ||
    stagesLoading;

  const firstError =
    studentsError ||
    tagsError ||
    themesError ||
    teachersError ||
    adminTeachersError ||
    stagesError;
  const error = firstError ? "数据加载失败，请刷新页面重试" : null;

  // 错误提示（去重，避免 SWR 重试时多次 toast）
  const errorToastedRef = useRef(false);
  useEffect(() => {
    if (firstError && !errorToastedRef.current) {
      toast.error("数据加载失败，请刷新页面重试");
      errorToastedRef.current = true;
    }
    if (!firstError) {
      errorToastedRef.current = false;
    }
  }, [firstError]);

  // 包装 SWR mutate 为 React.Dispatch 签名，保持调用方兼容
  // （use-feedback-form 的 setTags((prev) => [...prev, savedTag.data]) 依赖此签名）
  const setStudents = useCallback<React.Dispatch<React.SetStateAction<FeedbackStudent[]>>>(
    (updater) => {
      mutateStudents(
        (prev) => {
          const current = prev ?? [];
          return typeof updater === "function" ? updater(current) : updater;
        },
        { revalidate: false }
      );
    },
    [mutateStudents]
  );

  const setTags = useCallback<React.Dispatch<React.SetStateAction<TagItem[]>>>(
    (updater) => {
      mutateTags(
        (prev) => {
          const current = prev ?? [];
          return typeof updater === "function" ? updater(current) : updater;
        },
        { revalidate: false }
      );
    },
    [mutateTags]
  );

  // 历史记录：手动 fetch（含 AbortController + 复杂 mapping，不适合 SWR）
  const [feedbackHistory, setFeedbackHistory] = useState<FeedbackHistory[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchFeedbackHistory = useCallback(async (studentId: string) => {
    if (!studentId) return;

    // 取消前一次请求
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const url = `/api/feedbacks?studentId=${encodeURIComponent(studentId)}&limit=3`;

      const response = await fetch(url, {
        signal: controller.signal,
        credentials: "include",
      });
      if (controller.signal.aborted) return;

      if (!response.ok) {
        let errorText = response.statusText;
        try {
          const errorJson = await response.json();
          errorText = errorJson.error || errorJson.message || JSON.stringify(errorJson);
        } catch {
          errorText = await response.text().catch(() => response.statusText);
        }
        const message = `获取历史记录失败 (${response.status}): ${errorText}`;
        console.error("[History] request failed:", response.status, errorText);
        toast.error(message);
        setFeedbackHistory([]);
        return;
      }

      const result = await response.json();
      const rawFeedbacks = Array.isArray(result.data) ? result.data : [];

      const history: FeedbackHistory[] = rawFeedbacks.map((fb: Record<string, unknown>) => {
        const metadata =
          fb.metadata && typeof fb.metadata === "object" && !Array.isArray(fb.metadata)
            ? (fb.metadata as Record<string, unknown>)
            : {};

        const tagRatingsDetail = Array.isArray(metadata.tag_ratings_detail)
          ? metadata.tag_ratings_detail
          : [];
        const legacyTags = Array.isArray(metadata.tags) ? metadata.tags : [];
        const ratingItems = tagRatingsDetail.length > 0 ? tagRatingsDetail : legacyTags;
        const ratings = ratingItems
          .map((t: { rating?: number }) => t.rating)
          .filter((r): r is number => typeof r === "number" && r > 0);
        const overallRating =
          ratings.length > 0
            ? Math.round((ratings.reduce((sum, r) => sum + r, 0) / ratings.length) * 10) / 10
            : null;

        const extractTagNames = (arr: unknown) =>
          Array.isArray(arr)
            ? arr
                .map(
                  (item: { tag?: string; name?: string; content?: string }) =>
                    item?.tag || item?.name || item?.content || ""
                )
                .filter(Boolean)
            : [];

        return {
          id: (fb.id as string) || "",
          feedback_date:
            (fb.created_at as string) || (metadata.feedback_date as string) || new Date().toISOString(),
          teaching_theme: (metadata.theme as string) || "教学反馈",
          overall_rating: overallRating as number,
          strengths: extractTagNames(fb.strengths),
          areas_for_improvement: extractTagNames(fb.weaknesses),
        };
      });

      setFeedbackHistory(history);
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      console.error("[History] unexpected error:", error);
      const message = error instanceof Error ? `获取历史记录失败: ${error.message}` : "获取历史记录失败";
      toast.error(message);
      setFeedbackHistory([]);
    }
  }, []);

  return {
    loading,
    error,
    students,
    setStudents,
    tags,
    setTags,
    themes,
    teachers,
    adminTeachers,
    courseStagePresets,
    feedbackHistory,
    setFeedbackHistory,
    fetchFeedbackHistory,
  };
}
