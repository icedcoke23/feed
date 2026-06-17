"use client";

import { User, History, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { FeedbackStudent, FeedbackHistory } from "@/types/feedback";

interface StudentSelectorProps {
  students: FeedbackStudent[];
  feedbackHistory: FeedbackHistory[];
  selectedStudentId: string;
  feedbackDate: string;
  onSelectStudent: (id: string) => void;
  onChangeDate: (date: string) => void;
}

export function StudentSelector({
  students,
  feedbackHistory,
  selectedStudentId,
  feedbackDate,
  onSelectStudent,
  onChangeDate,
}: StudentSelectorProps) {
  const selectedStudent = students.find((s) => s.id === selectedStudentId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          选择学员
        </CardTitle>
        <CardDescription>
          选择本次反馈的学员，系统将自动加载该学员的历史反馈数据
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>选择学员</Label>
            {students.length === 0 ? (
              <div className="text-sm text-gray-500 p-3 border rounded-lg bg-gray-50">
                暂无学员数据，请先添加学员
              </div>
            ) : (
              <Select value={selectedStudentId} onValueChange={onSelectStudent}>
                <SelectTrigger>
                  <SelectValue placeholder="请选择学员" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((student) => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.name}
                      {student.grade ? ` - ${student.grade}年级` : ""}{" "}
                      {student.class_name ? `${student.class_name}班` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-2">
            <Label>反馈日期</Label>
            <Input type="date" value={feedbackDate} onChange={(e) => onChangeDate(e.target.value)} />
          </div>
        </div>

        {selectedStudent && (
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                {selectedStudent.name.charAt(0)}
              </div>
              <div>
                <p className="font-medium">{selectedStudent.name}</p>
                <p className="text-sm text-gray-600">
                  {[
                    selectedStudent.grade ? `${selectedStudent.grade}年级` : "",
                    selectedStudent.class_name ? `${selectedStudent.class_name}班` : "",
                  ]
                    .filter(Boolean)
                    .join(" ") || "未设置班级信息"}
                </p>
              </div>
            </div>
          </div>
        )}

        {feedbackHistory.length > 0 && (
          <div className="mt-6">
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <History className="h-4 w-4" />
              近期反馈记录
            </h4>
            <div className="space-y-2">
              {feedbackHistory.slice(0, 3).map((history) => (
                <div key={history.id} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{history.teaching_theme}</span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={cn(
                            "h-3 w-3",
                            star <= history.overall_rating
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-gray-300"
                          )}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(history.feedback_date).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
