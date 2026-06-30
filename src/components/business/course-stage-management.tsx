"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Edit,
  Trash2,
  BookOpen,
  GraduationCap,
  Save,
  Loader2,
  RefreshCw,
} from "lucide-react";
import type { CourseStage } from "@/types/settings";
import { THEME_OPTIONS, LEVEL_OPTIONS } from "@/types/settings";

interface CourseStageManagementProps {
  courseStages: CourseStage[];
  loading: boolean;
  saving: boolean;
  onSave: (editingStage: Partial<CourseStage>, isAdding: boolean) => Promise<boolean>;
  onDelete: (id: string) => void;
  onAddDefaultPresets: () => void;
  onResetToPresets: () => void;
}

function getLevelBadge(level: string) {
  switch (level) {
    case "beginner":
      return <Badge className="bg-green-100 text-green-700">初阶</Badge>;
    case "intermediate":
      return <Badge className="bg-blue-100 text-blue-700">中阶</Badge>;
    case "advanced":
      return <Badge className="bg-purple-100 text-purple-700">高阶</Badge>;
    case "foundation":
      return <Badge className="bg-orange-100 text-orange-700">一年</Badge>;
    default:
      return <Badge>{level}</Badge>;
  }
}

export function CourseStageManagement({
  courseStages,
  loading,
  saving,
  onSave,
  onDelete,
  onAddDefaultPresets,
  onResetToPresets,
}: CourseStageManagementProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<Partial<CourseStage>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [customTheme, setCustomTheme] = useState("");
  const [customLevel, setCustomLevel] = useState("");

  const openEditDialog = (stage?: CourseStage) => {
    if (stage) {
      setEditingStage(stage);
      const isCustomTheme = !THEME_OPTIONS.some(opt => opt.value === stage.theme && opt.value !== "other");
      const isCustomLevel = !LEVEL_OPTIONS.some(opt => opt.value === stage.level && opt.value !== "other");
      setCustomTheme(isCustomTheme ? stage.theme : "");
      setCustomLevel(isCustomLevel ? stage.level : "");
      setIsAdding(false);
    } else {
      setEditingStage({
        theme: "Scratch",
        level: "beginner",
        sort_order: courseStages.length + 1,
        is_active: true,
      });
      setCustomTheme("");
      setCustomLevel("");
      setIsAdding(true);
    }
    setIsEditDialogOpen(true);
  };

  const handleSave = async () => {
    const success = await onSave(editingStage, isAdding);
    if (success) {
      setIsEditDialogOpen(false);
    }
  };

  const groupedStages = courseStages.reduce((acc, stage) => {
    if (!acc[stage.theme]) acc[stage.theme] = [];
    acc[stage.theme].push(stage);
    return acc;
  }, {} as Record<string, CourseStage[]>);

  return (
    <div className="space-y-6">
      <div className="flex gap-4 flex-wrap">
        <Button onClick={() => openEditDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          添加课程阶段
        </Button>
        {courseStages.length === 0 && (
          <Button variant="outline" onClick={onAddDefaultPresets} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            添加默认预设
          </Button>
        )}
        <Button
          variant="outline"
          onClick={onResetToPresets}
          disabled={saving}
          className="text-orange-600 border-orange-300 hover:bg-orange-50"
        >
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          重置为默认预设
        </Button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-1/4" />
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : courseStages.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <GraduationCap className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">暂无课程阶段预设</p>
            <p className="text-sm text-gray-400 mt-2">点击“添加默认预设”快速添加Scratch/Python/C++的预设，或手动添加</p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(groupedStages).map(([theme, stages]) => (
          <Card key={theme}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                {theme} 课程阶段
                <Badge variant="secondary">{stages.length}个</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stages.sort((a, b) => a.sort_order - b.sort_order).map((stage) => (
                  <div
                    key={stage.id}
                    className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-medium">{stage.stage_name}</span>
                          {getLevelBadge(stage.level)}
                        </div>
                        {stage.description && (
                          <p className="text-sm text-gray-600 mb-2">{stage.description}</p>
                        )}
                        {stage.content && (
                          <div className="text-sm text-gray-500">
                            <span className="font-medium">教学内容：</span>
                            {stage.content}
                          </div>
                        )}
                        {stage.goal && (
                          <div className="text-sm text-gray-500 mt-1">
                            <span className="font-medium">项目目标：</span>
                            {stage.goal}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(stage)}
                          aria-label="编辑课程阶段"
                          title="编辑课程阶段"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => onDelete(stage.id)}
                          aria-label="删除课程阶段"
                          title="删除课程阶段"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {/* 编辑对话框 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isAdding ? "添加课程阶段" : "编辑课程阶段"}</DialogTitle>
            <DialogDescription>
              配置课程阶段的详细信息，包括教学内容和项目目标
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="course-stage-name">阶段名称 *</Label>
                <Input
                  id="course-stage-name"
                  value={editingStage.stage_name || ""}
                  onChange={(e) => setEditingStage({ ...editingStage, stage_name: e.target.value })}
                  placeholder="如：Scratch初阶"
                  aria-required="true"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="course-stage-code">阶段代码</Label>
                <Input
                  id="course-stage-code"
                  value={editingStage.stage_code || ""}
                  onChange={(e) => setEditingStage({ ...editingStage, stage_code: e.target.value })}
                  placeholder="如：scratch_beginner"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="course-stage-theme">主题 *</Label>
                <Select
                  value={editingStage.theme === "other" || !editingStage.theme ? "other" : (THEME_OPTIONS.some(opt => opt.value === editingStage.theme) ? editingStage.theme : "other")}
                  onValueChange={(v) => {
                    if (v === "other") {
                      setEditingStage({ ...editingStage, theme: customTheme || "" });
                    } else {
                      setEditingStage({ ...editingStage, theme: v });
                      setCustomTheme("");
                    }
                  }}
                >
                  <SelectTrigger id="course-stage-theme" aria-required="true">
                    <SelectValue placeholder="选择主题" />
                  </SelectTrigger>
                  <SelectContent>
                    {THEME_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(editingStage.theme === "other" || !THEME_OPTIONS.some(opt => opt.value === editingStage.theme && opt.value !== "other")) && (
                  <Input
                    value={customTheme}
                    onChange={(e) => {
                      setCustomTheme(e.target.value);
                      setEditingStage({ ...editingStage, theme: e.target.value });
                    }}
                    placeholder="输入自定义主题"
                    className="mt-2"
                    aria-label="自定义主题"
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="course-stage-level">难度级别 *</Label>
                <Select
                  value={editingStage.level === "other" || !editingStage.level ? "other" : (LEVEL_OPTIONS.some(opt => opt.value === editingStage.level) ? editingStage.level : "other")}
                  onValueChange={(v) => {
                    if (v === "other") {
                      setEditingStage({ ...editingStage, level: customLevel || "" });
                    } else {
                      setEditingStage({ ...editingStage, level: v });
                      setCustomLevel("");
                    }
                  }}
                >
                  <SelectTrigger id="course-stage-level" aria-required="true">
                    <SelectValue placeholder="选择级别" />
                  </SelectTrigger>
                  <SelectContent>
                    {LEVEL_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(editingStage.level === "other" || !LEVEL_OPTIONS.some(opt => opt.value === editingStage.level && opt.value !== "other")) && (
                  <Input
                    value={customLevel}
                    onChange={(e) => {
                      setCustomLevel(e.target.value);
                      setEditingStage({ ...editingStage, level: e.target.value });
                    }}
                    placeholder="输入自定义级别"
                    className="mt-2"
                    aria-label="自定义级别"
                  />
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="course-stage-description">描述</Label>
              <Textarea
                id="course-stage-description"
                value={editingStage.description || ""}
                onChange={(e) => setEditingStage({ ...editingStage, description: e.target.value })}
                placeholder="简要描述这个阶段的学习内容和目标"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="course-stage-content">教学内容</Label>
              <Textarea
                id="course-stage-content"
                value={editingStage.content || ""}
                onChange={(e) => setEditingStage({ ...editingStage, content: e.target.value })}
                placeholder="详细列出教学内容，如：实验类型、学科属性、知识点等"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="course-stage-goal">项目目标</Label>
              <Textarea
                id="course-stage-goal"
                value={editingStage.goal || ""}
                onChange={(e) => setEditingStage({ ...editingStage, goal: e.target.value })}
                placeholder="描述学员完成本阶段后应达到的学习目标和成果"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="course-stage-sort-order">排序</Label>
              <Input
                id="course-stage-sort-order"
                type="number"
                value={editingStage.sort_order || 0}
                onChange={(e) => setEditingStage({ ...editingStage, sort_order: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
