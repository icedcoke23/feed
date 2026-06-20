"use client";

import { useState, useCallback, useRef } from "react";
import { Camera, Trash2, X, Image as ImageIcon, Crop, Replace } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ImageCropDialog } from "@/components/business/image-crop-dialog";
import { compressImage } from "@/utils/compress-image";
import { toast } from "sonner";
import type { StudentPhoto } from "@/types/feedback";

interface StudentPhotosProps {
  studentPhotos: StudentPhoto[];
  onPhotosChange: (photos: StudentPhoto[]) => void;
}

function generatePhotoId() {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

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

export function StudentPhotos({
  studentPhotos,
  onPhotosChange,
}: StudentPhotosProps) {
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // 裁剪对话框状态
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState("");
  const [cropMode, setCropMode] = useState<"add" | "replace" | "edit">("add");
  const [replacingPhotoId, setReplacingPhotoId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 统一更新父组件状态
  const updatePhotos = useCallback((nextPhotos: StudentPhoto[]) => {
    onPhotosChange(nextPhotos);
  }, [onPhotosChange]);

  // 上传文件：压缩后转换为 data URL，立即更新父组件状态
  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const remainingSlots = 10 - studentPhotos.length;
      if (remainingSlots <= 0) {
        toast.error("最多只能上传10张照片");
        return;
      }

      const filesToProcess = Array.from(files).slice(0, remainingSlots);
      setUploadingPhoto(true);

      try {
        const newPhotos: StudentPhoto[] = [];

        await Promise.all(
          filesToProcess.map(async (file) => {
            if (!file.type.startsWith("image/")) {
              toast.error(`${file.name} 不是图片文件`);
              return;
            }

            try {
              const compressedFile = await compressImage(file, 1200, 0.7);
              const dataUrl = await readFileAsDataURL(compressedFile);
              newPhotos.push({
                id: generatePhotoId(),
                url: dataUrl,
                file: compressedFile,
              });
            } catch (error) {
              console.error(`处理图片 ${file.name} 失败:`, error);
              toast.error(`${file.name} 处理失败`);
            }
          })
        );

        if (newPhotos.length > 0) {
          updatePhotos([...studentPhotos, ...newPhotos]);
          toast.success(`成功添加 ${newPhotos.length} 张照片`);
        }
      } catch (error) {
        console.error("Photo upload error:", error);
        toast.error("上传失败，请重试");
      } finally {
        setUploadingPhoto(false);
        e.target.value = "";
      }
    },
    [studentPhotos, updatePhotos]
  );

  // 删除照片：释放 blob URL（如有）后更新状态
  const handleRemove = useCallback(
    (id: string) => {
      const target = studentPhotos.find((p) => p.id === id);
      if (target?.url?.startsWith("blob:")) {
        URL.revokeObjectURL(target.url);
      }
      updatePhotos(studentPhotos.filter((p) => p.id !== id));
    },
    [studentPhotos, updatePhotos]
  );

  // 清空全部
  const handleClearAll = useCallback(() => {
    studentPhotos.forEach((p) => {
      if (p.url?.startsWith("blob:")) {
        URL.revokeObjectURL(p.url);
      }
    });
    updatePhotos([]);
  }, [studentPhotos, updatePhotos]);

  // 替换照片：选择文件后直接替换（不弹裁剪框）
  const handleReplaceFileSelect = useCallback(
    (photoId: string, e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !file.type.startsWith("image/")) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        updatePhotos(
          studentPhotos.map((p) =>
            p.id === photoId ? { ...p, url: dataUrl, file: undefined } : p
          )
        );
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    },
    [studentPhotos, updatePhotos]
  );

  // 裁剪已有照片：读取当前照片URL，打开裁剪对话框
  const handleCropPhoto = useCallback((photo: StudentPhoto) => {
    setCropImageSrc(photo.url);
    setCropMode("edit");
    setReplacingPhotoId(photo.id);
    setCropDialogOpen(true);
  }, []);

  // 裁剪完成回调
  const handleCropComplete = useCallback(
    (croppedDataUrl: string) => {
      if ((cropMode === "replace" || cropMode === "edit") && replacingPhotoId) {
        updatePhotos(
          studentPhotos.map((p) =>
            p.id === replacingPhotoId ? { ...p, url: croppedDataUrl, file: undefined } : p
          )
        );
      } else if (cropMode === "add") {
        if (studentPhotos.length >= 10) {
          toast.error("最多只能上传10张照片");
        } else {
          updatePhotos([...studentPhotos, { id: generatePhotoId(), url: croppedDataUrl }]);
          toast.success("照片添加成功");
        }
      }
      setCropDialogOpen(false);
      setCropImageSrc("");
      setReplacingPhotoId(null);
    },
    [cropMode, replacingPhotoId, studentPhotos, updatePhotos]
  );

  // 裁剪对话框关闭
  const handleCropDialogClose = useCallback(() => {
    setCropDialogOpen(false);
    setCropImageSrc("");
    setReplacingPhotoId(null);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5" />
          学员风采
        </CardTitle>
        <CardDescription>上传学员照片（最多10张），将在PDF最后一页展示</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 上传区域 - 始终支持多选，直接上传 */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleUpload}
            className="hidden"
            ref={fileInputRef}
            disabled={studentPhotos.length >= 10 || uploadingPhoto}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer flex flex-col items-center gap-3 w-full ${
              studentPhotos.length >= 10 ? "opacity-50 cursor-not-allowed" : ""
            }`}
            disabled={studentPhotos.length >= 10 || uploadingPhoto}
          >
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <ImageIcon className="h-8 w-8 text-blue-500" />
            </div>
            <div>
              <p className="font-medium text-gray-700">点击或拖拽上传照片（支持多选）</p>
              <p className="text-sm text-gray-500 mt-1">支持 JPG、PNG 格式，上传后可裁剪编辑</p>
              <p className="text-sm text-blue-600 mt-1">
                已上传 {studentPhotos.length} / 10 张
              </p>
            </div>
          </button>
        </div>

        {/* 照片预览 - CSS Grid 布局 */}
        {studentPhotos.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>已上传照片</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAll}
                className="text-red-500 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                清空全部
              </Button>
            </div>
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: "repeat(3, 1fr)" }}
            >
              {studentPhotos.map((photo, index) => (
                <div
                  key={photo.id}
                  className="relative group rounded-lg overflow-hidden border bg-gray-50"
                  style={{ aspectRatio: "4/3" }}
                >
                  {/* 用户上传照片，URL 为动态/数据地址，无法使用 Next.js Image */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.url}
                    alt={`学员照片 ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {/* 序号标签 */}
                  <div className="absolute top-1 left-1 bg-black/60 text-white text-xs px-2 py-0.5 rounded">
                    {index + 1}
                  </div>
                  {/* hover 操作按钮：裁剪 + 替换 + 删除 */}
                  <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => handleCropPhoto(photo)}
                      className="h-7 w-7 flex items-center justify-center rounded bg-green-500 text-white hover:bg-green-600 transition-colors"
                      title="裁剪照片"
                    >
                      <Crop className="h-3.5 w-3.5" />
                    </button>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleReplaceFileSelect(photo.id, e)}
                      className="hidden"
                      id={`replace-${photo.id}`}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const input = document.getElementById(`replace-${photo.id}`) as HTMLInputElement;
                        input?.click();
                      }}
                      className="h-7 w-7 flex items-center justify-center rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                      title="替换照片"
                    >
                      <Replace className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(photo.id)}
                      className="h-7 w-7 flex items-center justify-center rounded bg-red-500 text-white hover:bg-red-600 transition-colors"
                      title="删除照片"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 跳过提示 */}
        {studentPhotos.length === 0 && (
          <div className="p-4 bg-gray-50 rounded-lg text-center">
            <p className="text-gray-500 text-sm">
              不上传照片也可以继续，学员风采页将不会显示在PDF中
            </p>
          </div>
        )}

        {/* 裁剪对话框 */}
        {cropImageSrc && (
          <ImageCropDialog
            open={cropDialogOpen}
            onClose={handleCropDialogClose}
            imageSrc={cropImageSrc}
            onCropComplete={handleCropComplete}
            title={cropMode === "edit" ? "裁剪照片" : cropMode === "replace" ? "替换照片 - 裁剪" : "上传照片 - 裁剪"}
          />
        )}
      </CardContent>
    </Card>
  );
}
