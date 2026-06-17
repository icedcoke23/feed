"use client";

import React from "react";
import type { ReportData } from "@/types/feedback";

// 页面配置常量
const COVER_PADDING_TOP = 50; // mm
const COVER_PADDING_BOTTOM = 25; // mm
const CONTENT_PADDING_LEFT = 15; // mm
const CONTENT_PADDING_RIGHT = 15; // mm

// Logo图片URL（可通过环境变量 NEXT_PUBLIC_LOGO_URL 覆盖）
const LOGO_URL = process.env.NEXT_PUBLIC_LOGO_URL || "/images/logo.png";

export interface PdfCoverPageProps {
  reportData: ReportData;
  pageStyle: React.CSSProperties;
}

// 智能分析：获取当前阶段名称
function getCurrentStageName(reportData: ReportData): string {
  if (!reportData?.coursePlans || reportData.coursePlans.length === 0) {
    return "";
  }

  // 优先查找标记为current的阶段
  const currentPlan = reportData.coursePlans.find(p => p.status === 'current' || p.id === reportData.currentStageId);
  if (currentPlan) {
    return currentPlan.theme || currentPlan.stage || "";
  }

  // 如果没有当前阶段，查找第一个有theme或stage的计划
  const planWithName = reportData.coursePlans.find(p => p.theme || p.stage);
  if (planWithName) {
    return planWithName.theme || planWithName.stage || "";
  }

  return "";
}

// 智能分析：处理学校显示
function getSchoolDisplay(reportData: ReportData): { label: string; value: string } {
  const school = reportData?.school;
  if (!school || school === "-" || school.trim() === "") {
    return { label: "校区", value: "" };
  }
  return { label: "学校", value: school };
}

// 智能分析：处理年级/阶段显示
function getGradeDisplay(reportData: ReportData): { label: string; value: string } {
  const grade = reportData?.grade;
  if (!grade || grade === "-" || grade.trim() === "") {
    const stageName = getCurrentStageName(reportData);
    return { label: "阶段", value: stageName || "-" };
  }
  return { label: "年级", value: grade };
}

export function PdfCoverPage({ reportData, pageStyle }: PdfCoverPageProps) {
  const coverContentStyle: React.CSSProperties = {
    position: "absolute",
    top: `${COVER_PADDING_TOP}mm`,
    bottom: `${COVER_PADDING_BOTTOM}mm`,
    left: `${CONTENT_PADDING_LEFT}mm`,
    right: `${CONTENT_PADDING_RIGHT}mm`,
    overflow: "hidden",
  };

  const schoolDisplay = getSchoolDisplay(reportData);
  const gradeDisplay = getGradeDisplay(reportData);

  return (
    <div
      className="bg-white shadow-xl print:shadow-none overflow-hidden print:break-after-page relative"
      style={pageStyle}
    >
      <div style={coverContentStyle} className="flex flex-col">
        {/* Logo区域 - 宽度与纸张一致，下移5% */}
        {LOGO_URL && (
        <div className="flex items-center justify-center" style={{ marginTop: '5%' }}>
          <img
            src={LOGO_URL}
            alt="Logo"
            className="w-full h-auto object-contain px-4"
          />
        </div>
        )}

        {/* 标题区 */}
        <div className="text-center py-10 flex-1 flex flex-col justify-center">
          <h1 className="text-5xl font-bold text-gray-800 mb-4 tracking-wide">个性化教学工作反馈</h1>
          <h2 className="text-4xl text-gray-600 mb-8">教学方案</h2>
          <p className="text-2xl text-gray-500 font-medium">{reportData.campus || ""}教学部门</p>
        </div>

        {/* 基本信息表格 - 两行结构 */}
        <div className="mt-auto">
          <table className="w-full border-collapse border-2 border-gray-400">
            <tbody>
              <tr className="h-14">
                <td className="border border-gray-400 px-2 bg-gray-100 font-bold text-base text-center w-[14%] whitespace-nowrap">学员姓名</td>
                <td className="border border-gray-400 px-2 text-base text-center w-[19%] whitespace-nowrap truncate">{reportData.studentName}</td>
                <td className="border border-gray-400 px-2 bg-gray-100 font-bold text-base text-center w-[14%] whitespace-nowrap">{gradeDisplay.label}</td>
                <td className="border border-gray-400 px-2 text-base text-center w-[19%] whitespace-nowrap">{gradeDisplay.value}</td>
                <td className="border border-gray-400 px-2 bg-gray-100 font-bold text-base text-center w-[14%] whitespace-nowrap">{schoolDisplay.label}</td>
                <td className="border border-gray-400 px-2 text-base text-center w-[20%] whitespace-nowrap truncate">{schoolDisplay.value}</td>
              </tr>
              <tr className="h-14">
                <td className="border border-gray-400 px-2 bg-gray-100 font-bold text-base text-center whitespace-nowrap">讲师</td>
                <td className="border border-gray-400 px-2 text-base text-center whitespace-nowrap" colSpan={2}>
                  <span>{reportData.teacherName || "-"}</span>
                  {reportData.teacherPhone && <span className="text-gray-500 text-sm ml-1">({reportData.teacherPhone})</span>}
                </td>
                <td className="border border-gray-400 px-2 bg-gray-100 font-bold text-base text-center whitespace-nowrap">教务老师</td>
                <td className="border border-gray-400 px-2 text-base text-center whitespace-nowrap" colSpan={2}>
                  <span>{reportData.adminTeacherName || "-"}</span>
                  {reportData.adminTeacherPhone && <span className="text-gray-500 text-sm ml-1">({reportData.adminTeacherPhone})</span>}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
