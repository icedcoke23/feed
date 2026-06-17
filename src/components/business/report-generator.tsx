"use client";

import { Sparkles, Edit3, RefreshCw, Loader2, User, GraduationCap, Tag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { FeedbackStudent, GeneratedReport } from "@/types/feedback";

interface ReportGeneratorProps {
  selectedStudent: FeedbackStudent | undefined;
  selectedTheme: { name: string } | undefined;
  selectedTagsCount: number;
  generatedReport: GeneratedReport | null;
  generating: boolean;
  reviewing: boolean;
  onGenerate: () => void;
  onReview: () => void;
  onUpdateReport: (report: GeneratedReport) => void;
}

export function ReportGenerator({
  selectedStudent,
  selectedTheme,
  selectedTagsCount,
  generatedReport,
  generating,
  reviewing,
  onGenerate,
  onReview,
  onUpdateReport,
}: ReportGeneratorProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          生成反馈报告
        </CardTitle>
        <CardDescription>
          点击生成按钮，AI将根据学员信息和评价数据自动生成反馈报告，生成后可直接编辑修改
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 汇总信息 */}
        <div className="p-4 bg-gray-50 rounded-lg space-y-3">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-gray-500" />
            <span className="font-medium">{selectedStudent?.name}</span>
            <span className="text-gray-500">
              {selectedStudent?.grade}年级 {selectedStudent?.class_name}班
            </span>
          </div>
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-gray-500" />
            <span className="font-medium">{selectedTheme?.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-gray-500" />
            <span className="text-sm">
              已选择 <strong>{selectedTagsCount}</strong> 个评价维度
            </span>
          </div>
        </div>

        {!generatedReport ? (
          <Button onClick={onGenerate} disabled={generating} className="w-full" size="lg">
            {generating ? (
              <>
                <Sparkles className="h-4 w-4 mr-2 animate-pulse" />
                正在生成...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                生成反馈报告
              </>
            )}
          </Button>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
              <Edit3 className="h-4 w-4" />
              <span>可直接编辑下方内容</span>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-green-700 font-medium">学员优点</Label>
                <Textarea
                  className="mt-2 min-h-[100px]"
                  value={generatedReport.strengths}
                  onChange={(e) =>
                    onUpdateReport({ ...generatedReport, strengths: e.target.value })
                  }
                  placeholder="学员的优点表现..."
                />
              </div>

              <div>
                <Label className="text-blue-700 font-medium">能力提升</Label>
                <Textarea
                  className="mt-2 min-h-[100px]"
                  value={generatedReport.improvements}
                  onChange={(e) =>
                    onUpdateReport({ ...generatedReport, improvements: e.target.value })
                  }
                  placeholder="能力提升情况..."
                />
              </div>

              <div>
                <Label className="text-orange-700 font-medium">需要提升</Label>
                <Textarea
                  className="mt-2 min-h-[100px]"
                  value={generatedReport.weaknesses}
                  onChange={(e) =>
                    onUpdateReport({ ...generatedReport, weaknesses: e.target.value })
                  }
                  placeholder="需要提升的部分..."
                />
              </div>

              <div>
                <Label className="text-purple-700 font-medium">教学建议</Label>
                <Textarea
                  className="mt-2 min-h-[100px]"
                  value={generatedReport.recommendations}
                  onChange={(e) =>
                    onUpdateReport({ ...generatedReport, recommendations: e.target.value })
                  }
                  placeholder="后续教学建议..."
                />
              </div>

              <div>
                <Label className="text-gray-700 font-medium">总结</Label>
                <Textarea
                  className="mt-2 min-h-[80px]"
                  value={generatedReport.summary}
                  onChange={(e) =>
                    onUpdateReport({ ...generatedReport, summary: e.target.value })
                  }
                  placeholder="整体总结..."
                />
              </div>
            </div>

            {/* AI复检按钮 */}
            <Button
              onClick={onReview}
              disabled={reviewing}
              variant="outline"
              className="w-full"
            >
              {reviewing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  AI正在复检优化...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  AI二次复检优化
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
