"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Save } from "lucide-react";

export interface PdfToolbarProps {
  onBack: () => void;
  onSave: () => void;
  onPrint: () => void;
  saving: boolean;
  saved: boolean;
}

export function PdfToolbar({ onBack, onSave, onPrint, saving, saved }: PdfToolbarProps) {
  return (
    <div className="bg-white border-b sticky top-0 z-40 print:hidden">
      <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm sm:text-base"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">返回编辑</span>
            <span className="sm:hidden">返回</span>
          </button>
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-end">
            <Button
              onClick={onSave}
              disabled={saving || saved}
              variant="outline"
              size="sm"
              className="gap-1 sm:gap-2 h-8 sm:h-10"
            >
              <Save className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="text-xs sm:text-sm">{saving ? "保存中..." : saved ? "已保存" : "保存"}</span>
            </Button>
            <Button
              onClick={onPrint}
              size="sm"
              className="gap-1 sm:gap-2 bg-blue-600 hover:bg-blue-700 h-8 sm:h-10"
            >
              <Printer className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="text-xs sm:text-sm">打印/PDF</span>
            </Button>
          </div>
        </div>
        {/* 手机端导出提示 */}
        <div className="sm:hidden mt-2 p-2 bg-blue-50 rounded-lg text-xs text-blue-700">
          💡 提示：点击「打印/PDF」按钮，在弹出的打印界面中选择「保存为PDF」即可导出文档
        </div>
      </div>
    </div>
  );
}
