"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type {
  FeedbackStudent,
  TagItem,
  TagRating,
  FeedbackTeacher,
  CoursePlan,
  StudentPhoto,
  GeneratedReport,
} from "@/types/feedback";

interface UseExportOptions {
  students: FeedbackStudent[];
  tags: TagItem[];
  teachers: FeedbackTeacher[];
  themes: { id: string; name: string }[];
  selectedStudentId: string;
  selectedThemeId: string;
  selectedTeacherId: string;
  selectedAdminTeacherId: string;
  feedbackDate: string;
  tagRatings: Record<string, TagRating>;
  generatedReport: GeneratedReport | null;
  hasCoursePlan: boolean | null;
  coursePlans: CoursePlan[];
  currentStageId: string | null;
  studentPhotos: StudentPhoto[];
}

export function useExport({
  students,
  tags,
  teachers,
  themes,
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
  studentPhotos,
}: UseExportOptions) {
  const router = useRouter();
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async () => {
    if (!generatedReport || !selectedStudentId) return;

    setExporting(true);
    try {
      const student = students.find((s) => s.id === selectedStudentId);
      const theme = themes.find((t) => t.id === selectedThemeId);
      const teacher = teachers.find((t) => t.id === selectedTeacherId);

      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          studentName: student?.name,
          grade: student?.grade,
          className: student?.class_name,
          theme: theme?.name,
          feedbackDate,
          teacherName: teacher?.name,
          strengths: generatedReport.strengths,
          improvements: generatedReport.improvements,
          weaknesses: generatedReport.weaknesses,
          recommendations: generatedReport.recommendations,
          summary: generatedReport.summary,
          tagRatings: Object.entries(tagRatings).map(([tagId, data]) => {
            const tag = tags.find((t) => t.id === tagId);
            return {
              name: tag?.name || tagId.replace(/^custom-/, ""),
              rating: data.rating,
              note: data.note,
            };
          }),
        }),
      });

      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `教学反馈_${student?.name}_${feedbackDate}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Word文档导出成功");
      router.push("/");
    } catch (error) {
      console.error("Failed to export:", error);
      toast.error("导出失败，请重试");
    } finally {
      setExporting(false);
    }
  }, [generatedReport, selectedStudentId, students, themes, selectedThemeId, teachers, selectedTeacherId, feedbackDate, tagRatings, tags, router]);

  const handleExportPDF = useCallback(() => {
    if (!generatedReport || !selectedStudentId) return;

    const student = students.find((s) => s.id === selectedStudentId);
    const theme = themes.find((t) => t.id === selectedThemeId);
    const teacher = teachers.find((t) => t.id === selectedTeacherId);
    const adminTeacher = teachers.find((t) => t.id === selectedAdminTeacherId);

    const reportData = {
      studentId: selectedStudentId,
      teacherId: selectedTeacherId,
      adminTeacherId: selectedAdminTeacherId,
      studentName: student?.name,
      grade: student?.grade,
      className: student?.class_name,
      school: student?.school,
      theme: theme?.name,
      feedbackDate,
      teacherName: teacher?.name,
      teacherPhone: teacher?.phone,
      adminTeacherName: adminTeacher?.name,
      adminTeacherPhone: adminTeacher?.phone,
      campus: student?.school || "",
      strengths: generatedReport.strengths,
      improvements: generatedReport.improvements,
      weaknesses: generatedReport.weaknesses,
      recommendations: generatedReport.recommendations,
      summary: generatedReport.summary,
      tagRatings: Object.entries(tagRatings).map(([tagId, data]) => {
        const tag = tags.find((t) => t.id === tagId);
        return {
          name: tag?.name || tagId.replace(/^custom-/, ""),
          rating: data.rating,
          note: data.note,
        };
      }),
      hasCoursePlan: hasCoursePlan === true && coursePlans.length > 0,
      coursePlans: hasCoursePlan === true ? coursePlans : [],
      currentStageId,
      studentPhotos: studentPhotos.map((p) => ({ id: p.id, url: p.url })),
    };

    const dataString = JSON.stringify(reportData);
    const dataSizeMB = new Blob([dataString]).size / (1024 * 1024);

    if (dataSizeMB > 4) {
      toast.warning(`数据量较大(${dataSizeMB.toFixed(1)}MB)，建议减少照片数量以确保正常导出`);
    }

    try {
      sessionStorage.setItem("pdfReportData", dataString);
    } catch (e) {
      console.error("sessionStorage存储失败:", e);
      toast.error("数据量过大，请减少照片数量后重试");
      return;
    }

    router.push("/feedback/pdf");
  }, [generatedReport, selectedStudentId, students, themes, selectedThemeId, teachers, selectedTeacherId, selectedAdminTeacherId, feedbackDate, tagRatings, tags, hasCoursePlan, coursePlans, currentStageId, studentPhotos]);

  return {
    exporting,
    handleExport,
    handleExportPDF,
  };
}
