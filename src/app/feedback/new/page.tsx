"use client";

import { Suspense, useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import dynamic from "next/dynamic";

import { StepProgressBar } from "@/components/business/step-progress-bar";
const StudentSelector = dynamic(() => import("@/components/business/student-selector").then(m => ({ default: m.StudentSelector })), { ssr: false });
const CoursePlanEditor = dynamic(() => import("@/components/business/course-plan-editor").then(m => ({ default: m.CoursePlanEditor })), { ssr: false });
const TagRatingPanel = dynamic(() => import("@/components/business/tag-rating-panel").then(m => ({ default: m.TagRatingPanel })), { ssr: false });
const ReportGenerator = dynamic(() => import("@/components/business/report-generator").then(m => ({ default: m.ReportGenerator })), { ssr: false });
const StudentPhotos = dynamic(() => import("@/components/business/student-photos").then(m => ({ default: m.StudentPhotos })), { ssr: false });
const ExportPanel = dynamic(() => import("@/components/business/export-panel").then(m => ({ default: m.ExportPanel })), { ssr: false });
import { AIStreamDialog } from "@/components/business/ai-stream-dialog";

import { useFeedbackData } from "@/hooks/use-feedback-data";
import { useFeedbackForm } from "@/hooks/use-feedback-form";
import { useReportGeneration } from "@/hooks/use-report-generation";
import { useExport } from "@/hooks/use-export";

function CreateFeedbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEditMode = !!searchParams.get("editId");
  const [savedFeedbackId, setSavedFeedbackId] = useState<string | null>(null);
  const [showDraftDialog, setShowDraftDialog] = useState(false);

  // 数据获取
  const {
    loading,
    students,
    tags,
    setTags,
    themes,
    teachers,
    adminTeachers,
    courseStagePresets,
    feedbackHistory,
    fetchFeedbackHistory,
  } = useFeedbackData();

  // 表单状态管理
  const form = useFeedbackForm({
    tags,
    setTags,
    students,
    teachers,
    adminTeachers,
    themes,
    fetchFeedbackHistory,
  });

  // 报告生成
  const report = useReportGeneration({
    students,
    tags,
    themes,
    selectedStudentId: form.selectedStudentId,
    selectedThemeId: form.selectedThemeId,
    tagRatings: form.tagRatings,
    coursePlans: form.coursePlans,
    currentStageId: form.currentStageId,
    feedbackHistory,
    generatedReport: form.generatedReport,
    setGeneratedReport: form.setGeneratedReport,
  });

  // 导出
  const exportHook = useExport({
    students,
    tags,
    teachers,
    themes,
    selectedStudentId: form.selectedStudentId,
    selectedThemeId: form.selectedThemeId,
    selectedTeacherId: form.selectedTeacherId,
    selectedAdminTeacherId: form.selectedAdminTeacherId,
    feedbackDate: form.feedbackDate,
    tagRatings: form.tagRatings,
    generatedReport: form.generatedReport,
    hasCoursePlan: form.hasCoursePlan,
    coursePlans: form.coursePlans,
    currentStageId: form.currentStageId,
    studentPhotos: form.studentPhotos,
  });

  const selectedStudent = students.find((s) => s.id === form.selectedStudentId);
  const selectedTheme = themes.find((t) => t.id === form.selectedThemeId);

  const handleSaveFeedback = useCallback(async () => {
    const id = await form.saveFeedback();
    if (id) {
      setSavedFeedbackId(id);
      // 编辑模式保存成功后跳转到反馈详情页
      if (form.isEditMode && form.editId) {
        router.push(`/feedback/${form.editId}`);
      }
    }
  }, [form, router]);

  // 进入页面时检测草稿，非编辑模式下提示恢复
  useEffect(() => {
    if (!isEditMode && !loading && form.hasDraft && form.currentStep === 0 && !form.selectedStudentId) {
      setShowDraftDialog(true);
    }
  }, [isEditMode, loading, form.hasDraft, form.currentStep, form.selectedStudentId]);

  const handleRestoreDraft = useCallback(() => {
    const draft = form.restoreDraft();
    if (draft) {
      if (draft.selectedStudentId) form.setSelectedStudentId(draft.selectedStudentId);
      if (draft.selectedThemeId) form.setSelectedThemeId(draft.selectedThemeId);
      if (draft.selectedTeacherId) form.setSelectedTeacherId(draft.selectedTeacherId);
      if (draft.selectedAdminTeacherId) form.setSelectedAdminTeacherId(draft.selectedAdminTeacherId);
      if (draft.feedbackDate) form.setFeedbackDate(draft.feedbackDate);
      if (draft.tagRatings) form.setTagRatings(draft.tagRatings as Record<string, { rating: number; note: string; isCustom?: boolean; category?: string }>);
      if (draft.generatedReport) form.setGeneratedReport(draft.generatedReport as { strengths: string; improvements: string; weaknesses: string; recommendations: string; summary: string });
      if (draft.hasCoursePlan !== undefined) form.setHasCoursePlan(draft.hasCoursePlan);
      if (draft.coursePlans) form.setCoursePlans(draft.coursePlans as { id: string; stage: string; theme: string; content: string; goal: string; status?: "completed" | "current" | "upcoming" }[]);
      if (draft.currentStageId) form.setCurrentStageId(draft.currentStageId);
      // 跳到有数据的步骤
      if (draft.generatedReport) {
        form.setCurrentStep(3);
      } else if (draft.tagRatings && Object.keys(draft.tagRatings).length > 0) {
        form.setCurrentStep(2);
      }
    }
    setShowDraftDialog(false);
  }, [form]);

  const handleDiscardDraft = useCallback(() => {
    form.clearDraft();
    setShowDraftDialog(false);
  }, [form]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部进度条 */}
      <StepProgressBar currentStep={form.currentStep} />

      {/* 编辑模式标题 */}
      {form.isEditMode && (
        <div className="container mx-auto px-4 pt-4">
          <h1 className="text-xl font-bold text-gray-800">编辑反馈</h1>
        </div>
      )}

      {/* 主内容区 */}
      <main className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
        {loading || form.editLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            {/* 步骤1: 选择学员 */}
            {form.currentStep === 0 && (
              <StudentSelector
                students={students}
                feedbackHistory={feedbackHistory}
                selectedStudentId={form.selectedStudentId}
                feedbackDate={form.feedbackDate}
                onSelectStudent={form.setSelectedStudentId}
                onChangeDate={form.setFeedbackDate}
              />
            )}

            {/* 步骤2: 课程规划 */}
            {form.currentStep === 1 && (
              <CoursePlanEditor
                teachers={teachers}
                adminTeachers={adminTeachers}
                courseStagePresets={courseStagePresets}
                selectedTeacherId={form.selectedTeacherId}
                selectedAdminTeacherId={form.selectedAdminTeacherId}
                hasCoursePlan={form.hasCoursePlan}
                coursePlans={form.coursePlans}
                currentStageId={form.currentStageId}
                onSelectTeacher={form.setSelectedTeacherId}
                onSelectAdminTeacher={form.setSelectedAdminTeacherId}
                onSetHasCoursePlan={form.setHasCoursePlan}
                onSetCoursePlans={form.setCoursePlans}
                onSetCurrentStageId={form.setCurrentStageId}
              />
            )}

            {/* 步骤3: 标签评分 */}
            {form.currentStep === 2 && (
              <TagRatingPanel
                categorizedTags={form.categorizedTags}
                tagRatings={form.tagRatings}
                selectedTagsCount={form.selectedTagsCount}
                customTagName={form.customTagName}
                customTagNote={form.customTagNote}
                customTagRating={form.customTagRating}
                customTagCategory={form.customTagCategory}
                addingCustomTag={form.addingCustomTag}
                onToggleTag={form.toggleTag}
                onUpdateTagRating={form.updateTagRating}
                onUpdateTagNote={form.updateTagNote}
                onSetCustomTagName={form.setCustomTagName}
                onSetCustomTagNote={form.setCustomTagNote}
                onSetCustomTagRating={form.setCustomTagRating}
                onSetCustomTagCategory={form.setCustomTagCategory}
                onAddCustomTag={form.handleAddCustomTag}
              />
            )}

            {/* 步骤4: 生成报告 */}
            {form.currentStep === 3 && (
              <ReportGenerator
                selectedStudent={selectedStudent}
                selectedTheme={selectedTheme}
                selectedTagsCount={form.selectedTagsCount}
                generatedReport={form.generatedReport}
                generating={report.generating}
                reviewing={report.reviewing}
                onGenerate={report.handleGenerateReport}
                onReview={report.handleReviewReport}
                onUpdateReport={form.setGeneratedReport}
              />
            )}

            {/* 步骤5: 学员风采 */}
            {form.currentStep === 4 && (
              <StudentPhotos
                studentPhotos={form.studentPhotos}
                uploadingPhoto={form.uploadingPhoto}
                onUpload={form.handlePhotoUpload}
                onRemove={form.handleRemovePhoto}
                onClearAll={() => form.setStudentPhotos([])}
                onAddCroppedPhoto={form.handleAddCroppedPhoto}
                onReplacePhoto={form.handleReplacePhoto}
              />
            )}

            {/* 步骤6: 导出文档 */}
            {form.currentStep === 5 && (
              <ExportPanel
                exporting={exportHook.exporting}
                saving={form.saving}
                saved={!!savedFeedbackId}
                onExportWord={exportHook.handleExport}
                onExportPDF={exportHook.handleExportPDF}
                onSaveFeedback={handleSaveFeedback}
              />
            )}

            {/* 底部导航按钮 */}
            <div className="flex justify-between mt-4 sm:mt-6 gap-2">
              <Button
                variant="outline"
                onClick={form.handleBack}
                disabled={form.currentStep === 0}
                size="sm"
                className="h-9 sm:h-10"
              >
                <ArrowLeft className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">上一步</span>
              </Button>

              {form.currentStep === 3 && form.generatedReport && (
                <Button onClick={form.handleNext} size="sm" className="h-9 sm:h-10">
                  <span className="text-xs sm:text-sm">学员风采</span>
                  <ArrowRight className="h-4 w-4 sm:ml-2" />
                </Button>
              )}

              {form.currentStep === 4 && (
                <Button onClick={form.handleNext} size="sm" className="h-9 sm:h-10">
                  <span className="text-xs sm:text-sm">导出文档</span>
                  <ArrowRight className="h-4 w-4 sm:ml-2" />
                </Button>
              )}

              {form.currentStep < 3 && (
                <Button
                  onClick={form.handleNext}
                  disabled={!form.canProceed()}
                  size="sm"
                  className="h-9 sm:h-10"
                >
                  <span className="text-xs sm:text-sm">下一步</span>
                  <ArrowRight className="h-4 w-4 sm:ml-2" />
                </Button>
              )}
            </div>
          </div>
        )}
      </main>

      {/* AI流式生成对话框 */}
      <AIStreamDialog
        open={report.showStreamingDialog}
        onOpenChange={report.setShowStreamingDialog}
        type="generating"
        content={report.streamingContent}
        isStreaming={report.isStreaming}
        connectionStatus={report.connectionStatus}
        onAbortStream={report.abortStream}
      />

      {/* AI复检对话框 */}
      <AIStreamDialog
        open={report.showReviewDialog}
        onOpenChange={report.setShowReviewDialog}
        type="reviewing"
        content={report.reviewContent}
        isStreaming={report.isReviewStreaming}
        connectionStatus={report.reviewConnectionStatus}
        onAbortStream={report.abortReviewStream}
      />

      {/* 草稿恢复提示对话框 */}
      <Dialog open={showDraftDialog} onOpenChange={setShowDraftDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>发现未完成的草稿</DialogTitle>
            <DialogDescription>
              您有一份未保存的反馈草稿，是否恢复？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleDiscardDraft}>
              丢弃草稿
            </Button>
            <Button onClick={handleRestoreDraft}>
              恢复草稿
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// 包装组件，添加 Suspense 边界
export default function CreateFeedbackPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500">加载中...</p>
          </div>
        </div>
      }
    >
      <CreateFeedbackPage />
    </Suspense>
  );
}
