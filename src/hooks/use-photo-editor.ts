"use client";

import { useState } from "react";
import type { ReportData } from "@/types/feedback";
import { compressImage } from "@/utils/compress-image";

/** 将 File/Blob 读取为 base64 data URL，确保跨标签页、跨会话可用 */
function readFileAsDataURL(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result === "string") {
        resolve(result);
      } else {
        reject(new Error("读取图片失败"));
      }
    };
    reader.onerror = () => reject(new Error("FileReader 错误"));
    reader.readAsDataURL(file);
  });
}

export interface UsePhotoEditorReturn {
  photoEditorOpen: boolean;
  photoEditorPhotos: Array<{ id: string; url: string }>;
  openPhotoEditor: () => void;
  savePhotoEditor: () => void;
  removePhoto: (id: string) => void;
  addPhotos: (e: React.ChangeEvent<HTMLInputElement>) => void;
  closePhotoEditor: () => void;
  handlePhotoEdit: (photoId: string, newUrl: string) => void;
  handlePhotoDelete: (photoId: string) => void;
  handlePhotoReplace: (photoId: string, e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function usePhotoEditor(
  reportData: ReportData | null,
  setReportData: React.Dispatch<React.SetStateAction<ReportData | null>>
): UsePhotoEditorReturn {
  const [photoEditorOpen, setPhotoEditorOpen] = useState(false);
  const [photoEditorPhotos, setPhotoEditorPhotos] = useState<Array<{ id: string; url: string }>>([]);

  const openPhotoEditor = () => {
    setPhotoEditorPhotos(reportData?.studentPhotos?.map(p => ({ id: p.id, url: p.url })) || []);
    setPhotoEditorOpen(true);
  };

  const savePhotoEditor = () => {
    if (!reportData) return;
    setReportData({ ...reportData, studentPhotos: photoEditorPhotos });
    setPhotoEditorOpen(false);
  };

  const removePhoto = (id: string) => {
    setPhotoEditorPhotos(prev => prev.filter(p => p.id !== id));
  };

  const addPhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(async (file) => {
      if (!file.type.startsWith("image/")) return;
      try {
        const compressedFile = await compressImage(file, 1200, 0.7);
        const url = await readFileAsDataURL(compressedFile);
        setPhotoEditorPhotos(prev => {
          if (prev.length >= 10) return prev;
          return [...prev, { id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`, url }];
        });
      } catch (error) {
        console.error("压缩图片失败:", error);
        // 降级：使用原始文件的 FileReader
        const reader = new FileReader();
        reader.onload = (event) => {
          const fallbackUrl = event.target?.result as string;
          setPhotoEditorPhotos(prev => {
            if (prev.length >= 10) return prev;
            return [...prev, { id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`, url: fallbackUrl }];
          });
        };
        reader.readAsDataURL(file);
      }
    });
    e.target.value = "";
  };

  const closePhotoEditor = () => setPhotoEditorOpen(false);

  const handlePhotoEdit = (photoId: string, newUrl: string) => {
    if (!reportData) return;
    setReportData({
      ...reportData,
      studentPhotos: reportData.studentPhotos.map(p => p.id === photoId ? { ...p, url: newUrl } : p),
    });
  };

  const handlePhotoDelete = (photoId: string) => {
    if (!reportData) return;
    const targetPhoto = reportData.studentPhotos.find(p => p.id === photoId);
    if (targetPhoto?.url?.startsWith("blob:")) {
      URL.revokeObjectURL(targetPhoto.url);
    }
    setReportData({
      ...reportData,
      studentPhotos: reportData.studentPhotos.filter(p => p.id !== photoId),
    });
  };

  const handlePhotoReplace = (photoId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/") || !reportData) return;

    const oldPhoto = reportData.studentPhotos.find(p => p.id === photoId);
    if (oldPhoto?.url?.startsWith("blob:")) {
      URL.revokeObjectURL(oldPhoto.url);
    }

    (async () => {
      try {
        const compressedFile = await compressImage(file, 1200, 0.7);
        const url = await readFileAsDataURL(compressedFile);
        setReportData({
          ...reportData,
          studentPhotos: reportData.studentPhotos.map(p => p.id === photoId ? { ...p, url } : p),
        });
      } catch (error) {
        console.error("压缩图片失败:", error);
        // 降级：使用原始文件的 FileReader
        const reader = new FileReader();
        reader.onload = (ev) => {
          const fallbackUrl = ev.target?.result as string;
          setReportData({
            ...reportData,
            studentPhotos: reportData.studentPhotos.map(p => p.id === photoId ? { ...p, url: fallbackUrl } : p),
          });
        };
        reader.readAsDataURL(file);
      }
    })();
  };

  return {
    photoEditorOpen,
    photoEditorPhotos,
    openPhotoEditor,
    savePhotoEditor,
    removePhoto,
    addPhotos,
    closePhotoEditor,
    handlePhotoEdit,
    handlePhotoDelete,
    handlePhotoReplace,
  };
}
