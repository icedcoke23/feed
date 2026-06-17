"use client";

import React from "react";
import { Pencil, Check, Camera } from "lucide-react";
import type { ReportData, CoursePlan } from "@/types/feedback";
import { FreeLayoutPhotoEditor } from "@/components/business/free-layout-photo-editor";

// 内容页padding常量
const CONTENT_PADDING_TOP = 20; // mm
const CONTENT_PADDING_BOTTOM = 12; // mm
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
  isFirstPage: boolean;
  pageNum: number;
  totalPages: number;
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
    <div className="mb-4 print:relative">
      <div className={`${colorClass} p-5 rounded-lg border-l-4 ${borderColorClass} relative group ${isEditing ? 'ring-2 ring-blue-400' : ''}`}>
        <div className="flex justify-between items-center mb-2">
          <h4 className={`font-bold text-lg ${borderColorClass.replace('border-', 'text-').replace('-500', '-700')}`}>{label}</h4>
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
          <div className="text-lg text-gray-700 whitespace-pre-wrap leading-loose">
            {formatContent(content)}
          </div>
        )}
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
}: PdfAnalysisPageProps) {
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
                label="学员优点"
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
                label="能力提升"
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
                label="需要提升"
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
                          {plan.stage}
                          {stageStatus && (
                            <div className="text-xs mt-1">
                              {stageStatus === 'current' && <span className="text-blue-600 font-medium">[当前阶段]</span>}
                              {stageStatus === 'completed' && <span className="text-green-600">[已学]</span>}
                              {stageStatus === 'upcoming' && <span className="text-gray-500">[待学]</span>}
                            </div>
                          )}
                        </td>
                        <td className="border border-gray-400 py-3 px-3 align-top text-base">{plan.theme}</td>
                        <td className="border border-gray-400 py-3 px-3 align-top whitespace-pre-wrap text-base">{plan.content}</td>
                        <td className="border border-gray-400 py-3 px-3 align-top whitespace-pre-wrap text-base">{plan.goal}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )})}

      {/* =============== 教师阶段性建议（支持分页）============== */}
      {(recommendationPages.length > 0 ? recommendationPages : [{ content: reportData.recommendations || "暂无建议内容", isFirstPage: true, pageNum: 1, totalPages: 1 }]).map((page, pageIndex) => {
        const totalRecPages = recommendationPages.length > 0 ? recommendationPages.length : 1;
        const isLastPage = pageIndex === totalRecPages - 1;
        return (
        <div
          key={`recommendation-${pageIndex}`}
          className={`bg-white shadow-xl print:shadow-none overflow-hidden relative mb-8 print:mb-0 ${
            !isLastPage ? 'print:break-after-page' : ''
          }`}
          style={pageStyle}
        >
          <div style={contentStyle} className="flex flex-col">
            <div className="mb-4 border-b-2 border-gray-300 pb-2">
              <span className="font-bold text-lg text-gray-800">
                第二部分：教师阶段性建议
                {!page.isFirstPage && `（续${page.pageNum}/${page.totalPages}）`}
              </span>
            </div>

            <div className={isLastPage ? "" : "flex-1"}>
              <div className={`bg-yellow-50 p-5 rounded-lg border-l-4 border-yellow-400 relative group ${editingField === 'recommendations' ? 'ring-2 ring-blue-400' : ''}`}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-gray-400 print:hidden">{editingField === 'recommendations' ? '编辑中...' : ''}</span>
                  {editingField !== 'recommendations' && page.isFirstPage && (
                    <button onClick={() => onStartEditing('recommendations', reportData.recommendations)} className="print:hidden opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-blue-500 p-1" title="编辑建议">
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {editingField === 'recommendations' && page.isFirstPage ? (
                  <div className="print:hidden">
                    <textarea value={editValue} onChange={e => onEditValueChange(e.target.value)} className="w-full h-48 text-base p-2 border rounded resize-y" />
                    <div className="flex gap-2 mt-2">
                      <button onClick={onSaveEdit} className="flex items-center gap-1 px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"><Check className="h-3.5 w-3.5" />完成</button>
                      <button onClick={onCancelEdit} className="px-3 py-1 bg-gray-200 text-gray-600 rounded text-sm hover:bg-gray-300">取消</button>
                    </div>
                  </div>
                ) : (
                  <div className="text-lg text-gray-700 whitespace-pre-wrap leading-loose">
                    {formatContent(page.content)}
                  </div>
                )}
              </div>
            </div>

            {/* 学员风采 - 仅在最后一页显示，放在落款之前 */}
            {isLastPage && (
              <div className="mt-3">
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
                    <FreeLayoutPhotoEditor
                      photos={reportData.studentPhotos.slice(0, 6)}
                      onPhotoEdit={onPhotoEdit}
                      onPhotoDelete={onPhotoDelete}
                      onPhotoReplace={onPhotoReplace}
                      onPhotoCrop={onPhotoCrop}
                      containerHeight={reportData.studentPhotos.length <= 2 ? 280 : reportData.studentPhotos.length <= 4 ? 360 : 440}
                    />
                  </>
                ) : (
                  <button onClick={onOpenPhotoEditor} className="print:hidden w-full border-2 border-dashed border-gray-300 rounded-lg p-3 text-center text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors text-sm">
                    + 添加学员风采照片
                  </button>
                )}
              </div>
            )}

            {/* 落款 - 仅在最后一页显示 */}
            {isLastPage && (
              <div className="text-center pt-6 mt-auto">
                <p className="font-bold text-gray-800 text-xl">{reportData.campus || ""}教学部</p>
                <p className="text-lg text-gray-600 mt-2">{reportData.feedbackDate}</p>
              </div>
            )}
          </div>
        </div>
      )})}
    </>
  );
}
