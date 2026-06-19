"use client";

import { useState, useEffect, useMemo } from "react";
import { Sparkles, Edit3, RefreshCw, Loader2, User, GraduationCap, Tag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiGet } from "@/utils/api";
import { toast } from "sonner";
import type { FeedbackStudent, GeneratedReport, CoursePlan } from "@/types/feedback";
import type { CoursePrompt } from "@/types/course-prompt";
import { DEFAULT_COURSE_STAGES } from "@/lib/constants/course-stages";

const AUTO_MATCH_VALUE = "__auto__";

const getStageName = (code: string) =>
  DEFAULT_COURSE_STAGES.find((s) => s.stage_code === code)?.stage_name || code;

const getStageCodeByName = (name: string) =>
  DEFAULT_COURSE_STAGES.find((s) => s.stage_name === name)?.stage_code;

interface ReportGeneratorProps {
  selectedStudent: FeedbackStudent | undefined;
  selectedTheme: { name: string } | undefined;
  selectedTagsCount: number;
  generatedReport: GeneratedReport | null;
  generating: boolean;
  reviewing: boolean;
  onGenerate: (promptStageCode?: string) => void;
  onReview: (promptStageCode?: string) => void;
  onUpdateReport: (report: GeneratedReport) => void;
  coursePlans?: CoursePlan[];
  currentStageId?: string | null;
  metadata?: Record<string, unknown> | null;
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
  coursePlans = [],
  currentStageId,
  metadata,
}: ReportGeneratorProps) {
  const [prompts, setPrompts] = useState<CoursePrompt[]>([]);
  const [promptsLoading, setPromptsLoading] = useState(false);
  const [selectedPromptStageCode, setSelectedPromptStageCode] = useState<string>(AUTO_MATCH_VALUE);

  useEffect(() => {
    let cancelled = false;

    const loadPrompts = async () => {
      setPromptsLoading(true);
      const { data, error } = await apiGet<CoursePrompt[]>("/api/course-prompts");
      if (!cancelled) {
        if (!error && data) {
          setPrompts(data);
        } else {
          toast.error("课程提示词加载失败");
        }
        setPromptsLoading(false);
      }
    };

    loadPrompts();

    return () => {
      cancelled = true;
    };
  }, []);

  const derivedStageCode = useMemo(() => {
    if (coursePlans.length === 0 || prompts.length === 0) {
      return AUTO_MATCH_VALUE;
    }

    const effectiveCurrentStageId =
      currentStageId || (metadata?.current_stage_id as string | undefined);

    const candidatePlans: (CoursePlan | undefined)[] = effectiveCurrentStageId
      ? [coursePlans.find((p) => p.id === effectiveCurrentStageId), coursePlans[0]]
      : [coursePlans[0]];

    for (const plan of candidatePlans) {
      if (!plan) continue;
      const matchedCode = plan.stage ? getStageCodeByName(plan.stage) : undefined;
      if (matchedCode && prompts.some((p) => p.stage_code === matchedCode)) {
        return matchedCode;
      }
    }

    return AUTO_MATCH_VALUE;
  }, [prompts, coursePlans, currentStageId, metadata]);

  const effectivePromptStageCode =
    selectedPromptStageCode === AUTO_MATCH_VALUE ? derivedStageCode : selectedPromptStageCode;

  const selectValue =
    selectedPromptStageCode === AUTO_MATCH_VALUE ? AUTO_MATCH_VALUE : selectedPromptStageCode;

  const handleGenerate = () => {
    onGenerate(effectivePromptStageCode === AUTO_MATCH_VALUE ? undefined : effectivePromptStageCode);
  };

  const handleReview = () => {
    onReview(effectivePromptStageCode === AUTO_MATCH_VALUE ? undefined : effectivePromptStageCode);
  };

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

        {/* 课程阶段提示词选择 */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <GraduationCap className="h-4 w-4" />
            课程阶段提示词
          </Label>
          <Select
            value={selectValue}
            onValueChange={setSelectedPromptStageCode}
            disabled={promptsLoading || prompts.length === 0}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="选择课程阶段提示词" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={AUTO_MATCH_VALUE}>自动匹配当前阶段</SelectItem>
              {prompts.map((prompt) => (
                <SelectItem key={prompt.id} value={prompt.stage_code}>
                  {getStageName(prompt.stage_code)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-500">
            默认根据当前课程阶段自动匹配，也可手动选择其他阶段的提示词
          </p>
          {typeof metadata?.promptStageCode === "string" && metadata.promptStageCode && (
            <p className="text-xs text-green-600">
              本次实际使用：{getStageName(metadata.promptStageCode)}
            </p>
          )}
        </div>

        {!generatedReport ? (
          <Button onClick={handleGenerate} disabled={generating} className="w-full" size="lg">
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
              onClick={handleReview}
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
