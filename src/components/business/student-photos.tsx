"use client";

import { useState, useCallback, useRef } from "react";
import { Camera, Trash2, X, Image as ImageIcon, Crop, Replace } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ImageCropDialog } from "@/components/business/image-crop-dialog";
import type { StudentPhoto } from "@/types/feedback";

interface StudentPhotosProps {
  studentPhotos: StudentPhoto[];
  uploadingPhoto: boolean;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: (id: string) => void;
  onClearAll: () => void;
  onReplacePhoto?: (id: string, croppedDataUrl: string) => void;
  onAddCroppedPhoto?: (croppedDataUrl: string) => void;
}

export function StudentPhotos({
  studentPhotos,
  uploadingPhoto,
  onUpload,
  onRemove,
  onClearAll,
  onReplacePhoto,
  onAddCroppedPhoto,
}: StudentPhotosProps) {
  // 裁剪对话框状态
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState("");
  const [cropMode, setCropMode] = useState<"add" | "replace" | "edit">("add");
  const [replacingPhotoId, setReplacingPhotoId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 替换照片：选择文件后直接替换（不弹裁剪框）
  const handleReplaceFileSelect = useCallback(
    (photoId: string, e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !file.type.startsWith("image/")) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (onReplacePhoto) {
          onReplacePhoto(photoId, dataUrl);
        }
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    },
    [onReplacePhoto]
  );

  // 裁剪已有照片：读取当前照片URL，打开裁剪对话框
  const handleCropPhoto = useCallback(
    (photo: StudentPhoto) => {
      setCropImageSrc(photo.url);
      setCropMode("edit");
      setReplacingPhotoId(photo.id);
      setCropDialogOpen(true);
    },
    []
  );

  // 裁剪完成回调
  const handleCropComplete = useCallback(
    (croppedDataUrl: string) => {
      if ((cropMode === "replace" || cropMode === "edit") && replacingPhotoId && onReplacePhoto) {
        onReplacePhoto(replacingPhotoId, croppedDataUrl);
      } else if (cropMode === "add" && onAddCroppedPhoto) {
        onAddCroppedPhoto(croppedDataUrl);
      }
      setCropDialogOpen(false);
      setCropImageSrc("");
      setReplacingPhotoId(null);
    },
    [cropMode, replacingPhotoId, onReplacePhoto, onAddCroppedPhoto]
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
            onChange={onUpload}
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
                onClick={onClearAll}
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
                      onClick={() => onRemove(photo.id)}
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
