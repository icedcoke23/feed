"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Users,
  FileText,
  TrendingUp,
  Calendar,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { AppHeader } from "@/components/business/app-header";
import { AppSidebar } from "@/components/business/app-sidebar";

interface Stats {
  studentCount: number;
  feedbackCount: number;
  thisMonthStudents: number;
  thisMonthFeedbacks: number;
  feedbackTrend: Array<{ date: string; count: number }>;
  gradeDistribution: Array<{ grade: string; count: number }>;
  tagUsage: Array<{ tag: string; strength: number; improvement: number; weakness: number; total: number }>;
  recentFeedbacks: Array<{ id: string; student_name: string; created_at: string; status: string }>;
}

// 条形图组件
function SimpleBarChart({ data, dataKey, labelKey, height = 200 }: {
  data: Array<Record<string, string | number>>;
  dataKey: string;
  labelKey: string;
  height?: number;
}) {
  const maxValue = Math.max(...data.map((d) => d[dataKey] as number));

  return (
    <div className="flex items-end justify-around gap-2" style={{ height }}>
      {data.map((item, index) => (
        <div key={index} className="flex flex-col items-center gap-2 flex-1">
          <div className="relative w-full max-w-12">
            <div
              className="w-full bg-gradient-to-t from-blue-500 to-indigo-500 rounded-t-md transition-all duration-500"
              style={{
                height: `${((item[dataKey] as number) / maxValue) * (height - 30)}px`,
                minHeight: item[dataKey] ? "4px" : "0px",
              }}
            />
            <span className="absolute -top-5 left-1/2 transform -translate-x-1/2 text-xs font-medium">
              {item[dataKey]}
            </span>
          </div>
          <span className="text-xs text-gray-500 truncate max-w-16">
            {item[labelKey]}
          </span>
        </div>
      ))}
    </div>
  );
}

// 饼图模拟组件
function SimplePieChart({ data }: { data: Array<{ grade: string; count: number }> }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const colors = ["bg-blue-500", "bg-green-500", "bg-yellow-500", "bg-purple-500", "bg-pink-500", "bg-indigo-500"];

  return (
    <div className="space-y-3">
      {data.slice(0, 6).map((item, index) => (
        <div key={index} className="flex items-center gap-3">
          <div className={cn("w-3 h-3 rounded-full", colors[index % colors.length])} />
          <span className="text-sm flex-1 truncate">{item.grade}</span>
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full", colors[index % colors.length])}
                style={{ width: `${(item.count / total) * 100}%` }}
              />
            </div>
            <span className="text-sm text-gray-500 w-8">{item.count}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/stats");
      const data = await response.json();
      setStats(data.data);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
      toast.error("获取统计数据失败，请刷新页面重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <AppHeader user={user} onLogout={logout} activeRoute="/dashboard" />

      <div className="flex">
        {/* 侧边栏 */}
        <AppSidebar
          user={user}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          onLogout={logout}
          activeRoute="/dashboard"
        />

        {/* 主内容 */}
        <main className="flex-1 p-4 lg:p-8">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">数据统计</h1>

            {/* 统计卡片 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">学员总数</p>
                      {loading ? (
                        <Skeleton className="h-8 w-16 mt-1" />
                      ) : (
                        <p className="text-3xl font-bold">{stats?.studentCount || 0}</p>
                      )}
                    </div>
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <Users className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">反馈报告</p>
                      {loading ? (
                        <Skeleton className="h-8 w-16 mt-1" />
                      ) : (
                        <p className="text-3xl font-bold">{stats?.feedbackCount || 0}</p>
                      )}
                    </div>
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                      <FileText className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">本月新增学员</p>
                      {loading ? (
                        <Skeleton className="h-8 w-16 mt-1" />
                      ) : (
                        <p className="text-3xl font-bold">{stats?.thisMonthStudents || 0}</p>
                      )}
                    </div>
                    <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                      <TrendingUp className="h-6 w-6 text-purple-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">本月报告数</p>
                      {loading ? (
                        <Skeleton className="h-8 w-16 mt-1" />
                      ) : (
                        <p className="text-3xl font-bold">{stats?.thisMonthFeedbacks || 0}</p>
                      )}
                    </div>
                    <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                      <Calendar className="h-6 w-6 text-orange-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* 反馈趋势 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">近7天反馈趋势</CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-48 w-full" />
                  ) : stats?.feedbackTrend ? (
                    <SimpleBarChart
                      data={stats.feedbackTrend.map((d) => ({
                        ...d,
                        date: new Date(d.date).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" }),
                      }))}
                      dataKey="count"
                      labelKey="date"
                    />
                  ) : null}
                </CardContent>
              </Card>

              {/* 年级分布 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">学员年级分布</CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-3">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Skeleton key={i} className="h-6 w-full" />
                      ))}
                    </div>
                  ) : stats?.gradeDistribution && stats.gradeDistribution.length > 0 ? (
                    <SimplePieChart data={stats.gradeDistribution} />
                  ) : (
                    <p className="text-gray-500 text-center py-8">暂无数据</p>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 标签使用统计 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">热门评价标签</CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-3">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Skeleton key={i} className="h-6 w-full" />
                      ))}
                    </div>
                  ) : stats?.tagUsage && stats.tagUsage.length > 0 ? (
                    <div className="space-y-3">
                      {stats.tagUsage.map((tag, index) => (
                        <div key={index} className="flex items-center gap-3">
                          <span className="text-sm text-gray-500 w-6">{index + 1}</span>
                          <span className="text-sm font-medium flex-1">{tag.tag}</span>
                          <div className="flex gap-1">
                            {tag.strength > 0 && (
                              <Badge variant="secondary" className="bg-green-100 text-green-700">
                                优点 {tag.strength}
                              </Badge>
                            )}
                            {tag.improvement > 0 && (
                              <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                                提升 {tag.improvement}
                              </Badge>
                            )}
                            {tag.weakness > 0 && (
                              <Badge variant="secondary" className="bg-red-100 text-red-700">
                                不足 {tag.weakness}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-8">暂无数据</p>
                  )}
                </CardContent>
              </Card>

              {/* 最近反馈 */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg">最近反馈报告</CardTitle>
                  <Link href="/">
                    <Button variant="ghost" size="sm" className="gap-1">
                      查看全部 <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-3">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : stats?.recentFeedbacks && stats.recentFeedbacks.length > 0 ? (
                    <div className="space-y-3">
                      {stats.recentFeedbacks.map((feedback) => (
                        <Link
                          key={feedback.id}
                          href={`/feedback/${feedback.id}`}
                          className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center text-white font-medium">
                              {feedback.student_name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-medium">{feedback.student_name}</p>
                              <p className="text-sm text-gray-500">
                                {new Date(feedback.created_at).toLocaleDateString("zh-CN")}
                              </p>
                            </div>
                          </div>
                          <Badge variant={feedback.status === "published" ? "default" : "secondary"}>
                            {feedback.status === "published" ? "已发布" : "草稿"}
                          </Badge>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-8">暂无数据</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
