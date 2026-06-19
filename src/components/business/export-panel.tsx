"use client";

import { Download, CheckCircle2, Save, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ExportPanelProps {
  saving?: boolean;
  saved?: boolean;
  onExport: () => void;
  onSaveFeedback: () => void;
}

export function ExportPanel({ saving, saved, onExport, onSaveFeedback }: ExportPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          导出文档
        </CardTitle>
        <CardDescription>确认反馈内容后，保存到数据库或导出 PDF</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="p-4 bg-green-50 rounded-lg flex items-center gap-3">
          <CheckCircle2 className="h-6 w-6 text-green-500" />
          <div>
            <p className="font-medium text-green-700">反馈报告已生成完成</p>
            <p className="text-sm text-green-600">保存到数据库后可随时查看，也可直接导出 PDF</p>
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

        <Button
          onClick={onExport}
          className="w-full h-12 text-base"
        >
          <Download className="h-5 w-5 mr-2" />
          导出 PDF
        </Button>
      </CardContent>
    </Card>
  );
}
