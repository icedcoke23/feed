"use client";

import { memo } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { CoursePlan } from "@/types/feedback";

export type StageStatus = "current" | "completed" | "upcoming";

interface CoursePlanRowProps {
  plan: CoursePlan;
  stageStatus: StageStatus;
  isCurrentStage: boolean;
  hasCurrentStage: boolean;
  onFieldChange: (planId: string, field: keyof CoursePlan, value: string) => void;
  onDelete: (planId: string) => void;
  onToggleCurrent: (planId: string) => void;
}

/**
 * 单个课程规划行。
 * 从 CoursePlanEditor 抽取并 memo，避免在某个行输入时全量重渲染。
 * 配合父组件的 latest-ref 稳定回调和不可变更新，仅被编辑的行会 re-render。
 */
export const CoursePlanRow = memo(function CoursePlanRow({
  plan,
  stageStatus,
  isCurrentStage,
  hasCurrentStage,
  onFieldChange,
  onDelete,
  onToggleCurrent,
}: CoursePlanRowProps) {
  return (
    <div
      className={`border rounded-lg p-4 space-y-3 relative transition-all ${
        stageStatus === "current"
          ? "border-blue-500 bg-blue-50 shadow-md"
          : stageStatus === "completed"
            ? "border-green-300 bg-green-50/50"
            : "border-gray-200"
      }`}
    >
      <div className="absolute left-2 -top-2">
        {stageStatus === "current" && (
          <Badge className="bg-blue-500 text-white text-xs">当前阶段</Badge>
        )}
        {stageStatus === "completed" && (
          <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
            已学内容
          </Badge>
        )}
        {stageStatus === "upcoming" && hasCurrentStage && (
          <Badge variant="outline" className="text-gray-500 text-xs">
            待学内容
          </Badge>
        )}
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="absolute right-2 top-2 text-gray-400 hover:text-red-500"
        onClick={() => onDelete(plan.id)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      <div className="flex justify-end pt-4">
        <Button
          variant={isCurrentStage ? "default" : "outline"}
          size="sm"
          className={isCurrentStage ? "bg-blue-500 hover:bg-blue-600" : ""}
          onClick={() => onToggleCurrent(plan.id)}
        >
          {isCurrentStage ? "✓ 当前阶段" : "设为当前阶段"}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-gray-500">阶段(单元)</Label>
          <Input
            value={plan.stage || ""}
            onChange={(e) => onFieldChange(plan.id, "stage", e.target.value)}
            placeholder="如：Scratch初阶"
          />
        </div>
        <div>
          <Label className="text-xs text-gray-500">主题</Label>
          <Input
            value={plan.theme || ""}
            onChange={(e) => onFieldChange(plan.id, "theme", e.target.value)}
            placeholder="如：Scratch"
          />
        </div>
      </div>

      <div>
        <Label className="text-xs text-gray-500">教学内容</Label>
        <Textarea
          value={plan.content || ""}
          onChange={(e) => onFieldChange(plan.id, "content", e.target.value)}
          placeholder="实验类型、学科属性、知识点等..."
          className="min-h-[80px]"
        />
      </div>

      <div>
        <Label className="text-xs text-gray-500">项目目标</Label>
        <Textarea
          value={plan.goal || ""}
          onChange={(e) => onFieldChange(plan.id, "goal", e.target.value)}
          placeholder="教学目标和学习成果..."
          className="min-h-[60px]"
        />
      </div>
    </div>
  );
});
