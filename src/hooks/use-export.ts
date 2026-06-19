"use client";

import { useCallback } from "react";
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
  adminTeachers: FeedbackTeacher[];
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
  adminTeachers,
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
  const handleExport = useCallback(() => {
    if (!generatedReport || !selectedStudentId) return;

    const student = students.find((s) => s.id === selectedStudentId);
    const theme = themes.find((t) => t.id === selectedThemeId);

    // 查找教师：先按 selectedTeacherId 在两个数组中查找，若未找到则从学员数据回退
    let teacher = teachers.find((t) => t.id === selectedTeacherId) || adminTeachers.find((t) => t.id === selectedTeacherId);
    if (!teacher && student) {
      const fallbackTeacherId = student.class?.teacher_id || student.admin_teacher?.id;
      if (fallbackTeacherId) {
        teacher = teachers.find((t) => t.id === fallbackTeacherId) || adminTeachers.find((t) => t.id === fallbackTeacherId);
      }
    }

    // 查找教务教师：先按 selectedAdminTeacherId 在两个数组中查找，若未找到则从学员数据回退
    let adminTeacher = adminTeachers.find((t) => t.id === selectedAdminTeacherId) || teachers.find((t) => t.id === selectedAdminTeacherId);
    if (!adminTeacher && student) {
      const fallbackAdminId = student.admin_teacher?.id;
      if (fallbackAdminId) {
        adminTeacher = adminTeachers.find((t) => t.id === fallbackAdminId) || teachers.find((t) => t.id === fallbackAdminId);
      }
    }

    // 当电话号码缺失时发出警告
    if (teacher && !teacher.phone) {
      console.warn(`[useExport] 教师 ${teacher.name}(${teacher.id}) 缺少电话号码`);
    }
    if (adminTeacher && !adminTeacher.phone) {
      console.warn(`[useExport] 教务 ${adminTeacher.name}(${adminTeacher.id}) 缺少电话号码`);
    }
    if (!teacher) {
      console.warn(`[useExport] 未找到教师(selectedTeacherId=${selectedTeacherId})，学员数据回退也未命中`);
    }
    if (!adminTeacher) {
      console.warn(`[useExport] 未找到教务教师(selectedAdminTeacherId=${selectedAdminTeacherId})，学员数据回退也未命中`);
    }

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
      campus: student?.school || "南沙万达校区",
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

    if (dataSizeMB > 3) {
      toast.warning(`数据量较大(${dataSizeMB.toFixed(1)}MB)，建议减少至3张照片以内以确保正常导出`);
    }

    try {
      localStorage.setItem("pdfReportData", dataString);
    } catch (e) {
      console.error("localStorage存储失败:", e);
      toast.error("数据量过大，请减少照片数量后重试");
      return;
    }

    window.open("/feedback/pdf", "_blank");
  }, [generatedReport, selectedStudentId, students, themes, selectedThemeId, teachers, adminTeachers, selectedTeacherId, selectedAdminTeacherId, feedbackDate, tagRatings, tags, hasCoursePlan, coursePlans, currentStageId, studentPhotos]);

  return {
    handleExport,
  };
}
