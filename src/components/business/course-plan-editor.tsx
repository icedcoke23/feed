"use client";

import { Calendar, CheckCircle2, X, Plus, Trash2, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FeedbackTeacher, CoursePlan, CourseStagePreset } from "@/types/feedback";

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

            {coursePlans.map((plan, index) => {
              const getStageStatus = () => {
                if (plan.id === currentStageId) return "current";
                const currentIndex = coursePlans.findIndex((p) => p.id === currentStageId);
                if (currentIndex === -1) return "upcoming";
                const planIndex = coursePlans.findIndex((p) => p.id === plan.id);
                return planIndex < currentIndex ? "completed" : "upcoming";
              };
              const stageStatus = getStageStatus();

              return (
                <div
                  key={plan.id}
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
                    {stageStatus === "upcoming" && currentStageId && (
                      <Badge variant="outline" className="text-gray-500 text-xs">
                        待学内容
                      </Badge>
                    )}
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-2 text-gray-400 hover:text-red-500"
                    onClick={() => {
                      const newPlans = coursePlans.filter((p) => p.id !== plan.id);
                      onSetCoursePlans(newPlans);
                      if (plan.id === currentStageId) {
                        onSetCurrentStageId(null);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>

                  <div className="flex justify-end pt-4">
                    <Button
                      variant={plan.id === currentStageId ? "default" : "outline"}
                      size="sm"
                      className={plan.id === currentStageId ? "bg-blue-500 hover:bg-blue-600" : ""}
                      onClick={() => {
                        onSetCurrentStageId(plan.id === currentStageId ? null : plan.id);
                      }}
                    >
                      {plan.id === currentStageId ? "✓ 当前阶段" : "设为当前阶段"}
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-gray-500">阶段(单元)</Label>
                      <Input
                        value={plan.stage || ""}
                        onChange={(e) => {
                          const updated = [...coursePlans];
                          updated[index].stage = e.target.value;
                          onSetCoursePlans(updated);
                        }}
                        placeholder="如：Scratch初阶"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">主题</Label>
                      <Input
                        value={plan.theme || ""}
                        onChange={(e) => {
                          const updated = [...coursePlans];
                          updated[index].theme = e.target.value;
                          onSetCoursePlans(updated);
                        }}
                        placeholder="如：Scratch"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-gray-500">教学内容</Label>
                    <Textarea
                      value={plan.content || ""}
                      onChange={(e) => {
                        const updated = [...coursePlans];
                        updated[index].content = e.target.value;
                        onSetCoursePlans(updated);
                      }}
                      placeholder="实验类型、学科属性、知识点等..."
                      className="min-h-[80px]"
                    />
                  </div>

                  <div>
                    <Label className="text-xs text-gray-500">项目目标</Label>
                    <Textarea
                      value={plan.goal || ""}
                      onChange={(e) => {
                        const updated = [...coursePlans];
                        updated[index].goal = e.target.value;
                        onSetCoursePlans(updated);
                      }}
                      placeholder="教学目标和学习成果..."
                      className="min-h-[60px]"
                    />
                  </div>
                </div>
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
