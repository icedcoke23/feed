"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Plus,
  Upload,
  Layers,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import type { Teacher } from "@/types/home";

interface StudentActionBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  teacherFilter: string;
  onTeacherFilterChange: (value: string) => void;
  teachersFromClasses: Teacher[];
  onExpandAll: (expand: boolean) => void;
  onOpenAddStudent: () => void;
  onOpenBatchAdd: () => void;
  onOpenAddClass: () => void;
}

export function StudentActionBar({
  searchQuery,
  onSearchChange,
  teacherFilter,
  onTeacherFilterChange,
  teachersFromClasses,
  onExpandAll,
  onOpenAddStudent,
  onOpenBatchAdd,
  onOpenAddClass,
}: StudentActionBarProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 mb-6">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          placeholder="搜索学员姓名、班级、年级..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>
      <Select value={teacherFilter} onValueChange={onTeacherFilterChange}>
        <SelectTrigger className="w-full sm:w-48">
          <SelectValue placeholder="选择授课老师" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部老师</SelectItem>
          {teachersFromClasses.map((teacher) => (
            <SelectItem key={teacher.id} value={teacher.id}>
              {teacher.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* 展开/关闭全部按钮 */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => onExpandAll(true)}>
          <ChevronDown className="h-4 w-4 mr-1" />
          展开全部
        </Button>
        <Button variant="outline" size="sm" onClick={() => onExpandAll(false)}>
          <ChevronUp className="h-4 w-4 mr-1" />
          关闭全部
        </Button>
      </div>

      {/* 重置按钮 */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          onSearchChange("");
          onTeacherFilterChange("all");
          toast.success("已重置为默认筛选");
        }}
      >
        <RotateCcw className="h-4 w-4 mr-1" />
        重置
      </Button>

      {/* 批量添加按钮 */}
      <Button variant="outline" onClick={onOpenBatchAdd}>
        <Upload className="h-4 w-4 mr-2" />
        批量添加
      </Button>

      {/* 单个添加按钮 */}
      <Button onClick={onOpenAddStudent}>
        <Plus className="h-4 w-4 mr-2" />
        添加学员
      </Button>

      {/* 添加班级按钮 */}
      <Button variant="outline" onClick={onOpenAddClass}>
        <Layers className="h-4 w-4 mr-2" />
        添加班级
      </Button>
    </div>
  );
}
