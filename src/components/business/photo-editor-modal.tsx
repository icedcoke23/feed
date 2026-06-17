"use client";

import React, { useRef } from "react";
import { X } from "lucide-react";

export interface PhotoEditorModalProps {
  photos: Array<{ id: string; url: string }>;
  onRemovePhoto: (id: string) => void;
  onAddPhotos: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function PhotoEditorModal({ photos, onRemovePhoto, onAddPhotos, onSave, onCancel }: PhotoEditorModalProps) {
  const photoInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center print:hidden">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-bold text-lg">管理照片</h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-3 gap-3 mb-4">
            {photos.map((photo, index) => (
              <div key={photo.id} className="relative group rounded-lg overflow-hidden border bg-gray-50" style={{ aspectRatio: "4/3" }}>
                <img src={photo.url} alt={`照片 ${index + 1}`} className="w-full h-full object-cover" />
                <button onClick={() => onRemovePhoto(photo.id)} className="absolute top-1 right-1 h-6 w-6 flex items-center justify-center rounded bg-red-500 text-white hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity" title="删除">
                  <X className="h-3 w-3" />
                </button>
                <div className="absolute top-1 left-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">{index + 1}</div>
              </div>
            ))}
          </div>
          <input type="file" accept="image/*" multiple onChange={onAddPhotos} className="hidden" ref={photoInputRef} />
          <button onClick={() => photoInputRef.current?.click()} className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 text-center text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors" disabled={photos.length >= 10}>
            + 添加照片（支持多选）
          </button>
          <p className="text-xs text-gray-400 mt-2 text-center">已选 {photos.length} / 10 张 | 裁剪/替换/缩放请关闭弹窗后在页面上操作</p>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t">
          <button onClick={onCancel} className="px-4 py-2 bg-gray-200 text-gray-600 rounded hover:bg-gray-300">取消</button>
          <button onClick={onSave} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">保存</button>
        </div>
      </div>
    </div>
  );
}
