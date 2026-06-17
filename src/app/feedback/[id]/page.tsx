"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Download,
  Calendar,
  User,
  School,
  Loader2,
  Pencil,
} from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import type { FeedbackDetail } from "@/types/feedback";
import type { Student } from "@/types/student";
import { parseAiReport } from "@/utils/ai-report";

export default function FeedbackDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [feedback, setFeedback] = useState<FeedbackDetail | null>(null);
  const [student, setStudent] = useState<Pick<Student, "id" | "name" | "grade" | "school"> | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchFeedback();
  }, [params.id]);

  const fetchFeedback = async () => {
    try {
      const response = await fetch(`/api/feedbacks/${params.id}`);
      if (!response.ok) {
        toast.error("获取反馈报告失败，请刷新页面重试");
        return;
      }
      const data = await response.json();
      setFeedback(data.data);

      if (data.data?.student_id) {
        const studentRes = await fetch(`/api/students/${data.data.student_id}`);
        if (studentRes.ok) {
          const studentData = await studentRes.json();
          setStudent(studentData.data);
        }
      }
    } catch (error) {
      console.error("Failed to fetch feedback:", error);
      toast.error("获取反馈报告失败，请刷新页面重试");
    } finally {
      setLoading(false);
    }
  };

  const handleExportWord = async () => {
    setExporting(true);
    try {
      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentName: student?.name,
          grade: student?.grade,
          school: student?.school,
          teacherName: "授课教师",
          periodStart: feedback?.period_start,
          periodEnd: feedback?.period_end,
          aiReport: feedback?.ai_report,
          strengths: feedback?.strengths,
          improvements: feedback?.improvements,
          weaknesses: feedback?.weaknesses,
          teachingPlan: feedback?.teaching_plan,
          suggestions: feedback?.suggestions,
        }),
      });

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${student?.name}_教学反馈报告.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Failed to export:", error);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center gap-4 mb-6">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-10 w-28" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="h-64 rounded-lg" />
            <Skeleton className="h-64 lg:col-span-2 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (!feedback) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <p className="text-gray-500">反馈报告不存在</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link href={`/student/${feedback.student_id}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-800">教学反馈报告</h1>
            <div className="flex items-center gap-2 text-gray-600">
              <User className="h-4 w-4" />
              <span>{student?.name}</span>
              {student?.grade && (
                <Badge variant="secondary">{student.grade}</Badge>
              )}
              <Badge variant={feedback.status === "published" ? "default" : "outline"}>
                {feedback.status === "published" ? "已发布" : "草稿"}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/feedback/new?editId=${feedback.id}`}>
              <Button variant="outline">
                <Pencil className="h-4 w-4 mr-2" />
                编辑
              </Button>
            </Link>
            <Button onClick={handleExportWord} disabled={exporting}>
              {exporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  导出中...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  导出Word
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 基本信息 */}
          <Card>
            <CardHeader>
              <CardTitle>报告信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-500">学员姓名</span>
                <span className="font-medium">{student?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">年级</span>
                <span>{student?.grade || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">学校</span>
                <span>{student?.school || "-"}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-gray-500">反馈周期</span>
                <span className="text-sm">
                  {feedback.period_start &&
                    new Date(feedback.period_start).toLocaleDateString("zh-CN")}
                  {" - "}
                  {feedback.period_end &&
                    new Date(feedback.period_end).toLocaleDateString("zh-CN")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">创建时间</span>
                <span>
                  {new Date(feedback.created_at).toLocaleDateString("zh-CN")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">版本</span>
                <span>v{feedback.version}</span>
              </div>
            </CardContent>
          </Card>

          {/* 学情分析 */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>学情分析</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <h4 className="font-medium text-green-600 mb-2">学员优点</h4>
                  <ul className="space-y-1 text-sm">
                    {feedback.strengths?.map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-green-500">●</span>
                        <span>{item.tag}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-blue-600 mb-2">能力提升</h4>
                  <ul className="space-y-1 text-sm">
                    {feedback.improvements?.map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-blue-500">●</span>
                        <span>{item.tag}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-red-600 mb-2">需要提升</h4>
                  <ul className="space-y-1 text-sm">
                    {feedback.weaknesses?.map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-red-500">●</span>
                        <span>{item.tag}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 教学计划 */}
        {feedback.teaching_plan && feedback.teaching_plan.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>教学计划</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">阶段</th>
                      <th className="text-left p-2">主题</th>
                      <th className="text-left p-2">实验类型</th>
                      <th className="text-left p-2">学科</th>
                      <th className="text-left p-2">知识点</th>
                      <th className="text-left p-2">项目目标</th>
                    </tr>
                  </thead>
                  <tbody>
                    {feedback.teaching_plan.map((item, i) => (
                      <tr key={i} className="border-b">
                        <td className="p-2">{item.stage}</td>
                        <td className="p-2">{item.theme}</td>
                        <td className="p-2">{item.experimentType}</td>
                        <td className="p-2">{item.subject}</td>
                        <td className="p-2">{item.knowledgePoints}</td>
                        <td className="p-2">{item.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 阶段性建议 */}
        {feedback.suggestions && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>阶段性建议</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 whitespace-pre-wrap">
                {feedback.suggestions}
              </p>
            </CardContent>
          </Card>
        )}

        {/* AI报告 - 仅展示纯文本内容，跳过旧格式 JSON 元数据 */}
        {feedback.ai_report && (() => {
          // 向后兼容：如果 metadata 为空且 ai_report 是旧格式 JSON 元数据，不展示
          if (!feedback.metadata || Object.keys(feedback.metadata).length === 0) {
            if (parseAiReport(feedback.ai_report) === null) return null;
          }
          return (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>详细反馈报告</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose max-w-none">
                  <div className="whitespace-pre-wrap text-sm bg-gray-50 p-4 rounded-lg">
                    {feedback.ai_report}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })()}
      </div>
    </div>
  );
}
