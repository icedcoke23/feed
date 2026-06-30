"use client";

import { useCallback, useEffect, useRef } from "react";
import { Calendar, CheckCircle2, X, Plus, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FeedbackTeacher, CoursePlan, CourseStagePreset } from "@/types/feedback";
import { CoursePlanRow, type StageStatus } from "@/components/business/course-plan-row";

interface CoursePlanEditorProps {
  teachers: FeedbackTeacher[];
  adminTeachers: FeedbackTeacher[];
  courseStagePresets: CourseStagePreset[];
  selectedTeacherId: string;
  selectedAdminTeacherId: string;
  hasCoursePlan: boolean | null;
  coursePlans: CoursePlan[];
  currentStageId: string | null;
  onSelectTeacher: (id: string) => void;
  onSelectAdminTeacher: (id: string) => void;
  onSetHasCoursePlan: (val: boolean | null) => void;
  onSetCoursePlans: (plans: CoursePlan[]) => void;
  onSetCurrentStageId: (id: string | null) => void;
}

export function CoursePlanEditor({
  teachers,
  adminTeachers,
  courseStagePresets,
  selectedTeacherId,
  selectedAdminTeacherId,
  hasCoursePlan,
  coursePlans,
  currentStageId,
  onSelectTeacher,
  onSelectAdminTeacher,
  onSetHasCoursePlan,
  onSetCoursePlans,
  onSetCurrentStageId,
}: CoursePlanEditorProps) {
  // latest-ref：保持回调引用稳定，避免 CoursePlanRow 因回调变化而全量 re-render。
  // ref 在 effect 中同步（React 19 禁止 render 阶段写 ref），回调读取最新值。
  const coursePlansRef = useRef(coursePlans);
  useEffect(() => {
    coursePlansRef.current = coursePlans;
  }, [coursePlans]);
  const currentStageIdRef = useRef(currentStageId);
  useEffect(() => {
    currentStageIdRef.current = currentStageId;
  }, [currentStageId]);

  const handleFieldChange = useCallback(
    (planId: string, field: keyof CoursePlan, value: string) => {
      // 不可变更新：仅被修改的行获得新对象引用，其余行引用不变，被 memo 拦截
      onSetCoursePlans(
        coursePlansRef.current.map((p) => (p.id === planId ? { ...p, [field]: value } : p))
      );
    },
    [onSetCoursePlans]
  );

  const handleDelete = useCallback(
    (planId: string) => {
      onSetCoursePlans(coursePlansRef.current.filter((p) => p.id !== planId));
      if (planId === currentStageIdRef.current) {
        onSetCurrentStageId(null);
      }
    },
    [onSetCoursePlans, onSetCurrentStageId]
  );

  const handleToggleCurrent = useCallback(
    (planId: string) => {
      onSetCurrentStageId(currentStageIdRef.current === planId ? null : planId);
    },
    [onSetCurrentStageId]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          课程规划
        </CardTitle>
        <CardDescription>
          选择课程阶段和主题，设置教师信息。可从预设中选择或自定义课程规划。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 教师选择 */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>授课教师</Label>
            <Select value={selectedTeacherId} onValueChange={onSelectTeacher}>
              <SelectTrigger>
                <SelectValue placeholder="请选择教师" />
              </SelectTrigger>
              <SelectContent>
                {teachers.map((teacher) => (
                  <SelectItem key={teacher.id} value={teacher.id}>
                    {teacher.name}
                    {teacher.phone ? ` (${teacher.phone})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>教务老师</Label>
            <Select value={selectedAdminTeacherId} onValueChange={onSelectAdminTeacher}>
              <SelectTrigger>
                <SelectValue placeholder="请选择教务老师" />
              </SelectTrigger>
              <SelectContent>
                {adminTeachers.map((teacher) => (
                  <SelectItem key={teacher.id} value={teacher.id}>
                    {teacher.name}
                    {teacher.phone ? ` (${teacher.phone})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 选择是否添加课程规划 */}
        {hasCoursePlan === null && (
          <div className="flex gap-4 justify-center py-8">
            <Button onClick={() => onSetHasCoursePlan(true)} className="h-16 px-8" variant="outline">
              <CheckCircle2 className="h-5 w-5 mr-2" />
              是，添加课程规划
            </Button>
            <Button
              onClick={() => {
                onSetHasCoursePlan(false);
                onSetCoursePlans([]);
              }}
              className="h-16 px-8"
              variant="outline"
            >
              <X className="h-5 w-5 mr-2" />
              否，跳过此步骤
            </Button>
          </div>
        )}

        {/* 课程规划编辑区域 */}
        {hasCoursePlan === true && (
          <div className="space-y-4">
            {courseStagePresets.length > 0 && (
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-700 mb-3 flex items-center gap-2">
                  <GraduationCap className="h-4 w-4" />
                  从预设中选择课程阶段
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  {[...new Set(courseStagePresets.map((s) => s.theme))]
                    .sort()
                    .map((theme) => (
                      <div key={theme}>
                        <p className="text-xs font-medium text-gray-600 mb-1">{theme}</p>
                        <div className="space-y-1">
                          {courseStagePresets
                            .filter((s) => s.theme === theme)
                            .sort((a, b) => {
                              const levelOrder: Record<string, number> = {
                                beginner: 1,
                                intermediate: 2,
                                advanced: 3,
                                专家: 4,
                                expert: 4,
                              };
                              return (
                                (levelOrder[a.level as keyof typeof levelOrder] || 99) -
                                (levelOrder[b.level as keyof typeof levelOrder] || 99)
                              );
                            })
                            .map((preset) => (
                              <Button
                                key={preset.id}
                                variant="outline"
                                size="sm"
                                className="w-full justify-start text-xs h-8"
                                onClick={() => {
                                  if (coursePlans.some((p) => p.stage === preset.stage_name)) {
                                    toast.warning("该阶段已添加");
                                    return;
                                  }
                                  const newPlan: CoursePlan = {
                                    id: `plan-${Date.now()}`,
                                    stage: preset.stage_name,
                                    theme: preset.theme,
                                    content: preset.content || "",
                                    goal: preset.goal || "",
                                  };
                                  onSetCoursePlans([...coursePlans, newPlan]);
                                  toast.success(`已添加 ${preset.stage_name}`);
                                }}
                              >
                                {preset.stage_name}
                              </Button>
                            ))}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <h3 className="font-medium text-gray-700">教学计划（课程大纲）</h3>
              <Button
                onClick={() => {
                  const newPlan: CoursePlan = {
                    id: `plan-${Date.now()}`,
                    stage: "",
                    theme: "",
                    content: "",
                    goal: "",
                  };
                  onSetCoursePlans([...coursePlans, newPlan]);
                }}
                variant="outline"
                size="sm"
              >
                <Plus className="h-4 w-4 mr-1" />
                自定义添加
              </Button>
            </div>

            {coursePlans.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                暂无课程规划，点击上方预设按钮或&quot;自定义添加&quot;开始规划
              </div>
            )}

            {coursePlans.map((plan) => {
              // 在外层计算 stageStatus 作为基本类型 prop 传入，避免 Row 引用整个数组
              const getStageStatus = (): StageStatus => {
                if (plan.id === currentStageId) return "current";
                const currentIndex = coursePlans.findIndex((p) => p.id === currentStageId);
                if (currentIndex === -1) return "upcoming";
                const planIndex = coursePlans.findIndex((p) => p.id === plan.id);
                return planIndex < currentIndex ? "completed" : "upcoming";
              };

              return (
                <CoursePlanRow
                  key={plan.id}
                  plan={plan}
                  stageStatus={getStageStatus()}
                  isCurrentStage={plan.id === currentStageId}
                  hasCurrentStage={!!currentStageId}
                  onFieldChange={handleFieldChange}
                  onDelete={handleDelete}
                  onToggleCurrent={handleToggleCurrent}
                />
              );
            })}

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => onSetHasCoursePlan(null)}>
                重新选择
              </Button>
            </div>
          </div>
        )}

        {hasCoursePlan === false && (
          <div className="text-center py-8 text-gray-500">
            已选择跳过课程规划，报告将不包含此部分内容
          </div>
        )}
      </CardContent>
    </Card>
  );
}
