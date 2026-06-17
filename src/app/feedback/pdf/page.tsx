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
    const storedData = sessionStorage.getItem("pdfReportData");
    if (storedData) {
      try { setReportData(JSON.parse(storedData)); }
      catch (e) {
        console.error("Failed to parse report data:", e);
        setNoData(true);
      }
    }
  }, []);

  // 超时检测
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!sessionStorage.getItem("pdfReportData")) setNoData(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleSave = async (): Promise<boolean> => {
    if (!reportData || saving) return false;
    setSaving(true);
    try {
      const saveData = {
        student_id: reportData.studentId, teacher_id: reportData.teacherId,
        student_name: reportData.studentName, grade: reportData.grade,
        class_name: reportData.className, school: reportData.school,
        theme: reportData.theme, feedback_date: reportData.feedbackDate,
        teacher_name: reportData.teacherName, teacher_phone: reportData.teacherPhone,
        campus: reportData.campus, strengths: reportData.strengths,
        improvements: reportData.improvements, weaknesses: reportData.weaknesses,
        recommendations: reportData.recommendations, summary: reportData.summary,
        tag_ratings: reportData.tagRatings, has_course_plan: reportData.hasCoursePlan,
        course_plans: reportData.coursePlans, current_stage_id: reportData.currentStageId,
        // BUG-9: 保存照片数据
        student_photos: reportData.studentPhotos?.map(p => ({ id: p.id, url: p.url })) || [],
        status: "completed",
      };
      const response = await fetch("/api/feedbacks", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(saveData),
      });
      if (response.ok) { setSaved(true); toast.success("保存成功！"); return true; }
      else { const errorData = await response.json(); toast.error(errorData.error || "保存失败"); return false; }
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

  const handleBack = () => {
    const storedData = sessionStorage.getItem("pdfReportData");
    if (storedData) sessionStorage.setItem("tempReportData", storedData);
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
          <PdfCoverPage reportData={reportData} pageStyle={pageStyle} />
          <PdfAnalysisPage
            reportData={reportData} analysisPages={analysisPages}
            coursePlanPages={coursePlanPages} recommendationPages={recommendationPages}
            pageStyle={pageStyle} editingField={editingField} editValue={editValue}
            onEditValueChange={setEditValue} onStartEditing={startEditing}
            onSaveEdit={saveEdit} onCancelEdit={cancelEdit}
            onPhotoEdit={handlePhotoEdit} onPhotoDelete={handlePhotoDelete}
            onPhotoReplace={handlePhotoReplace} onPhotoCrop={handlePhotoCrop}
            onOpenPhotoEditor={openPhotoEditor}
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
