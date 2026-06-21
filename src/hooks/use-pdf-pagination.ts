"use client";

import { useMemo } from "react";
import type { CoursePlan, ReportData } from "@/types/feedback";
import type {
  AnalysisPageData,
  CoursePlanPageData,
  RecommendationPageData,
} from "@/components/business/pdf-analysis-page";

// ============================================================
// 学情分析分页（强制单页，超出内容智能截断）
// ============================================================

/** 计算学情分析分页 - 强制单页显示，不截断内容 */
function calculateAnalysisPages(
  strengths: string,
  improvements: string,
  weaknesses: string
): AnalysisPageData[] {
  if (!strengths?.trim() && !improvements?.trim() && !weaknesses?.trim()) {
    return [];
  }

  // 强制单页，返回完整内容，由 CSS overflow 控制显示
  return [{
    showTitle: true,
    isContinuation: false,
    strengths: strengths?.trim() || undefined,
    improvements: improvements?.trim() || undefined,
    weaknesses: weaknesses?.trim() || undefined,
    strengthsLabel: "学员优点",
    improvementsLabel: "能力提升",
    weaknessesLabel: "需要提升",
  }];
}

// ============================================================
// 课程规划分页（目标1页，最多2页）
// ============================================================

function calculateCoursePlanPages(plans: CoursePlan[]): CoursePlanPageData[] {
  // 每页可用行数（表格行，非文本行）
  // 首页需要减去页面标题和表格标题
  const ROWS_PER_FIRST_PAGE = 7;
  const ROWS_PER_CONT_PAGE = 10;
  const MAX_PAGES = 2;

  const pages: CoursePlanPageData[] = [];
  const remainingPlans = [...plans];
  let pageNum = 1;

  // 首页
  if (remainingPlans.length > 0) {
    const firstPagePlans = remainingPlans.splice(0, ROWS_PER_FIRST_PAGE);
    pages.push({
      plans: firstPagePlans,
      isFirstPage: true,
      pageNum,
      totalPages: 1, // 先设为1，后面更新
    });
    pageNum++;
  }

  // 后续页（最多再1页，总共2页）
  if (remainingPlans.length > 0 && pages.length < MAX_PAGES) {
    const pagePlans = remainingPlans.splice(0, ROWS_PER_CONT_PAGE);
    pages.push({
      plans: pagePlans,
      isFirstPage: false,
      pageNum,
      totalPages: 1,
    });
  }

  // 如果还有剩余行（超过2页容量），追加到最后一页
  if (remainingPlans.length > 0 && pages.length > 0) {
    const lastPage = pages[pages.length - 1];
    lastPage.plans = [...lastPage.plans, ...remainingPlans];
  }

  // 更新总页数
  const totalPages = pages.length;
  return pages.map(p => ({ ...p, totalPages }));
}

// ============================================================
// 教师建议分页（智能1-2页，落款和照片仅在最后一页）
// ============================================================

function calculateRecommendationPages(
  recommendations: string,
  summary: string
): RecommendationPageData[] {
  if (!recommendations?.trim() && !summary?.trim()) {
    return [];
  }

  // 强制单页，返回完整内容，由 CSS overflow 控制显示
  return [{
    content: recommendations?.trim() || "",
    summary: summary?.trim() || undefined,
    isFirstPage: true,
    pageNum: 1,
    totalPages: 1,
    isLastPage: true,
  }];
}

// ============================================================
// Hook
// ============================================================

export interface UsePdfPaginationReturn {
  analysisPages: AnalysisPageData[];
  coursePlanPages: CoursePlanPageData[];
  recommendationPages: RecommendationPageData[];
}

export function usePdfPagination(reportData: ReportData | null): UsePdfPaginationReturn {
  return useMemo(() => {
    if (!reportData) {
      return { analysisPages: [], coursePlanPages: [], recommendationPages: [] };
    }

    // 学情分析分页
    const analysisPages = calculateAnalysisPages(
      reportData.strengths || "",
      reportData.improvements || "",
      reportData.weaknesses || ""
    );

    // 课程规划分页
    const coursePlanPages =
      reportData.hasCoursePlan && reportData.coursePlans && reportData.coursePlans.length > 0
        ? calculateCoursePlanPages(reportData.coursePlans)
        : [];

    // 教师建议分页（传入总结和照片数量）
    const recommendationPages =
      reportData.recommendations || reportData.summary
        ? calculateRecommendationPages(
            reportData.recommendations || "",
            reportData.summary || ""
          )
        : [];

    return { analysisPages, coursePlanPages, recommendationPages };
  }, [reportData]);
}
