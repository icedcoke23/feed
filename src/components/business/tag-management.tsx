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
  Tag,
  CheckCircle2,
  ArrowRight,
  AlertCircle,
  Save,
  Loader2,
} from "lucide-react";
import type { Tag as TagType } from "@/types/settings";
import { TAG_CATEGORY_OPTIONS } from "@/types/settings";

const TAG_CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  strength: CheckCircle2,
  improvement: ArrowRight,
  weakness: AlertCircle,
};

interface TagManagementProps {
  tags: TagType[];
  loading: boolean;
  saving: boolean;
  onSave: (editingTag: Partial<TagType>, isAdding: boolean) => Promise<boolean>;
  onDelete: (id: string) => void;
}

export function TagManagement({
  tags,
  loading,
  saving,
  onSave,
  onDelete,
}: TagManagementProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Partial<TagType>>({});
  const [isAdding, setIsAdding] = useState(false);

  const openEditDialog = (tag?: TagType) => {
    if (tag) {
      setEditingTag(tag);
      setIsAdding(false);
    } else {
      setEditingTag({
        category: "strength",
        sort_order: tags.length + 1,
        is_active: true,
      });
      setIsAdding(true);
    }
    setIsEditDialogOpen(true);
  };

  const handleSave = async () => {
    const success = await onSave(editingTag, isAdding);
    if (success) {
      setIsEditDialogOpen(false);
    }
  };

  const groupedTags = tags.reduce((acc, tag) => {
    if (!acc[tag.category]) acc[tag.category] = [];
    acc[tag.category].push(tag);
    return acc;
  }, {} as Record<string, TagType[]>);

  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <Button onClick={() => openEditDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          添加标签
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
      ) : tags.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Tag className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">暂无标签</p>
            <p className="text-sm text-gray-400 mt-2">点击“添加标签”创建评价标签</p>
          </CardContent>
        </Card>
      ) : (
        TAG_CATEGORY_OPTIONS.map((category) => {
          const categoryTags = groupedTags[category.value] || [];
          if (categoryTags.length === 0) return null;

          const CategoryIcon = TAG_CATEGORY_ICONS[category.value] || CheckCircle2;

          return (
            <Card key={category.value}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CategoryIcon className="h-5 w-5" />
                  {category.label}
                  <Badge variant="secondary">{categoryTags.length}个</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {categoryTags.sort((a, b) => a.sort_order - b.sort_order).map((tag) => (
                    <div
                      key={tag.id}
                      className="border rounded-lg p-3 hover:bg-gray-50 transition-colors flex items-center justify-between"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{tag.name}</span>
                        </div>
                        {tag.description && (
                          <p className="text-sm text-gray-500">{tag.description}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(tag)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => onDelete(tag.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })
      )}

      {/* 编辑对话框 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isAdding ? "添加标签" : "编辑标签"}</DialogTitle>
            <DialogDescription>
              配置评价标签的详细信息
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>标签名称 *</Label>
              <Input
                value={editingTag.name || ""}
                onChange={(e) => setEditingTag({ ...editingTag, name: e.target.value })}
                placeholder="如：代码能力"
              />
            </div>

            <div className="space-y-2">
              <Label>分类 *</Label>
              <Select
                value={editingTag.category || ""}
                onValueChange={(v) => setEditingTag({ ...editingTag, category: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择分类" />
                </SelectTrigger>
                <SelectContent>
                  {TAG_CATEGORY_OPTIONS.map((opt) => {
                    const OptIcon = TAG_CATEGORY_ICONS[opt.value] || CheckCircle2;
                    return (
                      <SelectItem key={opt.value} value={opt.value}>
                        <div className="flex items-center gap-2">
                          <OptIcon className="h-4 w-4" />
                          {opt.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>描述</Label>
              <Textarea
                value={editingTag.description || ""}
                onChange={(e) => setEditingTag({ ...editingTag, description: e.target.value })}
                placeholder="简要描述这个标签的含义"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>排序</Label>
              <Input
                type="number"
                value={editingTag.sort_order || 0}
                onChange={(e) => setEditingTag({ ...editingTag, sort_order: parseInt(e.target.value) || 0 })}
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
