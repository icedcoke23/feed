import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/storage/database/supabase-client";
import { forbiddenError } from "@/lib/api-error";
import { getAuthUser } from "@/lib/route-auth";
import { errorResponse } from "@/lib/api-response";

// GET /api/data/export - 导出所有数据为JSON
export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  if (authUser.userRole !== "admin") {
    return forbiddenError("仅管理员可访问");
  }

  const client = getServerSupabaseClient();

  try {
    // 并行获取所有数据
    const [
      studentsResult,
      classesResult,
      feedbacksResult,
      themesResult,
      tagsResult,
      courseStagesResult,
      classTransfersResult,
      teachersResult,
    ] = await Promise.all([
      client.from("students").select("*"),
      client.from("classes").select("*"),
      client.from("feedbacks").select("*"),
      client.from("teaching_themes").select("*"),
      client.from("tags").select("*"),
      client.from("course_stages").select("*"),
      client.from("class_transfers").select("*"),
      // 只导出教师用户，不导出管理员
      client.from("users").select("id, username, name, role, phone, is_active, created_at").eq("role", "teacher"),
    ]);

    // 收集错误信息
    const errors: string[] = [];
    if (studentsResult.error) errors.push(`students: ${studentsResult.error.message}`);
    if (classesResult.error) errors.push(`classes: ${classesResult.error.message}`);
    if (feedbacksResult.error) errors.push(`feedbacks: ${feedbacksResult.error.message}`);
    if (themesResult.error) errors.push(`teaching_themes: ${themesResult.error.message}`);
    if (tagsResult.error) errors.push(`tags: ${tagsResult.error.message}`);
    if (courseStagesResult.error) errors.push(`course_stages: ${courseStagesResult.error.message}`);
    if (classTransfersResult.error) errors.push(`class_transfers: ${classTransfersResult.error.message}`);
    if (teachersResult.error) errors.push(`teachers: ${teachersResult.error.message}`);

    if (errors.length > 0) {
      console.error("Export errors:", errors);
      return errorResponse("导出部分数据失败", 500);
    }

    // 组装导出数据
    const exportData = {
      exportTime: new Date().toISOString(),
      version: "1.2",
      description: "教学反馈系统数据备份",
      data: {
        students: studentsResult.data || [],
        classes: classesResult.data || [],
        feedbacks: feedbacksResult.data || [],
        themes: themesResult.data || [],
        tags: tagsResult.data || [],
        courseStages: courseStagesResult.data || [],
        classTransfers: classTransfersResult.data || [],
        teachers: teachersResult.data || [],
      },
      summary: {
        studentsCount: studentsResult.data?.length || 0,
        classesCount: classesResult.data?.length || 0,
        feedbacksCount: feedbacksResult.data?.length || 0,
        themesCount: themesResult.data?.length || 0,
        tagsCount: tagsResult.data?.length || 0,
        courseStagesCount: courseStagesResult.data?.length || 0,
        classTransfersCount: classTransfersResult.data?.length || 0,
        teachersCount: teachersResult.data?.length || 0,
      },
      notes: [
        "此备份文件包含所有业务数据和教师用户数据",
        "不包含管理员用户数据",
        "导入时支持增量模式（合并）和覆盖模式（清空后导入）",
        "导入时将保留现有管理员用户账号",
      ],
    };

    return NextResponse.json(exportData);
  } catch (error) {
    console.error("Export error:", error);
    const errorMessage = error instanceof Error ? error.message : "未知错误";
    return errorResponse("导出数据失败", 500);
  }
}
