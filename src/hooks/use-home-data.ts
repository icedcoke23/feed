"use client";

/* eslint-disable react-hooks/refs */

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import useSWRInfinite from "swr/infinite";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { fetcher, HOME_DATA_KEY } from "@/lib/swr";
import type { HomeDataResponse } from "@/types/home";

export function useHomeData() {
  const { user, isLoading: authLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("all");
  const [manualExpanded, setManualExpanded] = useState<Record<string, boolean>>({});
  const initializedRef = useRef(false);

  const getKey = useCallback(
    (pageIndex: number) => {
      if (!user) return null;
      return `${HOME_DATA_KEY}?page=${pageIndex + 1}&limit=50`;
    },
    [user]
  );

  const { data, error, isLoading, size, setSize, mutate } = useSWRInfinite<HomeDataResponse>(
    getKey,
    fetcher,
    { revalidateOnFocus: false }
  );

  const students = useMemo(() => (data ? data.flatMap((page) => page.students) : []), [data]);
  const classes = useMemo(() => data?.[0]?.classes || [], [data]);
  const teachers = useMemo(() => data?.[0]?.teachers || [], [data]);
  const adminTeachers = useMemo(() => data?.[0]?.adminTeachers || [], [data]);
  const studentsPagination = useMemo(() => data?.[data.length - 1]?.studentsPagination || null, [data]);

  // 搜索输入防抖（300ms）
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 默认展开所有班级（仅在首次获取到班级时执行）
  const expandedClasses = useMemo(() => {
    if (classes.length > 0 && !initializedRef.current) {
      initializedRef.current = true;
      const initial: Record<string, boolean> = {};
      classes.forEach((cls) => {
        initial[cls.id] = true;
      });
      return initial;
    }
    return manualExpanded;
  }, [classes, manualExpanded]);

  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const matchesSearch =
        student.name.includes(debouncedSearchQuery) ||
        student.current_class?.includes(debouncedSearchQuery) ||
        student.classes?.some((c) => c.name?.includes(debouncedSearchQuery)) ||
        student.grade?.includes(debouncedSearchQuery);
      const matchesTeacher =
        teacherFilter === "all" ||
        student.classes?.some((c) => c.teacher_id === teacherFilter) ||
        student.class?.teacher_id === teacherFilter ||
        student.current_teacher_id === teacherFilter;
      return matchesSearch && matchesTeacher;
    });
  }, [students, debouncedSearchQuery, teacherFilter]);

  const stats = useMemo(() => {
    const now = new Date();
    return {
      total: students.length,
      thisMonth: students.filter((s) => {
        const createdDate = new Date(s.created_at);
        return createdDate.getMonth() === now.getMonth() && createdDate.getFullYear() === now.getFullYear();
      }).length,
      classes: classes.length,
    };
  }, [students, classes]);

  const teachersFromClasses = useMemo(() => {
    return [
      ...new Map(
        classes
          .filter((cls) => cls.teacher)
          .map((cls) => [cls.teacher!.id, cls.teacher!])
      ).values(),
    ];
  }, [classes]);

  const toggleClassExpand = (classId: string) => {
    setManualExpanded((prev) => {
      initializedRef.current = true;
      return { ...prev, [classId]: !prev[classId] };
    });
  };

  const expandAllClasses = (expand: boolean) => {
    initializedRef.current = true;
    const newState: Record<string, boolean> = {};
    classes.forEach((cls) => {
      newState[cls.id] = expand;
    });
    newState["temp"] = expand;
    setManualExpanded(newState);
  };

  const fetchData = useCallback(async () => {
    await mutate();
  }, [mutate]);

  const loadMoreStudents = useCallback(() => {
    if (studentsPagination && size < studentsPagination.totalPages) {
      setSize((s) => s + 1);
    }
  }, [studentsPagination, size, setSize]);

  const hasMoreStudents = studentsPagination ? size < studentsPagination.totalPages : false;

  useEffect(() => {
    if (error) {
      console.error("Failed to fetch home data:", error);
      toast.error(error.message || "数据加载失败，请刷新页面重试");
    }
  }, [error]);

  return {
    user,
    authLoading,
    students,
    classes,
    teachers,
    adminTeachers,
    loading: authLoading || isLoading,
    error: error?.message || null,
    searchQuery,
    setSearchQuery,
    teacherFilter,
    setTeacherFilter,
    expandedClasses,
    toggleClassExpand,
    expandAllClasses,
    teachersFromClasses,
    filteredStudents,
    stats,
    fetchData,
    loadingMore: isLoading && size > 1,
    hasMoreStudents,
    loadMoreStudents,
    studentsPagination,
  };
}
