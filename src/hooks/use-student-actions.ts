"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import type { Student, ClassItem, Teacher, StudentFormData } from "@/types/home";
import { EMPTY_STUDENT_FORM } from "@/types/home";

export function useStudentActions(
  fetchData: () => Promise<void>,
  classes: ClassItem[],
  teachers: Teacher[]
) {
  void teachers;

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [transferringStudent, setTransferringStudent] = useState<Student | null>(null);
  const [targetClassId, setTargetClassId] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newStudent, setNewStudent] = useState<StudentFormData>(EMPTY_STUDENT_FORM);

  const handleAddStudent = useCallback(async () => {
    if (!newStudent.name.trim()) {
      toast.error("请输入学员姓名");
      return;
    }

    setAdding(true);
    try {
      const response = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: newStudent.name.trim(),
          grade: newStudent.grade.trim(),
          currentClass: newStudent.className.trim(),
          classId: newStudent.classId || null,
          phone: newStudent.phone.trim(),
          school: newStudent.school,
          currentTeacherId: newStudent.currentTeacherId || null,
          adminTeacherId: newStudent.adminTeacherId || null,
        }),
      });
      if (response.ok) {
        fetchData();
        setIsAddDialogOpen(false);
        setNewStudent(EMPTY_STUDENT_FORM);
        toast.success("学员添加成功");
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "添加失败");
      }
    } catch (error) {
      console.error("Failed to add student:", error);
      toast.error("添加学员失败，请重试");
    } finally {
      setAdding(false);
    }
  }, [newStudent, fetchData]);

  const handleOpenEdit = useCallback((student: Student) => {
    setEditingStudent(student);
    setNewStudent({
      name: student.name,
      grade: student.grade || "",
      className: student.current_class || "",
      classId: student.class_id || "",
      phone: student.phone || "",
      school: student.school || "",
      adminTeacherId: student.admin_teacher_id || "",
      currentTeacherId: student.current_teacher_id || "",
    });
    setIsEditDialogOpen(true);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingStudent) return;

    if (!newStudent.name.trim()) {
      toast.error("请输入学员姓名");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/students/${editingStudent.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: newStudent.name.trim(),
          grade: newStudent.grade.trim(),
          school: newStudent.school.trim(),
          phone: newStudent.phone.trim(),
          classId: newStudent.classId || null,
          currentTeacherId: newStudent.currentTeacherId || null,
          adminTeacherId: newStudent.adminTeacherId || null,
          currentClass: classes.find(c => c.id === newStudent.classId)?.name || editingStudent.current_class,
        }),
      });
      if (response.ok) {
        fetchData();
        setIsEditDialogOpen(false);
        setEditingStudent(null);
        setNewStudent(EMPTY_STUDENT_FORM);
        toast.success("学员信息更新成功");
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "更新失败");
      }
    } catch (error) {
      console.error("Failed to update student:", error);
      toast.error("更新学员信息失败，请重试");
    } finally {
      setSaving(false);
    }
  }, [editingStudent, newStudent, classes, fetchData]);

  const handleOpenTransfer = useCallback((student: Student) => {
    setTransferringStudent(student);
    setTargetClassId("");
    setIsTransferDialogOpen(true);
  }, []);

  const handleTransferStudent = useCallback(async () => {
    if (!transferringStudent || !targetClassId) return;

    setTransferring(true);
    try {
      const response = await fetch(`/api/students/${transferringStudent.id}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          targetClassId: targetClassId,
        }),
      });
      if (response.ok) {
        fetchData();
        setIsTransferDialogOpen(false);
        setTransferringStudent(null);
        setTargetClassId("");
        toast.success("学员转出成功");
      } else {
        const error = await response.json();
        toast.error(error.error || "转出失败");
      }
    } catch (error) {
      console.error("Failed to transfer student:", error);
      toast.error("转出学员失败，请重试");
    } finally {
      setTransferring(false);
    }
  }, [transferringStudent, targetClassId, fetchData]);

  return {
    isAddDialogOpen,
    setIsAddDialogOpen,
    isEditDialogOpen,
    setIsEditDialogOpen,
    isTransferDialogOpen,
    setIsTransferDialogOpen,
    editingStudent,
    transferringStudent,
    targetClassId,
    setTargetClassId,
    transferring,
    saving,
    adding,
    newStudent,
    setNewStudent,
    handleAddStudent,
    handleOpenEdit,
    handleSaveEdit,
    handleOpenTransfer,
    handleTransferStudent,
  };
}
