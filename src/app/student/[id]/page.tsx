"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  User,
  School,
  Phone,
  Calendar,
  FileText,
  Edit,
  Trash2,
  Eye,
} from "lucide-react";
import Link from "next/link";
import type { Teacher } from "@/types/teacher";
import type { ClassItem } from "@/types/class";
import type { StudentDetail, StudentFeedback } from "@/types/student";
import { parseAiReport } from "@/utils/ai-report";

export default function StudentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [editForm, setEditForm] = useState({
    name: "",
    grade: "",
    school: "",
    phone: "",
    classId: "",
    adminTeacherId: "",
  });

  // 查看反馈详情
  const [viewingFeedback, setViewingFeedback] = useState<StudentFeedback | null>(null);
  
  // 删除反馈确认
  const [deletingFeedbackId, setDeletingFeedbackId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchTeachers = useCallback(async () => {
    try {
      const response = await fetch("/api/teachers");
      const data = await response.json();
      setTeachers(data.data || []);
    } catch (error) {
      console.error("Failed to fetch teachers:", error);
      toast.error("获取教师列表失败");
    }
  }, []);

  const fetchClasses = useCallback(async () => {
    try {
      const response = await fetch("/api/classes");
      const data = await response.json();
      setClasses(data.data || []);
    } catch (error) {
      console.error("Failed to fetch classes:", error);
      toast.error("获取班级列表失败");
    }
  }, []);

  const fetchStudent = useCallback(async () => {
    try {
      const response = await fetch(`/api/students/${params.id}`);
      const data = await response.json();

      if (!response.ok || !data.data) {
        toast.error("获取学员信息失败");
        return;
      }

      setStudent(data.data);
      // 初始化编辑表单
      setEditForm({
        name: data.data.name || "",
        grade: data.data.grade || "",
        school: data.data.school || "",
        phone: data.data.phone || "",
        classId: data.data.class_id || "",
        adminTeacherId: data.data.admin_teacher_id || "",
      });
    } catch (error) {
      console.error("Failed to fetch student:", error);
      toast.error("获取学员信息失败，请重试");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchStudent();
    fetchTeachers();
    fetchClasses();
  }, [fetchStudent, fetchTeachers, fetchClasses]);

  // 同步编辑表单：当学员数据变化或进入编辑态时刷新表单字段
  useEffect(() => {
    if (!student) return;
    setEditForm({
      name: student.name || "",
      grade: student.grade || "",
      school: student.school || "",
      phone: student.phone || "",
      classId: student.class_id || "",
      adminTeacherId: student.admin_teacher_id || "",
    });
  }, [student, isEditing]);

  const handleSave = async () => {
    if (!student) return;
    
    // 表单验证
    if (!editForm.name.trim()) {
      toast.error("请输入学员姓名");
      return;
    }
    
    setSaving(true);
    try {
      const response = await fetch(`/api/students/${student.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name.trim(),
          grade: editForm.grade.trim(),
          school: editForm.school.trim(),
          phone: editForm.phone.trim(),
          classId: editForm.classId || null,
          currentTeacherId: editForm.adminTeacherId || null,
          currentClass: classes.find(c => c.id === editForm.classId)?.name || student.current_class,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setStudent({ ...student, ...data.data });
        setIsEditing(false);
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
  };

  const handleDeleteStudent = async () => {
    if (!student) return;
    try {
      const response = await fetch(`/api/students/${params.id}`, { method: "DELETE" });
      if (response.ok) {
        toast.success("学员已删除");
        router.push("/");
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "删除失败");
      }
    } catch (error) {
      console.error("Failed to delete student:", error);
      toast.error("删除学员失败，请重试");
    }
  };

  const handleDeleteFeedback = async () => {
    if (!deletingFeedbackId) return;
    
    setDeleting(true);
    try {
      const response = await fetch(`/api/feedbacks/${deletingFeedbackId}`, { 
        method: "DELETE" 
      });
      
      if (response.ok) {
        toast.success("反馈记录已删除");
        // 更新本地数据
        if (student) {
          setStudent({
            ...student,
            feedbacks: student.feedbacks.filter(f => f.id !== deletingFeedbackId)
          });
        }
        setDeletingFeedbackId(null);
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "删除失败");
      }
    } catch (error) {
      console.error("Failed to delete feedback:", error);
      toast.error("删除反馈记录失败，请重试");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <header className="bg-white border-b sticky top-0 z-40">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between h-14 sm:h-16">
              <div className="flex items-center gap-2 sm:gap-4">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div>
                  <Skeleton className="h-6 w-24 mb-1" />
                  <Skeleton className="h-4 w-32 hidden sm:block" />
                </div>
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-9 w-20" />
                <Skeleton className="h-9 w-24" />
              </div>
            </div>
          </div>
        </header>
        <div className="container mx-auto px-4 py-4 sm:py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            <Skeleton className="h-80 rounded-lg" />
            <Skeleton className="h-80 lg:col-span-2 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <p className="text-gray-500">学员不存在</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* 顶部导航 - 手机适配 */}
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center gap-2 sm:gap-4">
              <Link href="/">
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold text-gray-800 truncate">{student.name}</h1>
                <p className="text-xs sm:text-sm text-gray-600 hidden sm:block">学员详情与历史记录</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="h-9">
                <Edit className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">编辑信息</span>
              </Button>
              <Link href={`/feedback/new?studentId=${student.id}`}>
                <Button size="sm" className="h-9">
                  <FileText className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">创建反馈</span>
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-4 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* 基本信息 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <User className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
                基本信息
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">姓名</span>
                <span className="font-medium">{student.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">年级</span>
                <span>{student.grade || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">学校</span>
                <span className="flex items-center gap-1 truncate max-w-[120px] sm:max-w-none">
                  <School className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span className="truncate">{student.school || "-"}</span>
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">联系电话</span>
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span>{student.phone || "-"}</span>
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">所在班级</span>
                <div className="text-right">
                  {student.classes && student.classes.length > 0 ? (
                    student.classes.map((cls) => (
                      <div key={cls.id} className="text-right">
                        <span className="truncate">{cls.name}</span>
                        {cls.teacher && (
                          <span className="text-xs text-slate-400 ml-1">({cls.teacher.name})</span>
                        )}
                        {cls.is_primary && (
                          <span className="text-xs text-blue-500 ml-1">[主]</span>
                        )}
                      </div>
                    ))
                  ) : (
                    <span>{student.current_class || "-"}</span>
                  )}
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">教务老师</span>
                <span>{student.admin_teacher?.name || "-"}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-gray-500">创建时间</span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                  {new Date(student.created_at).toLocaleDateString("zh-CN")}
                </span>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-red-500 hover:text-red-600 h-9"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    删除学员
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>确认删除学员</AlertDialogTitle>
                    <AlertDialogDescription>
                      确定要删除学员「{student.name}」吗？此操作将同时删除该学员的所有历史反馈记录，且不可恢复。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteStudent}
                      className="bg-red-500 hover:bg-red-600"
                    >
                      确认删除
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>

          {/* 历史反馈 */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
                历史反馈记录 ({student.feedbacks?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {student.feedbacks?.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                  <p>暂无反馈记录</p>
                  <Link href={`/feedback/new?studentId=${student.id}`}>
                    <Button variant="link" className="mt-2">
                      创建第一份反馈报告
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {student.feedbacks?.map((feedback, index) => (
                    <div
                      key={feedback.id}
                      className="p-3 sm:p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs">第 {index + 1} 期</Badge>
                          <Badge
                            variant={
                              feedback.status === "published"
                                ? "default"
                                : "secondary"
                            }
                            className="text-xs"
                          >
                            {feedback.status === "published" ? "已发布" : "草稿"}
                          </Badge>
                        </div>
                        <span className="text-xs sm:text-sm text-gray-500">
                          {new Date(feedback.created_at).toLocaleDateString("zh-CN")}
                        </span>
                      </div>
                      <div className="text-xs sm:text-sm text-gray-600 mb-3">
                        反馈周期：
                        {feedback.period_start &&
                          new Date(feedback.period_start).toLocaleDateString("zh-CN")}
                        {" - "}
                        {feedback.period_end &&
                          new Date(feedback.period_end).toLocaleDateString("zh-CN")}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8"
                          onClick={() => setViewingFeedback(feedback)}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          查看
                        </Button>
                        <Link href={`/feedback/${feedback.id}`}>
                          <Button variant="outline" size="sm" className="h-8">
                            详情页
                          </Button>
                        </Link>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="h-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => setDeletingFeedbackId(feedback.id)}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          删除
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 转班记录 */}
        {student.transfers && student.transfers.length > 0 && (
          <Card className="mt-4 sm:mt-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg">转班记录</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                {student.transfers.map((transfer) => (
                  <div
                    key={transfer.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4"
                  >
                    <span className="text-gray-500 text-xs sm:text-sm">
                      {new Date(transfer.transferred_at).toLocaleDateString("zh-CN")}
                    </span>
                    <span className="text-sm">
                      {transfer.from_class || "未知班级"} →{" "}
                      {transfer.to_class || "未知班级"}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 编辑学员信息对话框 */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="max-w-md w-[calc(100%-32px)] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>编辑学员信息</DialogTitle>
            <DialogDescription>
              修改学员的基本信息
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>姓名</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="请输入姓名"
              />
            </div>
            <div className="space-y-2">
              <Label>年级</Label>
              <Input
                value={editForm.grade}
                onChange={(e) => setEditForm({ ...editForm, grade: e.target.value })}
                placeholder="请输入年级"
              />
            </div>
            <div className="space-y-2">
              <Label>学校</Label>
              <Input
                value={editForm.school}
                onChange={(e) => setEditForm({ ...editForm, school: e.target.value })}
                placeholder="请输入学校"
              />
            </div>
            <div className="space-y-2">
              <Label>联系电话</Label>
              <Input
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                placeholder="请输入联系电话"
              />
            </div>
            <div className="space-y-2">
              <Label>班级</Label>
              <Select
                value={editForm.classId}
                onValueChange={(v) => setEditForm({ ...editForm, classId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择班级" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">不指定班级</SelectItem>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name} {cls.grade && `(${cls.grade})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>教务老师</Label>
              <Select
                value={editForm.adminTeacherId}
                onValueChange={(v) => setEditForm({ ...editForm, adminTeacherId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择教务老师" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">不指定</SelectItem>
                  {teachers.map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsEditing(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving || !editForm.name}>
              {saving ? "保存中..." : "保存"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 查看反馈详情对话框 */}
      <Dialog open={!!viewingFeedback} onOpenChange={() => setViewingFeedback(null)}>
        <DialogContent className="max-w-2xl w-[calc(100%-32px)] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-green-500" />
              反馈详情
            </DialogTitle>
            <DialogDescription>
              {viewingFeedback && (
                <span>
                  反馈周期：{viewingFeedback.period_start &&
                    new Date(viewingFeedback.period_start).toLocaleDateString("zh-CN")}
                  {" - "}
                  {viewingFeedback.period_end &&
                    new Date(viewingFeedback.period_end).toLocaleDateString("zh-CN")}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          {viewingFeedback && (
            <div className="space-y-4 py-4">
              {viewingFeedback.summary && (
                <div className="space-y-2">
                  <Label className="text-base font-semibold text-gray-700">综合评价</Label>
                  <div className="p-3 bg-gray-50 rounded-lg text-sm whitespace-pre-wrap">
                    {viewingFeedback.summary}
                  </div>
                </div>
              )}
              {viewingFeedback.strengths && (
                <div className="space-y-2">
                  <Label className="text-base font-semibold text-green-700">学员优点</Label>
                  <div className="p-3 bg-green-50 rounded-lg text-sm whitespace-pre-wrap">
                    {viewingFeedback.strengths}
                  </div>
                </div>
              )}
              {viewingFeedback.improvements && (
                <div className="space-y-2">
                  <Label className="text-base font-semibold text-blue-700">能力提升</Label>
                  <div className="p-3 bg-blue-50 rounded-lg text-sm whitespace-pre-wrap">
                    {viewingFeedback.improvements}
                  </div>
                </div>
              )}
              {viewingFeedback.weaknesses && (
                <div className="space-y-2">
                  <Label className="text-base font-semibold text-orange-700">需要提升</Label>
                  <div className="p-3 bg-orange-50 rounded-lg text-sm whitespace-pre-wrap">
                    {viewingFeedback.weaknesses}
                  </div>
                </div>
              )}
              {viewingFeedback.recommendations && (
                <div className="space-y-2">
                  <Label className="text-base font-semibold text-purple-700">阶段性建议</Label>
                  <div className="p-3 bg-purple-50 rounded-lg text-sm whitespace-pre-wrap">
                    {viewingFeedback.recommendations}
                  </div>
                </div>
              )}
              {viewingFeedback.ai_report && !viewingFeedback.summary && (() => {
                // 向后兼容：如果 metadata 为空且 ai_report 是旧格式 JSON 元数据，不展示
                if (!viewingFeedback.metadata || Object.keys(viewingFeedback.metadata).length === 0) {
                  if (parseAiReport(viewingFeedback.ai_report) === null) return null;
                }
                return (
                  <div className="space-y-2">
                    <Label className="text-base font-semibold text-gray-700">AI报告</Label>
                    <div className="p-3 bg-gray-50 rounded-lg text-sm whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                      {viewingFeedback.ai_report}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setViewingFeedback(null)}>
              关闭
            </Button>
            {viewingFeedback && (
              <Link href={`/feedback/${viewingFeedback.id}`}>
                <Button>查看完整详情</Button>
              </Link>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 删除反馈确认对话框 */}
      <AlertDialog open={!!deletingFeedbackId} onOpenChange={() => setDeletingFeedbackId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除反馈记录</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除这条反馈记录吗？此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteFeedback}
              disabled={deleting}
              className="bg-red-500 hover:bg-red-600"
            >
              {deleting ? "删除中..." : "确认删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
