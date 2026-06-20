"use client";

import { useMemo } from "react";
import type { CoursePlan, ReportData } from "@/types/feedback";
import type {
  AnalysisPageData,
  CoursePlanPageData,
  RecommendationPageData,
} from "@/components/business/pdf-analysis-page";

// ============================================================
// 真实行数常量（基于 A4 + text-base/leading-relaxed 实测）
// A4 内容区高度: 297mm - 30mm(top) - 20mm(bottom) = 247mm ≈ 934px
// 每行高度: 16px(font) × 1.625(leading-relaxed) ≈ 26px
// 实际可用行数: 934 / 26 ≈ 35 行（保守取30）
// ============================================================
const CHARS_PER_LINE = 32;   // 保守估计（实际约35字/行）
const LINES_PER_PAGE = 30;   // 真实可用行数

// 各类开销行数估算
const PAGE_HEADER_LINES = 2;    // 页面标题栏（"第一部分：教师教学方案"）
const SECTION_TITLE_LINES = 1;  // 小节标题（"◆ 学情分析"）
const CARD_OVERHEAD_LINES = 2;  // 每个卡片：标题 + 内边距
const SIGNATURE_LINES = 2;      // 落款区域（合并为一行）
const CONT_HEADER_LINES = 1;    // 续页标题（"学情分析（续）"）

// ============================================================
// 文本行数计算
// ============================================================

/** 计算文本实际显示行数（模拟 formatContent 的处理） */
function calculateLines(text: string): number {
  if (!text) return 0;
  const paragraphs = text.split("\n").filter(p => p.trim());
  let totalLines = 0;
  for (const para of paragraphs) {
    // 每段缩进两字符，实际内容长度
    const contentLength = para.trim().length + 2;
    totalLines += Math.ceil(contentLength / CHARS_PER_LINE);
  }
  return totalLines;
}

/** 按行数限制分割文本，返回当前页内容和剩余内容 */
function splitTextByLines(
  text: string,
  maxLines: number
): { content: string; remaining: string } {
  if (!text) return { content: "", remaining: "" };

  const paragraphs = text.split("\n").filter(p => p.trim());
  let currentLines = 0;
  const includedParagraphs: string[] = [];

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i].trim();
    const contentLength = para.length + 2;
    const paraLines = Math.ceil(contentLength / CHARS_PER_LINE);

    if (currentLines + paraLines <= maxLines) {
      includedParagraphs.push(para);
      currentLines += paraLines;
    } else {
      // 无法完整包含这段
      if (includedParagraphs.length === 0) {
        // 第一段就超出，按字符数强制分割
        const availableChars = maxLines * CHARS_PER_LINE - 2;
        if (availableChars > 0 && para.length > availableChars) {
          let splitPoint = availableChars;
          const sentenceEnd = para.lastIndexOf("。", splitPoint);
          if (sentenceEnd > splitPoint * 0.3) {
            splitPoint = sentenceEnd + 1;
          }
          includedParagraphs.push(para.substring(0, splitPoint));
          const remainingParagraphs = [para.substring(splitPoint), ...paragraphs.slice(i + 1)];
          return {
            content: includedParagraphs.join("\n"),
            remaining: remainingParagraphs.join("\n")
          };
        }
      }
      const remainingParagraphs = paragraphs.slice(i);
      return {
        content: includedParagraphs.join("\n"),
        remaining: remainingParagraphs.join("\n")
      };
    }
  }

  return { content: includedParagraphs.join("\n"), remaining: "" };
}

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

/** 根据照片数量计算照片区域占用的行数 */
function calcPhotoLines(photoCount: number): number {
  if (photoCount <= 0) return 0;
  // 照片区域高度：1-2张280px, 3-4张360px, 5-6张440px
  // 每行约36px，加上标题行和间距约2行
  const photoHeight = photoCount <= 2 ? 280 : photoCount <= 4 ? 360 : 440;
  return Math.ceil(photoHeight / 36) + 2;
}

function calculateRecommendationPages(
  recommendations: string,
  summary: string,
  _photoCount: number = 0
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
            reportData.summary || "",
            reportData.studentPhotos?.length || 0
          )
        : [];

    return { analysisPages, coursePlanPages, recommendationPages };
  }, [reportData]);
}
