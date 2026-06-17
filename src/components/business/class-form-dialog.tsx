"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { User } from "lucide-react";
import type { User as UserType } from "@/contexts/auth-context";
import type { Teacher, ClassFormData } from "@/types/home";

interface ClassFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "add" | "edit";
  formData: ClassFormData;
  onFormDataChange: (data: ClassFormData) => void;
  teachers: Teacher[];
  user: UserType | null;
  saving: boolean;
  onSubmit: () => void;
}

export function ClassFormDialog({
  open,
  onOpenChange,
  mode,
  formData,
  onFormDataChange,
  teachers,
  user,
  saving,
  onSubmit,
}: ClassFormDialogProps) {
  const isAdd = mode === "add";
  const title = isAdd ? "添加班级" : "编辑班级";
  const description = isAdd ? "创建一个新的班级" : "修改班级信息";
  const submitText = isAdd
    ? (saving ? "添加中..." : "添加班级")
    : (saving ? "保存中..." : "保存修改");
  const nameId = isAdd ? "class-name" : "edit-class-name";
  const gradeId = isAdd ? "class-grade" : "edit-class-grade";
  const scheduleId = isAdd ? "class-schedule" : "edit-class-schedule";
  const teacherId = isAdd ? "class-teacher" : "edit-class-teacher";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor={nameId}>班级名称 *</Label>
            <Input
              id={nameId}
              value={formData.name}
              onChange={(e) => onFormDataChange({ ...formData, name: e.target.value })}
              placeholder="例如：Scratch初阶班"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={gradeId}>年级</Label>
            <Input
              id={gradeId}
              value={formData.grade}
              onChange={(e) => onFormDataChange({ ...formData, grade: e.target.value })}
              placeholder="例如：小学三年级"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={scheduleId}>上课时间</Label>
            <Input
              id={scheduleId}
              value={formData.schedule}
              onChange={(e) => onFormDataChange({ ...formData, schedule: e.target.value })}
              placeholder="例如：周六上午9:00-11:00"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={teacherId}>授课老师 *</Label>
            {user?.role === 'teacher' ? (
              <div className="p-2 border rounded-md bg-slate-50 text-sm">
                <User className="h-4 w-4 inline mr-2 text-slate-500" />
                {user.name} (我自己)
              </div>
            ) : (
              <Select
                value={formData.teacherId || "none"}
                onValueChange={(v) => onFormDataChange({ ...formData, teacherId: v === "none" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择授课老师 *" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">选择老师...</SelectItem>
                  {teachers.map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <p className="text-xs text-slate-500">
              {user?.role === 'teacher'
                ? "班级将绑定到您名下，只有您能看到这个班级"
                : "必须选择授课老师，未选择则默认为管理员"}
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={onSubmit} disabled={saving || !formData.name.trim()}>
            {submitText}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
