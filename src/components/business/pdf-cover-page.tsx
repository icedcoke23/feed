"use client";

import React, { useState, useRef, useEffect } from "react";
import { Pencil } from "lucide-react";
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
  onFieldChange?: (field: string, value: string) => void;
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

// 智能分析：处理校区/学校显示，统一显示为“校区”
function getSchoolDisplay(reportData: ReportData): { label: string; value: string } {
  const campus = reportData?.campus;
  const school = reportData?.school;
  const value =
    (campus && campus.trim() !== "" && campus !== "-"
      ? campus
      : school && school.trim() !== "" && school !== "-"
        ? school
        : "南沙万达校区");
  return { label: "校区", value };
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

// 可编辑表格单元格组件（单行文本，点击变为输入框，失焦或回车保存）
function EditableCell({
  field,
  value,
  suffix,
  editingField,
  editValue,
  onEditValueChange,
  onStartEditing,
  onSaveEdit,
  onCancelEdit,
}: {
  field: string;
  value: string;
  suffix?: string;
  editingField: string | null;
  editValue: string;
  onEditValueChange: (value: string) => void;
  onStartEditing: (field: string, value: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
}) {
  const isEditing = editingField === field;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSaveEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancelEdit();
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        value={editValue}
        onChange={e => onEditValueChange(e.target.value)}
        onBlur={onSaveEdit}
        onKeyDown={handleKeyDown}
        className="w-full px-1 py-0 border border-blue-400 rounded text-base text-center focus:outline-none focus:ring-1 focus:ring-blue-300 print:hidden"
      />
    );
  }

  return (
    <span className="inline-flex items-center group">
      <span className="truncate">{value || "-"}{suffix}</span>
      <button
        onClick={() => onStartEditing(field, value === "-" ? "" : value)}
        className="print:hidden opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-blue-500 ml-1 p-0.5"
        title="编辑"
      >
        <Pencil className="h-3 w-3" />
      </button>
    </span>
  );
}

export function PdfCoverPage({ reportData, pageStyle, onFieldChange }: PdfCoverPageProps) {
  // 封面页本地编辑状态
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

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

  const startEditing = (field: string, value: string) => {
    setEditingField(field);
    setEditValue(value);
  };

  const saveEdit = () => {
    if (!editingField) return;
    onFieldChange?.(editingField, editValue);
    setEditingField(null);
    setEditValue("");
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue("");
  };

  return (
    <div
      className="bg-white shadow-xl print:shadow-none overflow-hidden print:break-after-page relative"
      style={pageStyle}
    >
      <div style={coverContentStyle} className="flex flex-col">
        {/* Logo区域 - 宽度与纸张一致，下移5% */}
        {LOGO_URL && (
        <div className="flex items-center justify-center" style={{ marginTop: '5%' }}>
          {/* Logo URL 为可配置的外部/动态地址，用于 PDF/打印，无法使用 Next.js Image */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
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
                <td className="border border-gray-400 px-2 text-base text-center w-[19%] whitespace-nowrap">
                  <EditableCell
                    field="studentName"
                    value={reportData.studentName || ""}
                    editingField={editingField}
                    editValue={editValue}
                    onEditValueChange={setEditValue}
                    onStartEditing={startEditing}
                    onSaveEdit={saveEdit}
                    onCancelEdit={cancelEdit}
                  />
                </td>
                <td className="border border-gray-400 px-2 bg-gray-100 font-bold text-base text-center w-[14%] whitespace-nowrap">{gradeDisplay.label}</td>
                <td className="border border-gray-400 px-2 text-base text-center w-[19%] whitespace-nowrap">
                  <EditableCell
                    field="grade"
                    value={gradeDisplay.value}
                    editingField={editingField}
                    editValue={editValue}
                    onEditValueChange={setEditValue}
                    onStartEditing={startEditing}
                    onSaveEdit={saveEdit}
                    onCancelEdit={cancelEdit}
                  />
                </td>
                <td className="border border-gray-400 px-2 bg-gray-100 font-bold text-base text-center w-[14%] whitespace-nowrap">{schoolDisplay.label}</td>
                <td className="border border-gray-400 px-2 text-base text-center w-[20%] whitespace-nowrap">
                  <EditableCell
                    field="school"
                    value={schoolDisplay.value}
                    editingField={editingField}
                    editValue={editValue}
                    onEditValueChange={setEditValue}
                    onStartEditing={startEditing}
                    onSaveEdit={saveEdit}
                    onCancelEdit={cancelEdit}
                  />
                </td>
              </tr>
              <tr className="h-14">
                <td className="border border-gray-400 px-2 bg-gray-100 font-bold text-base text-center whitespace-nowrap">讲师</td>
                <td className="border border-gray-400 px-2 text-base text-center whitespace-nowrap" colSpan={2}>
                  <EditableCell
                    field="teacherName"
                    value={reportData.teacherName || ""}
                    suffix={reportData.teacherPhone ? `(${reportData.teacherPhone})` : undefined}
                    editingField={editingField}
                    editValue={editValue}
                    onEditValueChange={setEditValue}
                    onStartEditing={startEditing}
                    onSaveEdit={saveEdit}
                    onCancelEdit={cancelEdit}
                  />
                </td>
                <td className="border border-gray-400 px-2 bg-gray-100 font-bold text-base text-center whitespace-nowrap">教务老师</td>
                <td className="border border-gray-400 px-2 text-base text-center whitespace-nowrap" colSpan={2}>
                  <EditableCell
                    field="adminTeacherName"
                    value={reportData.adminTeacherName || ""}
                    suffix={reportData.adminTeacherPhone ? `(${reportData.adminTeacherPhone})` : undefined}
                    editingField={editingField}
                    editValue={editValue}
                    onEditValueChange={setEditValue}
                    onStartEditing={startEditing}
                    onSaveEdit={saveEdit}
                    onCancelEdit={cancelEdit}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
