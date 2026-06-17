"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Sparkles,
  Loader2,
} from "lucide-react";
import type { ClassItem, ParsedStudent } from "@/types/home";

interface BatchAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batchInput: string;
  onBatchInputChange: (value: string) => void;
  batchClassId: string;
  onBatchClassIdChange: (value: string) => void;
  classes: ClassItem[];
  parsing: boolean;
  parsedStudents: ParsedStudent[];
  onClearParsed: () => void;
  adding: boolean;
  onParse: () => void;
  onBatchAdd: () => void;
}

export function BatchAddDialog({
  open,
  onOpenChange,
  batchInput,
  onBatchInputChange,
  batchClassId,
  onBatchClassIdChange,
  classes,
  parsing,
  parsedStudents,
  onClearParsed,
  adding,
  onParse,
  onBatchAdd,
}: BatchAddDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-500" />
            批量添加学员
          </DialogTitle>
          <DialogDescription>
            输入学员信息，AI将自动识别并解析
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>分配到班级（可选）</Label>
            <Select value={batchClassId || "none"} onValueChange={(v) => onBatchClassIdChange(v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="选择班级（可选）" />
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
          <div className="space-y-2">
            <Label>输入学员信息</Label>
            <Textarea
              placeholder={`支持多种格式，例如：
张三 3年级2班
李四 四年级1班
王五、五年级、3班
赵六，六年级，一班

每行一个学员，或用逗号/空格分隔`}
              value={batchInput}
              onChange={(e) => onBatchInputChange(e.target.value)}
              className="min-h-[120px]"
            />
          </div>

          <Button
            onClick={onParse}
            disabled={parsing || !batchInput.trim()}
            className="w-full"
          >
            {parsing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                AI正在解析...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                AI智能解析
              </>
            )}
          </Button>

          {parsedStudents.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>解析结果（共{parsedStudents.length}人）</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClearParsed}
                >
                  清空
                </Button>
              </div>
              <div className="max-h-[200px] overflow-y-auto border rounded-lg divide-y">
                {parsedStudents.map((student, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-medium">
                        {student.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{student.name}</p>
                          {student.teacherName && (
                            <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                              {student.teacherName}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">
                          {student.grade}年级 {student.className}班
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <Button
                onClick={onBatchAdd}
                disabled={adding}
                className="w-full"
              >
                {adding ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    正在添加...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    确认添加全部学员
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
