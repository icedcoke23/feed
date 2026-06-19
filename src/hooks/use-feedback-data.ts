"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import type {
  FeedbackStudent,
  TagItem,
  FeedbackTheme,
  FeedbackTeacher,
  FeedbackHistory,
  CourseStagePreset,
} from "@/types/feedback";

export function useFeedbackData() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [students, setStudents] = useState<FeedbackStudent[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [themes, setThemes] = useState<FeedbackTheme[]>([]);
  const [teachers, setTeachers] = useState<FeedbackTeacher[]>([]);
  const [adminTeachers, setAdminTeachers] = useState<FeedbackTeacher[]>([]);
  const [courseStagePresets, setCourseStagePresets] = useState<CourseStagePreset[]>([]);
  const [feedbackHistory, setFeedbackHistory] = useState<FeedbackHistory[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [studentsRes, tagsRes, themesRes, teachersRes, adminTeachersRes, stagesRes] = await Promise.all([
        fetch("/api/students", { credentials: "include" }),
        fetch("/api/tags", { credentials: "include" }),
        fetch("/api/themes", { credentials: "include" }),
        fetch("/api/teachers?role=teacher", { credentials: "include" }),
        fetch("/api/teachers?role=admin", { credentials: "include" }),
        fetch("/api/course-stages", { credentials: "include" }),
      ]);

      // 检查所有响应是否成功
      const responses = [studentsRes, tagsRes, themesRes, teachersRes, adminTeachersRes, stagesRes];
      if (responses.some(r => !r.ok)) {
        const message = "数据加载失败，请刷新页面重试";
        setError(message);
        toast.error(message);
        return;
      }

      const [studentsData, tagsData, themesData, teachersData, adminTeachersData, stagesData] = await Promise.all([
        studentsRes.json(),
        tagsRes.json(),
        themesRes.json(),
        teachersRes.json(),
        adminTeachersRes.json(),
        stagesRes.json(),
      ]);
      setStudents(studentsData.data || []);
      setTags(tagsData.data || []);
      setThemes(themesData.data || []);
      setTeachers(teachersData.data || []);
      setAdminTeachers(adminTeachersData.data || []);
      setCourseStagePresets(stagesData.data || []);
      setError(null);
    } catch (error) {
      console.error("Failed to fetch data:", error);
      const message = "数据加载失败，请刷新页面重试";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFeedbackHistory = useCallback(async (studentId: string) => {
    if (!studentId) {
      console.warn("[History] skipped: empty studentId");
      return;
    }

    // 取消前一次请求
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const url = `/api/feedbacks?studentId=${encodeURIComponent(studentId)}&limit=3`;
      console.log(`[History] fetching: ${url}`);

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
        setError(message);
        toast.error(message);
        setFeedbackHistory([]);
        return;
      }

      const result = await response.json();
      const rawFeedbacks = Array.isArray(result.data) ? result.data : [];
      console.log(`[History] raw count: ${rawFeedbacks.length}`);

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
      setError(null);
      console.log(`[History] mapped count: ${history.length}`);
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      console.error("[History] unexpected error:", error);
      const message = error instanceof Error ? `获取历史记录失败: ${error.message}` : "获取历史记录失败";
      setError(message);
      toast.error(message);
      setFeedbackHistory([]);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
