"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Loader2 } from "lucide-react";
import type { BackupData, RestoreSelection } from "@/lib/services/data-service";

interface BackupRestoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  backupData: BackupData | null;
  onRestore: (selections: RestoreSelection[]) => Promise<void>;
}

interface RestoreOption {
  key: RestoreSelection;
  label: string;
  count: number;
  description?: string;
}

export function BackupRestoreDialog({
  open,
  onOpenChange,
  backupData,
  onRestore,
}: BackupRestoreDialogProps) {
  const [isRestoring, setIsRestoring] = useState(false);
  const [selected, setSelected] = useState<Set<RestoreSelection>>(new Set());

  if (!backupData) return null;

  const options: RestoreOption[] = [
    { key: "users", label: "用户账号", count: backupData.counts.users, description: "包含管理员和教师账号" },
    { key: "teachers", label: "教师信息", count: backupData.counts.teachers },
    { key: "classes", label: "班级", count: backupData.counts.classes },
    { key: "students", label: "学员", count: backupData.counts.students },
    { key: "classTransfers", label: "转班记录", count: backupData.counts.classTransfers },
    { key: "feedbacks", label: "反馈记录", count: backupData.counts.feedbacks },
    { key: "themes", label: "教学主题", count: backupData.counts.themes },
    { key: "tags", label: "标签", count: backupData.counts.tags },
    { key: "courseStages", label: "课程阶段", count: backupData.counts.courseStages },
    { key: "aiSettings", label: "AI 设置", count: backupData.counts.aiSettings },
    { key: "coursePrompts", label: "课程提示词", count: backupData.counts.coursePrompts },
  ];

  const toggleSelection = (key: RestoreSelection) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === options.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(options.map((o) => o.key)));
    }
  };

  const handleRestore = async () => {
    if (selected.size === 0) return;
    setIsRestoring(true);
    try {
      await onRestore(Array.from(selected));
      setSelected(new Set());
      onOpenChange(false);
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            选择性恢复数据
          </DialogTitle>
          <DialogDescription>
            备份时间：{new Date(backupData.backupAt).toLocaleString()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">选择要恢复的数据分类</span>
            <Button variant="ghost" size="sm" onClick={toggleAll}>
              {selected.size === options.length ? "取消全选" : "全选"}
            </Button>
          </div>

          <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
            {options.map((option) => (
              <div
                key={option.key}
                className="flex items-start space-x-3 rounded-lg border p-3 hover:bg-muted/50"
              >
                <Checkbox
                  id={option.key}
                  checked={selected.has(option.key)}
                  onCheckedChange={() => toggleSelection(option.key)}
                />
                <div className="flex-1">
                  <Label htmlFor={option.key} className="font-medium cursor-pointer">
                    {option.label}
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({option.count} 条)
                    </span>
                  </Label>
                  {option.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {option.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isRestoring}>
            取消
          </Button>
          <Button
            onClick={handleRestore}
            disabled={isRestoring || selected.size === 0}
            variant="destructive"
          >
            {isRestoring ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                恢复中...
              </>
            ) : (
              `确认恢复 (${selected.size})`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
