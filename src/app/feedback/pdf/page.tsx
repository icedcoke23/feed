"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ReportData } from "@/types/feedback";
import { PdfCoverPage } from "@/components/business/pdf-cover-page";
import { PdfAnalysisPage } from "@/components/business/pdf-analysis-page";
import { PdfToolbar } from "@/components/business/pdf-toolbar";
import { PhotoEditorModal } from "@/components/business/photo-editor-modal";
import { ImageCropDialog } from "@/components/business/image-crop-dialog";
import { usePdfPagination } from "@/hooks/use-pdf-pagination";
import { usePhotoEditor } from "@/hooks/use-photo-editor";
import { loadPdfReportData, savePdfReportData, transferToTempReport } from "@/lib/pdf-session";

// 页面配置
const PAGE_WIDTH = 210; // mm
const PAGE_HEIGHT = 297; // mm
const BG_IMAGE_URL = process.env.NEXT_PUBLIC_BG_IMAGE_URL || "/images/pdf-bg.png";

function PDFPreviewPageContent() {
  const router = useRouter();
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // 就地编辑状态
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  // 分页计算
  const { analysisPages, coursePlanPages, recommendationPages } = usePdfPagination(reportData);

  // 照片编辑
  const {
    photoEditorOpen, photoEditorPhotos,
    openPhotoEditor, savePhotoEditor, removePhoto, addPhotos, closePhotoEditor,
    handlePhotoEdit, handlePhotoDelete, handlePhotoReplace,
  } = usePhotoEditor(reportData, setReportData);

  // 裁剪对话框状态
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [cropPhotoId, setCropPhotoId] = useState<string | null>(null);
  const [cropPhotoUrl, setCropPhotoUrl] = useState("");

  // 数据缺失状态
  const [noData, setNoData] = useState(false);

  const handlePhotoCrop = (photoId: string, photoUrl: string) => {
    setCropPhotoId(photoId);
    setCropPhotoUrl(photoUrl);
    setCropDialogOpen(true);
  };

  const handleCropComplete = (croppedUrl: string) => {
    if (cropPhotoId) {
      handlePhotoEdit(cropPhotoId, croppedUrl);
    }
    setCropDialogOpen(false);
    setCropPhotoId(null);
    setCropPhotoUrl("");
  };

  // 加载报告数据
  useEffect(() => {
    const data = loadPdfReportData();
    if (data) {
      // 兼容旧数据：未设置校区时默认南沙万达校区
      if (!data.campus || data.campus.trim() === "") {
        data.campus = "南沙万达校区";
      }
      console.log("[PDF] studentPhotos:", data.studentPhotos);
      setReportData(data);
    } else {
      setNoData(true);
    }
  }, []);

  // 超时检测
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!loadPdfReportData()) setNoData(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  // 同步到 localStorage：任何字段编辑后立即持久化，确保刷新不丢失
  useEffect(() => {
    if (reportData) {
      savePdfReportData(reportData);
    }
  }, [reportData]);

  const handleSave = async (): Promise<boolean> => {
    if (!reportData || saving) return false;
    setSaving(true);
    try {
      const tagRatingsRecord: Record<string, number> = {};
      reportData.tagRatings?.forEach((tr) => { if (tr.name) tagRatingsRecord[tr.name] = tr.rating; });

      const saveData = {
        student_id: reportData.studentId, teacher_id: reportData.teacherId,
        student_name: reportData.studentName, grade: reportData.grade || undefined,
        class_name: reportData.className || undefined, school: reportData.school || undefined,
        theme: reportData.theme || undefined, feedback_date: reportData.feedbackDate || undefined,
        teacher_name: reportData.teacherName || undefined, teacher_phone: reportData.teacherPhone || undefined,
        admin_teacher_name: reportData.adminTeacherName || undefined, admin_teacher_phone: reportData.adminTeacherPhone || undefined,
        campus: reportData.campus || undefined,
        strengths: reportData.strengths ? [{ tag: "学员优点", description: reportData.strengths }] : [],
        improvements: reportData.improvements ? [{ tag: "能力提升", description: reportData.improvements }] : [],
        weaknesses: reportData.weaknesses ? [{ tag: "需要提升", description: reportData.weaknesses }] : [],
        recommendations: reportData.recommendations || undefined, summary: reportData.summary || undefined,
        tag_ratings: tagRatingsRecord, has_course_plan: reportData.hasCoursePlan,
        course_plans: reportData.coursePlans ? JSON.stringify(reportData.coursePlans) : undefined, current_stage_id: reportData.currentStageId || undefined,
        // BUG-9: 保存照片数据
        student_photos: reportData.studentPhotos?.map(p => ({ id: p.id, url: p.url })) || [],
        // 封面信息与课程规划修改存入 metadata，便于后续恢复
        metadata: {
          coverInfo: {
            studentName: reportData.studentName,
            grade: reportData.grade,
            school: reportData.school,
            teacherName: reportData.teacherName,
            teacherPhone: reportData.teacherPhone,
            adminTeacherName: reportData.adminTeacherName,
            adminTeacherPhone: reportData.adminTeacherPhone,
          },
          coursePlans: reportData.coursePlans,
        },
        status: "completed",
      };
      const bodyStr = JSON.stringify(saveData);
      console.log('[Save] request body size:', bodyStr.length, 'bytes');
      const response = await fetch("/api/feedbacks", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: bodyStr,
      });
      if (response.ok) { setSaved(true); toast.success("保存成功！"); return true; }
      else {
        const text = await response.text();
        console.error('[Save] API raw response:', response.status, text.slice(0, 500));
        let errorData: { error?: string } = {};
        try { errorData = JSON.parse(text); } catch { /* not JSON */ }
        toast.error(errorData.error || `保存失败 (HTTP ${response.status})`);
        return false;
      }
    } catch (e) {
      console.error("保存反馈失败:", e);
      toast.error("保存反馈失败，请重试");
      return false;
    } finally { setSaving(false); }
  };

  const handlePrint = async () => {
    const saved = await handleSave();
    if (saved) {
      window.print();
    }
  };

  const startEditing = (field: string, value: string) => { setEditingField(field); setEditValue(value); };
  const saveEdit = () => {
    if (!reportData || !editingField) return;
    setReportData({ ...reportData, [editingField]: editValue });
    setEditingField(null); setEditValue("");
  };
  const cancelEdit = () => { setEditingField(null); setEditValue(""); };

  // 封面页字段编辑回调（studentName, grade, school, teacherName, adminTeacherName）
  const handleFieldChange = (field: string, value: string) => {
    if (!reportData) return;
    setReportData({ ...reportData, [field]: value });
  };

  // 课程规划单元格编辑回调（stage, theme, content, goal）
  const handleCoursePlanChange = (planId: string, field: string, value: string) => {
    if (!reportData || !reportData.coursePlans) return;
    const newCoursePlans = reportData.coursePlans.map(plan =>
      plan.id === planId ? { ...plan, [field]: value } : plan
    );
    setReportData({ ...reportData, coursePlans: newCoursePlans });
  };

  const handleBack = () => {
    transferToTempReport();
    router.push("/feedback/new?step=4&restore=true");
  };

  if (!reportData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          {noData ? (
            <>
              <p className="text-gray-500 mb-4">未找到报告数据</p>
              <button onClick={() => router.push("/feedback/new")} className="text-blue-600 hover:text-blue-800 underline">返回创建反馈</button>
            </>
          ) : (
            <p className="text-gray-500">加载中...</p>
          )}
        </div>
      </div>
    );
  }

  const pageStyle: React.CSSProperties = {
    width: `${PAGE_WIDTH}mm`, height: `${PAGE_HEIGHT}mm`,
    ...(BG_IMAGE_URL ? {
      backgroundImage: `url("${BG_IMAGE_URL}")`, backgroundSize: "100% 100%",
      backgroundPosition: "center", backgroundRepeat: "no-repeat",
    } : {}),
  };

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      <PdfToolbar onBack={handleBack} onSave={handleSave} onPrint={handlePrint} saving={saving} saved={saved} />

      <div className="py-2 sm:py-8 print:py-0 overflow-x-auto">
        <div className="max-w-[210mm] mx-auto space-y-4 sm:space-y-8 print:space-y-0 min-w-[320px] sm:min-w-0">
          <PdfCoverPage reportData={reportData} pageStyle={pageStyle} onFieldChange={handleFieldChange} />
          <PdfAnalysisPage
            reportData={reportData} analysisPages={analysisPages}
            coursePlanPages={coursePlanPages} recommendationPages={recommendationPages}
            pageStyle={pageStyle} editingField={editingField} editValue={editValue}
            onEditValueChange={setEditValue} onStartEditing={startEditing}
            onSaveEdit={saveEdit} onCancelEdit={cancelEdit}
            onPhotoEdit={handlePhotoEdit} onPhotoDelete={handlePhotoDelete}
            onPhotoReplace={handlePhotoReplace} onPhotoCrop={handlePhotoCrop}
            onOpenPhotoEditor={openPhotoEditor}
            onCoursePlanChange={handleCoursePlanChange}
          />
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page { size: A4; margin: 0; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          body { margin: 0; padding: 0; }
          .print\\:hidden { display: none !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:break-after-page { break-after: page; page-break-after: always; }
          .print\\:py-0 { padding-top: 0 !important; padding-bottom: 0 !important; }
          .print\\:mb-0 { margin-bottom: 0 !important; }
          .print\\:space-y-0 > * + * { margin-top: 0 !important; }
          .print-overflow-visible { overflow: visible !important; }
        }
      `}</style>

      {photoEditorOpen && (
        <PhotoEditorModal
          photos={photoEditorPhotos} onRemovePhoto={removePhoto}
          onAddPhotos={addPhotos} onSave={savePhotoEditor} onCancel={closePhotoEditor}
        />
      )}

      <ImageCropDialog
        open={cropDialogOpen}
        onClose={() => { setCropDialogOpen(false); setCropPhotoId(null); setCropPhotoUrl(""); }}
        imageSrc={cropPhotoUrl}
        onCropComplete={handleCropComplete}
        title="裁剪照片"
      />
    </div>
  );
}

export default function PDFPreviewPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">加载中...</p>
        </div>
      </div>
    }>
      <PDFPreviewPageContent />
    </Suspense>
  );
}
