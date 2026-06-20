"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Search,
  Users,
  GraduationCap,
  Edit,
  Trash2,
  Filter,
  Download,
  UserPlus,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import type { Student } from "@/types/student";
import type { Teacher } from "@/types/teacher";
import type { ClassItem } from "@/types/class";

export default function AdminStudentsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [teacherFilter, setTeacherFilter] = useState<string>("all");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [saving, setSaving] = useState(false);

  // 编辑表单状态
  const [editForm, setEditForm] = useState({
    name: "",
    grade: "",
    school: "",
    phone: "",
    classId: "",
    adminTeacherId: "",
  });

  useEffect(() => {
    if (!user || user.role !== "admin") {
      router.push("/login");
      return;
    }
    fetchData();
  }, [user, router]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 并行获取学生、教师和班级数据
      const [studentsRes, teachersRes, classesRes] = await Promise.all([
        fetch("/api/students"),
        fetch("/api/teachers"),
        fetch("/api/classes"),
      ]);

      const studentsData = await studentsRes.json();
      const teachersData = await teachersRes.json();
      const classesData = await classesRes.json();

      setStudents(studentsData.data || []);
      setTeachers(teachersData.data || []);
      setClasses(classesData.data || []);
    } catch (error) {
      console.error("Failed to fetch data:", error);
      toast.error("获取数据失败");
    } finally {
      setLoading(false);
    }
  };

  // 根据教师筛选获取班级列表
  const filteredClasses = teacherFilter === "all" 
    ? classes 
    : classes.filter(c => c.teacher_id === teacherFilter);

  // 筛选学生
  const filteredStudents = students.filter((student) => {
    const matchesSearch =
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (student.school?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (student.class?.name.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesTeacher =
      teacherFilter === "all" ||
      student.current_teacher_id === teacherFilter ||
      student.class?.teacher_id === teacherFilter;

    const matchesClass =
      classFilter === "all" || student.class_id === classFilter;

    return matchesSearch && matchesTeacher && matchesClass;
  });

  // 统计数据
  const stats = {
    total: students.length,
    byTeacher: teachers.map((t) => ({
      name: t.name,
      count: students.filter(
        (s) => s.current_teacher_id === t.id || s.class?.teacher_id === t.id
      ).length,
    })),
  };

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    setEditForm({
      name: student.name,
      grade: student.grade || "",
      school: student.school || "",
      phone: student.phone || "",
      classId: student.class_id || "",
      adminTeacherId: student.admin_teacher_id || "",
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingStudent) return;
    if (!editForm.name.trim()) {
      toast.error("请填写学生姓名");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/students/${editingStudent.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          grade: editForm.grade || null,
          school: editForm.school || null,
          phone: editForm.phone || null,
          classId: editForm.classId || null,
          adminTeacherId: editForm.adminTeacherId || null,
          currentTeacherId: editForm.classId
            ? classes.find((c) => c.id === editForm.classId)?.teacher_id
            : null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "保存失败");
      }

      toast.success("保存成功");
      setEditDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error("Save error:", error);
      toast.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!studentToDelete) return;

    try {
      const response = await fetch(`/api/students/${studentToDelete.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("删除失败");
      }

      toast.success("删除成功");
      setDeleteDialogOpen(false);
      setStudentToDelete(null);
      fetchData();
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("删除失败");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Skeleton className="h-9 w-24" />
              <div>
                <Skeleton className="h-8 w-32 mb-1" />
                <Skeleton className="h-4 w-40" />
              </div>
            </div>
            <Skeleton className="h-9 w-24" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Skeleton className="h-20 rounded-lg" />
            <Skeleton className="h-20 rounded-lg" />
            <Skeleton className="h-20 col-span-2 rounded-lg" />
          </div>
          <Skeleton className="h-16 rounded-lg mb-6" />
          <Skeleton className="h-96 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                返回首页
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">学生管理</h1>
              <p className="text-sm text-gray-500">管理所有学生信息</p>
            </div>
          </div>
          <Link href="/settings">
            <Button variant="outline" size="sm">
              系统设置
            </Button>
          </Link>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm text-gray-500">学生总数</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm text-gray-500">授课教师</p>
                  <p className="text-2xl font-bold">{teachers.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="col-span-2">
            <CardContent className="p-4">
              <p className="text-sm text-gray-500 mb-2">教师学生分布</p>
              <div className="flex flex-wrap gap-2">
                {stats.byTeacher.slice(0, 5).map((t) => (
                  <Badge key={t.name} variant="secondary">
                    {t.name}: {t.count}人
                  </Badge>
                ))}
                {stats.byTeacher.length > 5 && (
                  <Badge variant="outline">+{stats.byTeacher.length - 5}</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 筛选区域 */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="搜索学生姓名、学校或班级..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Select value={teacherFilter} onValueChange={setTeacherFilter}>
                  <SelectTrigger className="w-[150px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="按教师筛选" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部教师</SelectItem>
                    {teachers.map((teacher) => (
                      <SelectItem key={teacher.id} value={teacher.id}>
                        {teacher.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={classFilter} onValueChange={setClassFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="按班级筛选" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部班级</SelectItem>
                    {filteredClasses.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 学生列表 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>学生列表</span>
              <span className="text-sm font-normal text-gray-500">
                共 {filteredStudents.length} 条记录
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredStudents.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>暂无学生数据</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>姓名</TableHead>
                      <TableHead>年级</TableHead>
                      <TableHead>学校</TableHead>
                      <TableHead>班级</TableHead>
                      <TableHead>授课教师</TableHead>
                      <TableHead>教务老师</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">
                          {student.name}
                        </TableCell>
                        <TableCell>{student.grade || "-"}</TableCell>
                        <TableCell>{student.school || "-"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {student.class?.name || "未分配"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {student.class?.teacher?.name || "-"}
                        </TableCell>
                        <TableCell>
                          {student.admin_teacher?.name || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(student)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-700"
                              onClick={() => {
                                setStudentToDelete(student);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 编辑对话框 */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>编辑学生信息</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium">姓名 *</label>
                <Input
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                  placeholder="学生姓名"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">年级</label>
                  <Input
                    value={editForm.grade}
                    onChange={(e) =>
                      setEditForm({ ...editForm, grade: e.target.value })
                    }
                    placeholder="如：三年级"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">学校</label>
                  <Input
                    value={editForm.school}
                    onChange={(e) =>
                      setEditForm({ ...editForm, school: e.target.value })
                    }
                    placeholder="就读学校"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">联系电话</label>
                <Input
                  value={editForm.phone}
                  onChange={(e) =>
                    setEditForm({ ...editForm, phone: e.target.value })
                  }
                  placeholder="家长联系电话"
                />
              </div>
              <div>
                <label className="text-sm font-medium">所属班级</label>
                <Select
                  value={editForm.classId}
                  onValueChange={(value) =>
                    setEditForm({ ...editForm, classId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择班级" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">未分配</SelectItem>
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">教务老师</label>
                <Select
                  value={editForm.adminTeacherId}
                  onValueChange={(value) =>
                    setEditForm({ ...editForm, adminTeacherId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择教务老师" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">无</SelectItem>
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
              <Button
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
              >
                取消
              </Button>
              <Button onClick={handleSaveEdit} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    保存中...
                  </>
                ) : (
                  "保存"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* 删除确认对话框 */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认删除</AlertDialogTitle>
              <AlertDialogDescription>
                确定要删除学生 &quot;{studentToDelete?.name}&quot; 吗？此操作不可恢复。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-red-500 hover:bg-red-600"
              >
                删除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
