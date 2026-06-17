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
    // 取消前一次请求
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch(`/api/students/${studentId}/history`, {
        signal: controller.signal,
        credentials: "include",
      });
      if (controller.signal.aborted) return;
      if (!response.ok) {
        const message = "获取历史记录失败";
        setError(message);
        toast.error(message);
        return;
      }
      const data = await response.json();
      setFeedbackHistory(data.data || []);
      setError(null);
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      console.error("Failed to fetch history:", error);
      const message = "获取历史记录失败";
      setError(message);
      toast.error(message);
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
