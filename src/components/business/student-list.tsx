"use client";

import { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Calendar,
  GraduationCap,
  Edit,
  Trash2,
  ChevronDown,
  ChevronUp,
  Plus,
  Phone,
  User,
  Layers,
} from "lucide-react";
import Link from "next/link";
import type { Student, ClassItem } from "@/types/home";

interface StudentCardProps {
  student: Student;
  onEdit: (student: Student) => void;
  onTransfer: (student: Student) => void;
}

export const StudentCard = memo(function StudentCard({ student, onEdit, onTransfer }: StudentCardProps) {
  return (
    <Card className="group hover:shadow-md transition-all duration-200">
      <CardContent className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center text-white font-bold">
            {student.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm truncate">{student.name}</h4>
            {student.grade && (
              <p className="text-xs text-slate-500">{student.grade}</p>
            )}
          </div>
        </div>
        <div className="space-y-1.5 text-xs text-slate-500 mb-3">
          {student.phone && (
            <div className="flex items-center gap-1.5">
              <Phone className="h-3 w-3" />
              <span className="truncate">{student.phone}</span>
            </div>
          )}
          {student.admin_teacher && (
            <div className="flex items-center gap-1.5">
              <User className="h-3 w-3" />
              <span className="truncate">教务: {student.admin_teacher.name}</span>
            </div>
          )}
          {student.classes && student.classes.length > 1 && (
            <div className="flex items-center gap-1.5">
              <GraduationCap className="h-3 w-3" />
              <span className="truncate text-xs">
                {student.classes.map(c => c.teacher?.name).filter(Boolean).join(', ')}
              </span>
            </div>
          )}
        </div>
        <div className="flex gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-7 text-xs"
            onClick={() => onEdit(student)}
          >
            <Edit className="h-3 w-3 mr-1" />
            编辑
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-7 text-xs"
            onClick={() => onTransfer(student)}
          >
            <Users className="h-3 w-3 mr-1" />
            转出
          </Button>
        </div>
        <div className="flex gap-1.5 mt-1.5">
          <Link href={`/student/${student.id}`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full h-7 text-xs">
              详情
            </Button>
          </Link>
          <Link href={`/feedback/new?studentId=${student.id}`} className="flex-1">
            <Button size="sm" className="w-full h-7 text-xs">
              反馈
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
});

interface StudentListProps {
  filteredStudents: Student[];
  classes: ClassItem[];
  expandedClasses: Record<string, boolean>;
  onToggleClassExpand: (classId: string) => void;
  onEditStudent: (student: Student) => void;
  onTransferStudent: (student: Student) => void;
  onOpenAddStudent: () => void;
  onEditClass: (cls: ClassItem) => void;
  onDeleteClass: (classId: string, className: string) => void;
  hasMoreStudents?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
}

export function StudentList({
  filteredStudents,
  classes,
  expandedClasses,
  onToggleClassExpand,
  onEditStudent,
  onTransferStudent,
  onOpenAddStudent,
  onEditClass,
  onDeleteClass,
  hasMoreStudents,
  loadingMore,
  onLoadMore,
}: StudentListProps) {
  // 按班级ID分组学员 - 支持多班级
  const studentsByClass = filteredStudents.reduce((acc, student) => {
    // 如果有 classes 数组，学生出现在每个关联班级中
    const studentClasses = student.classes && student.classes.length > 0
      ? student.classes
      : [{ id: student.class_id || 'temp' }];

    studentClasses.forEach(cls => {
      const classId = cls.id || 'temp';
      if (!acc[classId]) acc[classId] = [];
      acc[classId].push(student);
    });
    return acc;
  }, {} as Record<string, Student[]>);

  // 合并现有班级和"未分配班级"
  const allClasses = [...classes];

  // 如果有未分配的学员，添加"未分配班级"
  if (studentsByClass['temp'] && studentsByClass['temp'].length > 0) {
    allClasses.push({
      id: 'temp',
      name: '未分配班级',
      grade: '',
      schedule: '',
    } as ClassItem);
  }

  // 排序：按名称排序，未分配班级在最后
  const sortedClasses = allClasses.sort((a, b) => {
    if (a.id === 'temp') return 1;
    if (b.id === 'temp') return -1;
    return a.name.localeCompare(b.name);
  });

  // 没有班级也没有学生时返回 null
  if (sortedClasses.length === 0) return null;

  return (
    <div className="space-y-8">
      {sortedClasses.map((classData) => {
        const isExpanded = expandedClasses[classData.id] || false;
        const classStudents = studentsByClass[classData.id] || [];
        const isTempClass = classData.id === 'temp';

        return (
          <Card key={classData.id} className="overflow-hidden">
            {/* 班级头部 - 可点击展开/关闭 */}
            <div
              className="bg-gradient-to-r from-slate-50 to-slate-100 px-6 py-4 border-b flex items-center justify-between cursor-pointer hover:from-slate-100 hover:to-slate-200 transition-colors"
              onClick={() => onToggleClassExpand(classData.id)}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <Layers className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-slate-800">{classData.name}</h3>
                  <p className="text-sm text-slate-500">
                    {classData.grade && `${classData.grade} · `}
                    {classStudents.length} 名学员
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!isTempClass && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      title="编辑班级"
                      aria-label="编辑班级"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditClass(classData);
                      }}
                    >
                      <Edit className="h-4 w-4 text-slate-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      title="删除班级"
                      aria-label="删除班级"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteClass(classData.id, classData.name);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                )}
                <Badge variant="secondary">{classStudents.length} 人</Badge>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label={isExpanded ? "折叠班级列表" : "展开班级列表"} aria-expanded={isExpanded}>
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5 text-slate-500" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-slate-500" />
                  )}
                </Button>
              </div>
            </div>

            {/* 展开的详细信息 */}
            {isExpanded && (
              <div className="p-4 border-b bg-slate-50/50">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  {classData?.schedule && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-slate-400" />
                      <span className="text-slate-600">上课时间: {classData.schedule}</span>
                    </div>
                  )}
                  {classData?.teacher && (
                    <div className="flex items-center gap-2">
                      <GraduationCap className="h-4 w-4 text-slate-400" />
                      <span className="text-slate-600">授课老师: {classData.teacher.name}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-slate-400" />
                    <span className="text-slate-600">学员人数: {classStudents.length} 人</span>
                  </div>
                </div>
              </div>
            )}

            {/* 学员列表 - 仅展开时显示 */}
            {isExpanded && (
              <div className="p-4">
                {classStudents.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>该班级暂无学员</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={onOpenAddStudent}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      添加学员
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {classStudents.map((student) => (
                      <StudentCard
                        key={student.id}
                        student={student}
                        onEdit={onEditStudent}
                        onTransfer={onTransferStudent}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>
        );
      })}

      {/* 加载更多按钮 */}
      {hasMoreStudents && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            size="lg"
            onClick={onLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? "加载中..." : "加载更多"}
          </Button>
        </div>
      )}
    </div>
  );
}