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

interface AddStudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: StudentFormData;
  onFormDataChange: (data: StudentFormData) => void;
  classes: ClassItem[];
  teachers: Teacher[];
  adminTeachers: Teacher[];
  onSubmit: () => void;
}

export function AddStudentDialog({
  open,
  onOpenChange,
  formData,
  onFormDataChange,
  classes,
  adminTeachers,
  onSubmit,
}: AddStudentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>添加新学员</DialogTitle>
          <DialogDescription>
            填写学员基本信息，带 * 为必填项
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">学员姓名 *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                onFormDataChange({ ...formData, name: e.target.value })
              }
              placeholder="请输入学员姓名"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="grade">年级</Label>
              <Input
                id="grade"
                value={formData.grade}
                onChange={(e) =>
                  onFormDataChange({ ...formData, grade: e.target.value })
                }
                placeholder="例如：三年级"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="school">学校</Label>
              <Input
                id="school"
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
              <Label htmlFor="class">班级</Label>
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
              <Label htmlFor="adminTeacher">教务老师</Label>
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
            <Label htmlFor="phone">联系电话</Label>
            <Input
              id="phone"
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
          <Button onClick={onSubmit} disabled={!formData.name}>
            确认添加
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
