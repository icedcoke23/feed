"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import type { ClassItem, ParsedStudent } from "@/types/home";

export function useBatchAdd(
  fetchData: () => Promise<void>,
  classes: ClassItem[]
) {
  void classes;

  const [isBatchDialogOpen, setIsBatchDialogOpen] = useState(false);
  const [batchInput, setBatchInput] = useState("");
  const [batchClassId, setBatchClassId] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parsedStudents, setParsedStudents] = useState<ParsedStudent[]>([]);
  const [adding, setAdding] = useState(false);

  const handleParseInput = useCallback(async () => {
    if (!batchInput.trim()) return;

    setParsing(true);
    try {
      const response = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content: batchInput, type: "students" }),
      });

      if (!response.ok) {
        toast.error("解析失败，请重试");
        return;
      }

      const data = await response.json();

      if (data.data?.type === "students" && Array.isArray(data.data?.data)) {
        setParsedStudents(data.data.data);
      } else {
        toast.error("解析失败，请检查输入格式");
      }
    } catch (error) {
      console.error("Parse error:", error);
      toast.error("解析失败，请重试");
    } finally {
      setParsing(false);
    }
  }, [batchInput]);

  const handleBatchAdd = useCallback(async () => {
    if (parsedStudents.length === 0) return;

    setAdding(true);
    try {
      const response = await fetch("/api/students/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          students: parsedStudents,
          classId: batchClassId || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        toast.error("添加失败：" + (data?.error || "未知错误"));
        return;
      }

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message || "添加成功");
        fetchData();
        setIsBatchDialogOpen(false);
        setBatchInput("");
        setParsedStudents([]);
        setBatchClassId("");
      } else {
        toast.error("添加失败：" + (data.error || "未知错误"));
      }
    } catch (error) {
      console.error("Batch add error:", error);
      toast.error("添加失败，请重试");
    } finally {
      setAdding(false);
    }
  }, [parsedStudents, batchClassId, fetchData]);

  return {
    isBatchDialogOpen,
    setIsBatchDialogOpen,
    batchInput,
    setBatchInput,
    batchClassId,
    setBatchClassId,
    parsing,
    parsedStudents,
    setParsedStudents,
    adding,
    handleParseInput,
    handleBatchAdd,
  };
}
