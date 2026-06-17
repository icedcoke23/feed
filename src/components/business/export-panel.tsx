"use client";

import { Download, CheckCircle2, FileDown, Save, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ExportPanelProps {
  exporting: boolean;
  saving?: boolean;
  saved?: boolean;
  onExportWord: () => void;
  onExportPDF: () => void;
  onSaveFeedback: () => void;
}

export function ExportPanel({ exporting, saving, saved, onExportWord, onExportPDF, onSaveFeedback }: ExportPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          导出文档
        </CardTitle>
        <CardDescription>确认反馈内容后，保存到数据库或选择导出格式</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="p-4 bg-green-50 rounded-lg flex items-center gap-3">
          <CheckCircle2 className="h-6 w-6 text-green-500" />
          <div>
            <p className="font-medium text-green-700">反馈报告已生成完成</p>
            <p className="text-sm text-green-600">保存到数据库后可随时查看，也可直接导出文档</p>
          </div>
        </div>

        {/* 保存反馈按钮 */}
        <Button
          onClick={onSaveFeedback}
          disabled={saving || saved}
          className="w-full h-12 text-base"
          variant={saved ? "outline" : "default"}
        >
          {saving ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              保存中...
            </>
          ) : saved ? (
            <>
              <CheckCircle2 className="h-5 w-5 mr-2" />
              已保存
            </>
          ) : (
            <>
              <Save className="h-5 w-5 mr-2" />
              保存反馈
            </>
          )}
        </Button>

        <div className="grid grid-cols-2 gap-2 sm:gap-4">
          <Button
            onClick={onExportWord}
            disabled={exporting}
            variant="outline"
            className="h-16 sm:h-20 flex-col gap-1 sm:gap-2"
          >
            <FileDown className="h-5 w-5 sm:h-6 sm:w-6" />
            <span className="text-xs sm:text-sm">导出Word</span>
          </Button>
          <Button
            onClick={onExportPDF}
            disabled={exporting}
            className="h-16 sm:h-20 flex-col gap-1 sm:gap-2"
          >
            <Download className="h-5 w-5 sm:h-6 sm:w-6" />
            <span className="text-xs sm:text-sm">导出PDF</span>
          </Button>
        </div>

        {exporting && (
          <div className="text-center text-sm text-gray-500">正在生成文档，请稍候...</div>
        )}
      </CardContent>
    </Card>
  );
}
