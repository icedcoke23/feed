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
  Plus,
  Edit,
  Trash2,
  Palette,
  Save,
  Loader2,
} from "lucide-react";
import type { Theme } from "@/types/settings";

interface ThemeManagementProps {
  themes: Theme[];
  loading: boolean;
  saving: boolean;
  onSave: (editingTheme: Partial<Theme>, isAdding: boolean) => Promise<boolean>;
  onDelete: (id: string) => void;
}

export function ThemeManagement({
  themes,
  loading,
  saving,
  onSave,
  onDelete,
}: ThemeManagementProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingTheme, setEditingTheme] = useState<Partial<Theme>>({});
  const [isAdding, setIsAdding] = useState(false);

  const openEditDialog = (theme?: Theme) => {
    if (theme) {
      setEditingTheme(theme);
      setIsAdding(false);
    } else {
      setEditingTheme({
        category: "default",
        sort_order: themes.length + 1,
        is_active: true,
      });
      setIsAdding(true);
    }
    setIsEditDialogOpen(true);
  };

  const handleSave = async () => {
    const success = await onSave(editingTheme, isAdding);
    if (success) {
      setIsEditDialogOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <Button onClick={() => openEditDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          添加教学主题
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
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : themes.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Palette className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">暂无教学主题</p>
            <p className="text-sm text-gray-400 mt-2">点击"添加教学主题"创建新的主题</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              教学主题列表
              <Badge variant="secondary">{themes.length}个</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {themes.sort((a, b) => a.sort_order - b.sort_order).map((theme) => (
                <div
                  key={theme.id}
                  className="border rounded-lg p-3 hover:bg-gray-50 transition-colors flex items-center justify-between"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{theme.name}</span>
                      {theme.category && theme.category !== "default" && (
                        <Badge variant="outline" className="text-xs">{theme.category}</Badge>
                      )}
                    </div>
                    {theme.description && (
                      <p className="text-sm text-gray-500">{theme.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(theme)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700"
                      onClick={() => onDelete(theme.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 编辑对话框 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isAdding ? "添加教学主题" : "编辑教学主题"}</DialogTitle>
            <DialogDescription>
              配置教学主题的详细信息
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>主题名称 *</Label>
              <Input
                value={editingTheme.name || ""}
                onChange={(e) => setEditingTheme({ ...editingTheme, name: e.target.value })}
                placeholder="如：Scratch动画设计"
              />
            </div>

            <div className="space-y-2">
              <Label>分类</Label>
              <Input
                value={editingTheme.category || ""}
                onChange={(e) => setEditingTheme({ ...editingTheme, category: e.target.value })}
                placeholder="如：编程入门"
              />
            </div>

            <div className="space-y-2">
              <Label>描述</Label>
              <Textarea
                value={editingTheme.description || ""}
                onChange={(e) => setEditingTheme({ ...editingTheme, description: e.target.value })}
                placeholder="简要描述这个教学主题的内容"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>排序</Label>
              <Input
                type="number"
                value={editingTheme.sort_order || 0}
                onChange={(e) => setEditingTheme({ ...editingTheme, sort_order: parseInt(e.target.value) || 0 })}
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
