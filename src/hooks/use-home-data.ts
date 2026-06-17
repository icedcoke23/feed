"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import type { Student, ClassItem, Teacher } from "@/types/home";

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function useHomeData() {
  const { user, isLoading: authLoading } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [adminTeachers, setAdminTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("all");
  const [expandedClasses, setExpandedClasses] = useState<Record<string, boolean>>({});

  // 分页状态
  const [studentsPage, setStudentsPage] = useState(1);
  const [studentsPagination, setStudentsPagination] = useState<PaginationMeta | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchData = useCallback(async (page = 1, append = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    try {
      // 优先使用聚合 API
      try {
        const res = await fetch(`/api/home-data?page=${page}&limit=50`, { credentials: "include" });
        if (!res.ok) throw new Error("聚合 API 失败");

        const result = await res.json();
        const newStudents = result.data?.students || [];
        const pagination = result.data?.studentsPagination || null;

        if (append) {
          setStudents(prev => [...prev, ...newStudents]);
        } else {
          setStudents(newStudents);
        }
        setStudentsPagination(pagination);
        setStudentsPage(page);
        setClasses(result.data?.classes || []);
        setTeachers(result.data?.teachers || []);
        setAdminTeachers(result.data?.adminTeachers || []);
        setError(null);
      } catch (aggregateError) {
        // 聚合 API 失败，fallback 到原有请求
        console.warn("聚合 API 失败，回退到独立请求:", aggregateError);
        const [studentsRes, classesRes, teachersRes, adminTeachersRes] = await Promise.all([
          fetch(`/api/students?page=${page}&limit=50`, { credentials: "include" }),
          fetch("/api/classes", { credentials: "include" }),
          fetch("/api/teachers", { credentials: "include" }),
          fetch("/api/teachers?role=admin", { credentials: "include" }),
        ]);
        // 检查响应状态
        if (!studentsRes.ok || !classesRes.ok || !teachersRes.ok || !adminTeachersRes.ok) {
          throw new Error("数据加载失败");
        }

        const [studentsData, classesData, teachersData, adminTeachersData] = await Promise.all([
          studentsRes.json(),
          classesRes.json(),
          teachersRes.json(),
          adminTeachersRes.json(),
        ]);

        // 处理分页响应格式
        const newStudents = studentsData.data || [];
        const pagination = studentsData.pagination || null;

        if (append) {
          setStudents(prev => [...prev, ...newStudents]);
        } else {
          setStudents(newStudents);
        }
        setStudentsPagination(pagination);
        setStudentsPage(page);
        setClasses(classesData.data || []);
        setTeachers(teachersData.data || []);
        setAdminTeachers(adminTeachersData.data || []);
        setError(null);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
      const message = "数据加载失败，请刷新页面重试";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [user]);

  const loadMoreStudents = useCallback(() => {
    if (studentsPagination && studentsPage < studentsPagination.totalPages) {
      fetchData(studentsPage + 1, true);
    }
  }, [studentsPagination, studentsPage, fetchData]);

  const hasMoreStudents = studentsPagination
    ? studentsPage < studentsPagination.totalPages
    : false;

  useEffect(() => {
    if (!authLoading && user) {
      fetchData();
    }
  }, [authLoading, user, fetchData]);

  // 新获取到班级时，默认全部展开
  useEffect(() => {
    if (classes.length > 0 && Object.keys(expandedClasses).length === 0) {
      const initial: Record<string, boolean> = {};
      classes.forEach(cls => { initial[cls.id] = true; });
      setExpandedClasses(initial);
    }
  }, [classes]);

  const teachersFromClasses = useMemo(() => {
    return [...new Map(
      classes
        .filter(cls => cls.teacher)
        .map(cls => [cls.teacher!.id, cls.teacher!])
    ).values()];
  }, [classes]);

  // 搜索输入防抖（300ms）
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const matchesSearch =
        student.name.includes(debouncedSearchQuery) ||
        student.current_class?.includes(debouncedSearchQuery) ||
        student.classes?.some(c => c.name?.includes(debouncedSearchQuery)) ||
        student.grade?.includes(debouncedSearchQuery);
      const matchesTeacher = teacherFilter === "all" ||
        student.classes?.some(c => c.teacher_id === teacherFilter) ||
        student.class?.teacher_id === teacherFilter ||
        student.current_teacher_id === teacherFilter;
      return matchesSearch && matchesTeacher;
    });
  }, [students, debouncedSearchQuery, teacherFilter]);

  const stats = useMemo(() => {
    return {
      total: students.length,
      thisMonth: students.filter(
        (s) => {
          const createdDate = new Date(s.created_at);
          const now = new Date();
          return createdDate.getMonth() === now.getMonth() && createdDate.getFullYear() === now.getFullYear();
        }
      ).length,
      classes: classes.length,
    };
  }, [students, classes]);

  const toggleClassExpand = (classId: string) => {
    setExpandedClasses(prev => ({
      ...prev,
      [classId]: !prev[classId]
    }));
  };

  const expandAllClasses = (expand: boolean) => {
    const newState: Record<string, boolean> = {};
    classes.forEach(cls => {
      newState[cls.id] = expand;
    });
    newState['temp'] = expand;
    setExpandedClasses(newState);
  };

  return {
    user,
    authLoading,
    students,
    classes,
    teachers,
    adminTeachers,
    loading,
    error,
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
    loadingMore,
    hasMoreStudents,
    loadMoreStudents,
    studentsPagination,
  };
}
