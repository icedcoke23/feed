"use client";

import React, { useState, useRef, useEffect } from "react";
import { Pencil, Check, Camera } from "lucide-react";
import type { ReportData, CoursePlan } from "@/types/feedback";
import { FreeLayoutPhotoEditor } from "@/components/business/free-layout-photo-editor";

// 内容页padding常量（含安全区：背景图占用顶部/底部空间）
const CONTENT_PADDING_TOP = 30; // mm（安全区，原20mm）
const CONTENT_PADDING_BOTTOM = 20; // mm（安全区，原12mm）
const CONTENT_PADDING_LEFT = 15; // mm
const CONTENT_PADDING_RIGHT = 15; // mm

// 分页数据类型
export interface AnalysisPageData {
  strengths?: string;
  improvements?: string;
  weaknesses?: string;
  showTitle?: boolean;
  isContinuation?: boolean;
  strengthsLabel?: string;
  improvementsLabel?: string;
  weaknessesLabel?: string;
}

export interface CoursePlanPageData {
  plans: CoursePlan[];
  isFirstPage: boolean;
  pageNum: number;
  totalPages: number;
}

export interface RecommendationPageData {
  content: string;
  summary?: string;
  isFirstPage: boolean;
  pageNum: number;
  totalPages: number;
  isLastPage: boolean;
}

