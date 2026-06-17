"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import type { Student, ClassItem } from "@/types/home";

interface TransferStudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: Student | null;
  targetClassId: string;
  onTargetClassIdChange: (value: string) => void;
  classes: ClassItem[];
  transferring: boolean;
  onSubmit: () => void;
}

export function TransferStudentDialog({
  open,
  onOpenChange,
  student,
  targetClassId,
  onTargetClassIdChange,
  classes,
  transferring,
  onSubmit,
}: TransferStudentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>转出学员</DialogTitle>
          <DialogDescription>
            将学员 <span className="font-medium text-slate-700">{student?.name}</span> 转移到其他班级
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>当前班级</Label>
            <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-600">
              {student?.class?.name || student?.current_class || '未分配班级'}
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="target-class">目标班级 *</Label>
            <Select value={targetClassId} onValueChange={onTargetClassIdChange}>
              <SelectTrigger>
                <SelectValue placeholder="选择目标班级" />
              </SelectTrigger>
              <SelectContent>
                {classes
                  .filter((c) => c.id !== student?.class_id)
                  .map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name} {cls.grade && `(${cls.grade})`}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={onSubmit} disabled={transferring || !targetClassId}>
            {transferring ? "转出中..." : "确认转出"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
