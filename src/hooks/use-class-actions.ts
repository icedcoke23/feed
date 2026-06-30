"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import type { User } from "@/contexts/auth-context";
import type { ClassItem, ClassFormData } from "@/types/home";
import { EMPTY_CLASS_FORM } from "@/types/home";
import type { ConfirmDialogState } from "@/components/business/confirm-dialog";
import { INITIAL_CONFIRM_STATE, createConfirmState } from "@/components/business/confirm-dialog";
import { classFormSchema, firstZodError } from "@/lib/validations/client";

export function useClassActions(
  fetchData: () => Promise<void>,
  user: User | null
) {
  const [isClassDialogOpen, setIsClassDialogOpen] = useState(false);
  const [isEditClassDialogOpen, setIsEditClassDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null);
  const [newClass, setNewClass] = useState<ClassFormData>(EMPTY_CLASS_FORM);
  const [savingClass, setSavingClass] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(INITIAL_CONFIRM_STATE);

  const getAuthHeaders = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    return headers;
  }, []);

  const handleOpenAddClass = useCallback(() => {
    const defaultTeacherId = user?.role === 'teacher' ? user.id : "";
    setNewClass({ ...EMPTY_CLASS_FORM, teacherId: defaultTeacherId });
    setIsClassDialogOpen(true);
  }, [user]);

  const handleOpenEditClass = useCallback((cls: ClassItem) => {
    setEditingClass(cls);
    setNewClass({
      name: cls.name,
      grade: cls.grade ?? "",
      schedule: cls.schedule ?? "",
      teacherId: cls.teacher?.id || "",
    });
    setIsEditClassDialogOpen(true);
  }, []);

  const handleAddClass = useCallback(async () => {
    const parsed = classFormSchema.safeParse(newClass);
    if (!parsed.success) {
      toast.error(firstZodError(parsed.error));
      return;
    }
    const valid = parsed.data;

    setSavingClass(true);
    try {
      const response = await fetch("/api/classes", {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({
          name: valid.name,
          grade: valid.grade,
          schedule: valid.schedule,
          teacherId: valid.teacherId,
        }),
      });
      if (response.ok) {
        fetchData();
        setIsClassDialogOpen(false);
        setNewClass(EMPTY_CLASS_FORM);
        toast.success("班级添加成功");
      } else {
        const error = await response.json();
        toast.error(error.error || "添加失败");
      }
    } catch (error) {
      console.error("Failed to add class:", error);
      toast.error("添加班级失败，请重试");
    } finally {
      setSavingClass(false);
    }
  }, [newClass, fetchData, getAuthHeaders]);

  const handleUpdateClass = useCallback(async () => {
    if (!editingClass) {
      toast.error("未选择要编辑的班级");
      return;
    }

    const parsed = classFormSchema.safeParse(newClass);
    if (!parsed.success) {
      toast.error(firstZodError(parsed.error));
      return;
    }
    const valid = parsed.data;

    setSavingClass(true);
    try {
      const response = await fetch(`/api/classes/${editingClass.id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({
          name: valid.name,
          grade: valid.grade,
          schedule: valid.schedule,
          teacherId: valid.teacherId,
        }),
      });
      if (response.ok) {
        fetchData();
        setIsEditClassDialogOpen(false);
        setEditingClass(null);
        setNewClass(EMPTY_CLASS_FORM);
        toast.success("班级更新成功");
      } else {
        const error = await response.json();
        toast.error(error.error || "更新失败");
      }
    } catch (error) {
      console.error("Failed to update class:", error);
      toast.error("更新班级失败，请重试");
    } finally {
      setSavingClass(false);
    }
  }, [editingClass, newClass, fetchData, getAuthHeaders]);

  const handleDeleteClass = useCallback(async (classId: string, className: string) => {
    setConfirmDialog(createConfirmState({
      title: "确认删除班级",
      description: `确定要删除班级 "${className}" 吗？注意：该班级内的学员将变为未分配状态。`,
      confirmText: "确认删除",
      variant: "destructive",
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, open: false }));
        try {
          const response = await fetch(`/api/classes/${classId}`, {
            method: "DELETE",
            credentials: "include",
          });
          if (response.ok) {
            fetchData();
            toast.success("班级删除成功");
          } else {
            const error = await response.json();
            toast.error(error.error || "删除失败");
          }
        } catch (error) {
          console.error("Failed to delete class:", error);
          toast.error("删除班级失败，请重试");
        }
      },
    }));
  }, [fetchData]);

  return {
    isClassDialogOpen,
    setIsClassDialogOpen,
    isEditClassDialogOpen,
    setIsEditClassDialogOpen,
    editingClass,
    newClass,
    setNewClass,
    savingClass,
    confirmDialog,
    setConfirmDialog,
    handleOpenAddClass,
    handleOpenEditClass,
    handleAddClass,
    handleUpdateClass,
    handleDeleteClass,
  };
}