export interface PdfAnalysisPageProps {
  reportData: ReportData;
  analysisPages: AnalysisPageData[];
  coursePlanPages: CoursePlanPageData[];
  recommendationPages: RecommendationPageData[];
  pageStyle: React.CSSProperties;
  editingField: string | null;
  editValue: string;
  onEditValueChange: (value: string) => void;
  onStartEditing: (field: string, value: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onPhotoEdit: (photoId: string, newUrl: string) => void;
  onPhotoDelete: (photoId: string) => void;
  onPhotoReplace: (photoId: string, e: React.ChangeEvent<HTMLInputElement>) => void;
  onPhotoCrop?: (photoId: string, photoUrl: string) => void;
  onOpenPhotoEditor: () => void;
  onCoursePlanChange?: (planId: string, field: string, value: string) => void;
}

// 格式化正文内容：段落之间用单个换行分隔，每段开始缩进两字符
function formatContent(text: string): string {
  if (!text) return "";
  const paragraphs = text.split("\n");
  return paragraphs
    .filter(p => p.trim())
    .map(p => `　　${p.trim()}`)
    .join("\n");
}

// 内容页区域样式
const contentStyle: React.CSSProperties = {
  position: "absolute",
  top: `${CONTENT_PADDING_TOP}mm`,
  bottom: `${CONTENT_PADDING_BOTTOM}mm`,
  left: `${CONTENT_PADDING_LEFT}mm`,
  right: `${CONTENT_PADDING_RIGHT}mm`,
  overflow: "hidden",
};

// 最后一页内容区域样式（允许溢出以显示照片区域）
const lastPageContentStyle: React.CSSProperties = {
  position: "absolute",
  top: `${CONTENT_PADDING_TOP}mm`,
  bottom: `${CONTENT_PADDING_BOTTOM}mm`,
  left: `${CONTENT_PADDING_LEFT}mm`,
  right: `${CONTENT_PADDING_RIGHT}mm`,
  overflow: "visible",
};

// 就地编辑区块组件
function EditableBlock({
  field,
  label,
  colorClass,
  borderColorClass,
  content,
  editingField,
  editValue,
  onEditValueChange,
  onStartEditing,
  onSaveEdit,
  onCancelEdit,
  isFirstPage,
}: {
  field: string;
  label: string;
  colorClass: string;
  borderColorClass: string;
  content: string;
  editingField: string | null;
  editValue: string;
  onEditValueChange: (value: string) => void;
  onStartEditing: (field: string, value: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  isFirstPage: boolean;
}) {
  const isEditing = editingField === field && isFirstPage;

  return (
    <div className="mb-3 print:relative">
      <div className={`${colorClass} p-4 rounded-lg border-l-4 ${borderColorClass} relative group ${isEditing ? 'ring-2 ring-blue-400' : ''}`}>
        <div className="flex justify-between items-center mb-1">
          <h4 className={`font-bold text-base ${borderColorClass.replace('border-', 'text-').replace('-500', '-700')}`}>{label}</h4>
          {editingField !== field && isFirstPage && (
            <button onClick={() => onStartEditing(field, content)} className="print:hidden opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-blue-500 p-1" title="编辑">
              <Pencil className="h-4 w-4" />
            </button>
          )}
        </div>
        {isEditing ? (
          <div className="print:hidden">
            <textarea value={editValue} onChange={e => onEditValueChange(e.target.value)} className="w-full h-40 text-base p-2 border rounded resize-y" />
            <div className="flex gap-2 mt-2">
              <button onClick={onSaveEdit} className="flex items-center gap-1 px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"><Check className="h-3.5 w-3.5" />完成</button>
              <button onClick={onCancelEdit} className="px-3 py-1 bg-gray-200 text-gray-600 rounded text-sm hover:bg-gray-300">取消</button>
            </div>
          </div>
        ) : (
          <div className="text-base text-gray-700 whitespace-pre-wrap leading-relaxed">
            {formatContent(content)}
          </div>
        )}
      </div>
    </div>
  );
}

// 可编辑课程规划单元格组件（支持单行/多行，点击变为输入框，失焦或回车保存）
function EditableCoursePlanCell({
  planId,
  field,
  value,
  editingCell,
  editValue,
  onEditValueChange,
  onStartEditing,
  onSaveEdit,
  onCancelEdit,
  multiline = false,
}: {
  planId: string;
  field: string;
  value: string;
  editingCell: string | null;
  editValue: string;
  onEditValueChange: (value: string) => void;
  onStartEditing: (cellId: string, value: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  multiline?: boolean;
}) {
  const cellId = `${planId}.${field}`;
  const isEditing = editingCell === cellId;
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current instanceof HTMLInputElement) {
        inputRef.current.select();
      }
    }
  }, [isEditing]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline) {
      e.preventDefault();
      onSaveEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancelEdit();
    }
  };

  if (isEditing) {
    if (multiline) {
      return (
        <div className="print:hidden">
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={editValue}
            onChange={e => onEditValueChange(e.target.value)}
            onBlur={onSaveEdit}
            onKeyDown={handleKeyDown}
            className="w-full px-1 py-0 border border-blue-400 rounded text-base focus:outline-none focus:ring-1 focus:ring-blue-300 resize-y min-h-[60px]"
          />
          <div className="text-xs text-gray-400 mt-1">Esc 取消 · 失焦保存</div>
        </div>
      );
    }
    return (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        value={editValue}
        onChange={e => onEditValueChange(e.target.value)}
        onBlur={onSaveEdit}
        onKeyDown={handleKeyDown}
        className="w-full px-1 py-0 border border-blue-400 rounded text-base focus:outline-none focus:ring-1 focus:ring-blue-300"
      />
    );
  }

  return (
    <div className="group">
      <div className="flex items-start">
        <span className={multiline ? "whitespace-pre-wrap flex-1" : "flex-1"}>{value || "-"}</span>
        <button
          onClick={() => onStartEditing(cellId, value || "")}
          className="print:hidden opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-blue-500 ml-1 p-0.5 flex-shrink-0"
          title="编辑"
        >
          <Pencil className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

export function PdfAnalysisPage({
  reportData,
  analysisPages,
  coursePlanPages,
  recommendationPages,
  pageStyle,
  editingField,
  editValue,
  onEditValueChange,
  onStartEditing,
  onSaveEdit,
  onCancelEdit,
  onPhotoEdit,
  onPhotoDelete,
  onPhotoReplace,
  onPhotoCrop,
  onOpenPhotoEditor,
  onCoursePlanChange,
}: PdfAnalysisPageProps) {
  // 课程规划单元格编辑状态（独立于正文编辑状态，避免冲突）
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [cellEditValue, setCellEditValue] = useState("");

  const startCellEditing = (cellId: string, value: string) => {
    setEditingCell(cellId);
    setCellEditValue(value);
  };

  const saveCellEdit = () => {
    if (!editingCell) return;
    // cellId 格式：planId.field（planId 为 UUID，不含 "."）
    const dotIndex = editingCell.indexOf('.');
    if (dotIndex === -1) return;
    const planId = editingCell.substring(0, dotIndex);
    const field = editingCell.substring(dotIndex + 1);
    onCoursePlanChange?.(planId, field, cellEditValue);
    setEditingCell(null);
    setCellEditValue("");
  };

  const cancelCellEdit = () => {
    setEditingCell(null);
    setCellEditValue("");
  };

  return (
    <>
      {/* =============== 学情分析页面（智能分页）============== */}
      {analysisPages.map((page, index) => {
        const isLastAnalysisPage = index === analysisPages.length - 1;
        const isLastSection = !reportData.hasCoursePlan && recommendationPages.length === 0;
        const shouldBreakAfter = !(isLastAnalysisPage && isLastSection);
        return (
        <div
          key={`analysis-${index}`}
          className={`bg-white shadow-xl print:shadow-none overflow-hidden relative mb-8 print:mb-0 ${
            shouldBreakAfter ? 'print:break-after-page' : ''
          }`}
          style={pageStyle}
        >
          <div style={contentStyle} className="flex flex-col">
            {/* 标题 */}
            <div className="flex justify-between items-center mb-4 border-b-2 border-gray-300 pb-2">
              <span className="font-bold text-lg text-gray-800">第一部分：教师教学方案</span>
              <span className="text-sm text-gray-600">教学老师：{reportData.teacherName || "教师"}</span>
            </div>

            {page.showTitle && (
              <h3 className="font-bold text-gray-800 mb-3 text-lg">◆ 学情分析</h3>
            )}

            {page.isContinuation && (
              <h3 className="font-bold text-gray-800 mb-3 text-lg">◆ 学情分析（续）</h3>
            )}

            {/* 学员优点 */}
            {page.strengths && (
              <EditableBlock
                field="strengths"
                label={page.strengthsLabel || "学员优点"}
                colorClass="bg-green-50"
                borderColorClass="border-green-500"
                content={page.strengths}
                editingField={editingField}
                editValue={editValue}
                onEditValueChange={onEditValueChange}
                onStartEditing={onStartEditing}
                onSaveEdit={onSaveEdit}
                onCancelEdit={onCancelEdit}
                isFirstPage={page === analysisPages[0]}
              />
            )}

            {/* 能力提升 */}
            {page.improvements && (
              <EditableBlock
                field="improvements"
                label={page.improvementsLabel || "能力提升"}
                colorClass="bg-blue-50"
                borderColorClass="border-blue-500"
                content={page.improvements}
                editingField={editingField}
                editValue={editValue}
                onEditValueChange={onEditValueChange}
                onStartEditing={onStartEditing}
                onSaveEdit={onSaveEdit}
                onCancelEdit={onCancelEdit}
                isFirstPage={page === analysisPages[0]}
              />
            )}

            {/* 需要提升 */}
            {page.weaknesses && (
              <EditableBlock
                field="weaknesses"
                label={page.weaknessesLabel || "需要提升"}
                colorClass="bg-orange-50"
                borderColorClass="border-orange-500"
                content={page.weaknesses}
                editingField={editingField}
                editValue={editValue}
                onEditValueChange={onEditValueChange}
                onStartEditing={onStartEditing}
                onSaveEdit={onSaveEdit}
                onCancelEdit={onCancelEdit}
                isFirstPage={page === analysisPages[0]}
              />
            )}
          </div>
        </div>
      )})}

      {/* =============== 课程规划页（可选，支持分页）============== */}
      {reportData.hasCoursePlan && coursePlanPages.length > 0 && coursePlanPages.map((page, pageIndex) => {
        const isLastCoursePage = pageIndex === coursePlanPages.length - 1;
        const isLastSection = recommendationPages.length === 0;
        const shouldBreakAfter = !(isLastCoursePage && isLastSection);
        return (
        <div
          key={`course-plan-${pageIndex}`}
          className={`bg-white shadow-xl print:shadow-none overflow-hidden relative mb-8 print:mb-0 ${
            shouldBreakAfter ? 'print:break-after-page' : ''
          }`}
          style={pageStyle}
        >
          <div style={contentStyle} className="flex flex-col">
            <div className="flex justify-between items-center mb-4 border-b-2 border-gray-300 pb-2">
              <span className="font-bold text-lg text-gray-800">第一部分：教师教学方案</span>
              <span className="text-sm text-gray-600">教学老师：{reportData.teacherName || "教师"}</span>
            </div>

            <div>
              <h3 className="font-bold text-gray-800 mb-3 text-lg">
                ◆ 教学计划（课程大纲）{!page.isFirstPage && `（续${page.pageNum}/${page.totalPages}）`}
              </h3>

              <table className="w-full border-collapse border-2 border-gray-400">
                <thead>
                  <tr className="bg-gray-100 h-10">
                    <th className="border border-gray-400 py-2 px-3 text-left font-bold text-sm w-[12%]">阶段(单元)</th>
                    <th className="border border-gray-400 py-2 px-3 text-left font-bold text-sm w-[12%]">主题</th>
                    <th className="border border-gray-400 py-2 px-3 text-left font-bold text-sm">教学内容</th>
                    <th className="border border-gray-400 py-2 px-3 text-left font-bold text-sm w-[28%]">备注(项目目标)</th>
                  </tr>
                </thead>
                <tbody>
                  {page.plans.map((plan, index) => {
                    // 计算当前阶段的实际状态
                    const getStageStatus = () => {
                      if (!reportData.currentStageId) return null;
                      if (plan.id === reportData.currentStageId) return 'current';
                      const currentIndex = page.plans.findIndex(p => p.id === reportData.currentStageId);
                      if (currentIndex === -1) return null;
                      const planIndex = index;
                      return planIndex < currentIndex ? 'completed' : 'upcoming';
                    };
                    const stageStatus = plan.status || getStageStatus();

                    return (
                      <tr key={plan.id || index} className={
                        stageStatus === 'current' ? 'bg-blue-50' :
                        stageStatus === 'completed' ? 'bg-green-50' : ''
                      }>
                        <td className="border border-gray-400 py-3 px-3 align-top font-medium text-base">
                          <EditableCoursePlanCell
                            planId={plan.id}
                            field="stage"
                            value={plan.stage}
                            editingCell={editingCell}
                            editValue={cellEditValue}
                            onEditValueChange={setCellEditValue}
                            onStartEditing={startCellEditing}
                            onSaveEdit={saveCellEdit}
                            onCancelEdit={cancelCellEdit}
                          />
                          {stageStatus && (
                            <div className="text-xs mt-1">
                              {stageStatus === 'current' && <span className="text-blue-600 font-medium">[当前阶段]</span>}
                              {stageStatus === 'completed' && <span className="text-green-600">[已学]</span>}
                              {stageStatus === 'upcoming' && <span className="text-gray-500">[待学]</span>}
                            </div>
                          )}
                        </td>
                        <td className="border border-gray-400 py-3 px-3 align-top text-base">
                          <EditableCoursePlanCell
                            planId={plan.id}
                            field="theme"
                            value={plan.theme}
                            editingCell={editingCell}
                            editValue={cellEditValue}
                            onEditValueChange={setCellEditValue}
                            onStartEditing={startCellEditing}
                            onSaveEdit={saveCellEdit}
                            onCancelEdit={cancelCellEdit}
                          />
                        </td>
                        <td className="border border-gray-400 py-3 px-3 align-top whitespace-pre-wrap text-base">
                          <EditableCoursePlanCell
                            planId={plan.id}
                            field="content"
                            value={plan.content}
                            editingCell={editingCell}
                            editValue={cellEditValue}
                            onEditValueChange={setCellEditValue}
                            onStartEditing={startCellEditing}
                            onSaveEdit={saveCellEdit}
                            onCancelEdit={cancelCellEdit}
                            multiline
                          />
                        </td>
                        <td className="border border-gray-400 py-3 px-3 align-top whitespace-pre-wrap text-base">
                          <EditableCoursePlanCell
                            planId={plan.id}
                            field="goal"
                            value={plan.goal}
                            editingCell={editingCell}
                            editValue={cellEditValue}
                            onEditValueChange={setCellEditValue}
                            onStartEditing={startCellEditing}
                            onSaveEdit={saveCellEdit}
                            onCancelEdit={cancelCellEdit}
                            multiline
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )})}

      {/* =============== 教师阶段性建议（智能1-2页）============== */}
      {(recommendationPages.length > 0 ? recommendationPages : [{ content: reportData.recommendations || "暂无建议内容", summary: reportData.summary || undefined, isFirstPage: true, pageNum: 1, totalPages: 1, isLastPage: true }]).map((page, pageIndex) => {
        return (
        <div
          key={`recommendation-${pageIndex}`}
          className={`bg-white shadow-xl print:shadow-none ${page.isLastPage ? 'overflow-visible' : 'overflow-hidden'} relative mb-8 print:mb-0 ${
            !page.isLastPage ? 'print:break-after-page' : ''
          }`}
          style={pageStyle}
        >
          <div style={page.isLastPage ? lastPageContentStyle : contentStyle} className="flex flex-col">
            <div className="mb-3 border-b-2 border-gray-300 pb-2">
              <span className="font-bold text-lg text-gray-800">
                第二部分：教师阶段性建议
                {!page.isFirstPage && `（续${page.pageNum}/${page.totalPages}）`}
              </span>
            </div>

            <div className="shrink-0">
              <div className={`bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-400 relative group ${(editingField === 'recommendations' || editingField === 'summary') ? 'ring-2 ring-blue-400' : ''}`}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-gray-400 print:hidden">
                    {editingField === 'recommendations' ? '编辑建议中...' : editingField === 'summary' ? '编辑总结中...' : ''}
                  </span>
                  <div className="flex gap-1 print:hidden">
                    {editingField !== 'summary' && editingField !== 'recommendations' && page.isFirstPage && page.summary && (
                      <button onClick={() => onStartEditing('summary', reportData.summary)} className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-blue-500 p-1" title="编辑总结">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {editingField !== 'recommendations' && editingField !== 'summary' && page.isFirstPage && (
                      <button onClick={() => onStartEditing('recommendations', reportData.recommendations)} className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-blue-500 p-1" title="编辑建议">
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                {editingField === 'recommendations' && page.isFirstPage ? (
                  <div className="print:hidden">
                    <div className="text-sm text-gray-500 mb-1">编辑建议内容：</div>
                    <textarea value={editValue} onChange={e => onEditValueChange(e.target.value)} className="w-full h-48 text-base p-2 border rounded resize-y" />
                    <div className="flex gap-2 mt-2">
                      <button onClick={onSaveEdit} className="flex items-center gap-1 px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"><Check className="h-3.5 w-3.5" />完成</button>
                      <button onClick={onCancelEdit} className="px-3 py-1 bg-gray-200 text-gray-600 rounded text-sm hover:bg-gray-300">取消</button>
                    </div>
                  </div>
                ) : editingField === 'summary' && page.isFirstPage ? (
                  <div className="print:hidden">
                    <div className="text-sm text-gray-500 mb-1">编辑总结内容：</div>
                    <textarea value={editValue} onChange={e => onEditValueChange(e.target.value)} className="w-full h-32 text-base p-2 border rounded resize-y" />
                    <div className="flex gap-2 mt-2">
                      <button onClick={onSaveEdit} className="flex items-center gap-1 px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"><Check className="h-3.5 w-3.5" />完成</button>
                      <button onClick={onCancelEdit} className="px-3 py-1 bg-gray-200 text-gray-600 rounded text-sm hover:bg-gray-300">取消</button>
                    </div>
                  </div>
                ) : (
                  <div className="text-base text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {page.summary && (
                      <>
                        {formatContent(page.summary)}
                        <div className="my-3 border-t border-yellow-300" />
                      </>
                    )}
                    {formatContent(page.content)}
                  </div>
                )}
              </div>
            </div>

            {/* 学员风采 + 落款，照片区域占满剩余空间 */}
            {page.isLastPage && (
              <div className="mt-3 flex-1 flex flex-col min-h-0">
                {/* 学员风采 - 占满剩余空间，至少保留200px高度 */}
                <div className="flex-1 min-h-[240px] flex flex-col">
                  {reportData.studentPhotos && reportData.studentPhotos.length > 0 ? (
                    <>
                      <div className="mb-2 flex items-center gap-4">
                        <span className="font-bold text-base text-gray-800">◆ 学员风采</span>
                        <span className="text-sm text-gray-500">{reportData.studentName}</span>
                        {reportData.studentPhotos.length > 6 && (
                          <span className="text-xs text-gray-400">(共{reportData.studentPhotos.length}张)</span>
                        )}
                        <button onClick={onOpenPhotoEditor} className="print:hidden text-gray-400 hover:text-blue-500 p-1 ml-auto" title="编辑照片">
                          <Camera className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="flex-1 min-h-0">
                        <FreeLayoutPhotoEditor
                          photos={reportData.studentPhotos.slice(0, 6)}
                          onPhotoEdit={onPhotoEdit}
                          onPhotoDelete={onPhotoDelete}
                          onPhotoReplace={onPhotoReplace}
                          onPhotoCrop={onPhotoCrop}
                          fillContainer
                        />
                      </div>
                    </>
                  ) : (
                    <button onClick={onOpenPhotoEditor} className="print:hidden w-full border-2 border-dashed border-gray-300 rounded-lg p-3 text-center text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors text-sm">
                      + 添加学员风采照片
                    </button>
                  )}
                </div>

                {/* 落款：校区与日期合并为一行，固定在底部 */}
                <div className="text-center pt-4 shrink-0">
                  <p className="text-base text-gray-600">{reportData.campus || ""}教学部　{reportData.feedbackDate}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )})}
    </>
  );
}
