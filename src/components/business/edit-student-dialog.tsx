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
import type { ClassItem, Teacher, StudentFormData } from "@/types/home";

interface EditStudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: StudentFormData;
  onFormDataChange: (data: StudentFormData) => void;
  classes: ClassItem[];
  teachers: Teacher[];
  adminTeachers: Teacher[];
  saving: boolean;
  onSubmit: () => void;
}

export function EditStudentDialog({
  open,
  onOpenChange,
  formData,
  onFormDataChange,
  classes,
  teachers,
  adminTeachers,
  saving,
  onSubmit,
}: EditStudentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>编辑学员信息</DialogTitle>
          <DialogDescription>
            修改学员的基本信息
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="edit-name">学员姓名 *</Label>
            <Input
              id="edit-name"
              value={formData.name}
              onChange={(e) =>
                onFormDataChange({ ...formData, name: e.target.value })
              }
              placeholder="请输入学员姓名"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-grade">年级</Label>
              <Input
                id="edit-grade"
                value={formData.grade}
                onChange={(e) =>
                  onFormDataChange({ ...formData, grade: e.target.value })
                }
                placeholder="例如：三年级"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-school">学校</Label>
              <Input
                id="edit-school"
                value={formData.school}
                onChange={(e) =>
                  onFormDataChange({ ...formData, school: e.target.value })
                }
                placeholder="例如：xx小学"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-class">班级</Label>
              <Select
                value={formData.classId || "none"}
                onValueChange={(v) => {
                  if (v === "none") {
                    onFormDataChange({
                      ...formData,
                      classId: "",
                      className: "",
                    });
                  } else {
                    const selectedClass = classes.find((c) => c.id === v);
                    onFormDataChange({
                      ...formData,
                      classId: v,
                      className: selectedClass?.name || "",
                    });
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择班级" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不指定班级</SelectItem>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name} {cls.grade && `(${cls.grade})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-teacher">教务老师</Label>
              <Select
                value={formData.adminTeacherId || "none"}
                onValueChange={(v) =>
                  onFormDataChange({ ...formData, adminTeacherId: v === "none" ? "" : v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择教务老师" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不指定</SelectItem>
                  {adminTeachers.map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-phone">联系电话</Label>
            <Input
              id="edit-phone"
              value={formData.phone}
              onChange={(e) =>
                onFormDataChange({ ...formData, phone: e.target.value })
              }
              placeholder="请输入联系电话"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={onSubmit} disabled={saving || !formData.name}>
            {saving ? "保存中..." : "保存修改"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
