"use client";

import { useState, useEffect } from "react";
import type { CoursePlan, ReportData } from "@/types/feedback";
import type {
  AnalysisPageData,
  CoursePlanPageData,
  RecommendationPageData,
} from "@/components/business/pdf-analysis-page";

// 计算文本实际显示行数
function calculateLines(text: string, charsPerLine: number): number {
  if (!text) return 0;

  // 模拟formatContent的处理：按换行分割，每段缩进，段间无额外空行
  const paragraphs = text.split("\n").filter(p => p.trim());

  let totalLines = 0;
  for (const para of paragraphs) {
    // 每段开头缩进两字符，实际内容长度
    const contentLength = para.trim().length + 2; // +2 for indent
    // 计算该段需要的行数（向上取整）
    const paraLines = Math.ceil(contentLength / charsPerLine);
    totalLines += paraLines;
  }

  return totalLines;
}

// 根据行数限制分割文本
function splitTextByLines(
  text: string,
  maxLines: number,
  charsPerLine: number
): { content: string; remaining: string } {
  if (!text) return { content: "", remaining: "" };

  const paragraphs = text.split("\n").filter(p => p.trim());
  let currentLines = 0;
  const includedParagraphs: string[] = [];

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i].trim();
    const contentLength = para.length + 2; // +2 for indent
    const paraLines = Math.ceil(contentLength / charsPerLine);

    // 检查是否可以包含这段（段间无额外空行）
    if (currentLines + paraLines <= maxLines) {
      includedParagraphs.push(para);
      currentLines += paraLines;
    } else {
      // 无法完整包含这段，需要分割
      if (includedParagraphs.length === 0) {
        // 如果是第一段就超出，按字符数强制分割
        const availableChars = maxLines * charsPerLine - 2; // -2 for indent
        if (availableChars > 0 && para.length > availableChars) {
          // 找到合适的分割点
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
      // 返回已包含的段落和剩余段落
      const remainingParagraphs = paragraphs.slice(i);
      return {
        content: includedParagraphs.join("\n"),
        remaining: remainingParagraphs.join("\n")
      };
    }
  }

  // 所有内容都能放入
  return {
    content: includedParagraphs.join("\n"),
    remaining: ""
  };
}

// 计算学情分析的分页（基于行数）- 支持三个部分
function calculateAnalysisPages(
  strengths: string,
  improvements: string,
  weaknesses: string
): AnalysisPageData[] {
  // 如果三者都为空，不创建任何分析页面
  if (!strengths?.trim() && !improvements?.trim() && !weaknesses?.trim()) {
    return [];
  }

  const CHARS_PER_LINE = 30;
  const LINES_PER_PAGE = 35;
  const HEADER_LINES = 3;

  const pages: AnalysisPageData[] = [];

  let remainingStrengths = strengths || "";
  let remainingImprovements = improvements || "";
  let remainingWeaknesses = weaknesses || "";
  let isFirstPage = true;

  while (remainingStrengths || remainingImprovements || remainingWeaknesses) {
    const pageContent: AnalysisPageData = {
      showTitle: isFirstPage,
      isContinuation: !isFirstPage,
    };

    // 计算当前页可用行数
    const availableLines = isFirstPage ? LINES_PER_PAGE - HEADER_LINES : LINES_PER_PAGE - 1;

    // 卡片标题和边距约2行
    let contentAvailableLines = Math.max(1, availableLines - 2);

    // 处理学员优点
    if (remainingStrengths) {
      const strengthsLines = calculateLines(remainingStrengths, CHARS_PER_LINE);

      if (strengthsLines <= contentAvailableLines) {
        pageContent.strengths = remainingStrengths;
        pageContent.strengthsLabel = isFirstPage ? "描述学员优点：" : "学员优点（续）：";
        remainingStrengths = "";

        const usedLines = strengthsLines + 2;
        contentAvailableLines = contentAvailableLines - usedLines - 1;
      } else {
        const result = splitTextByLines(remainingStrengths, contentAvailableLines, CHARS_PER_LINE);
        pageContent.strengths = result.content;
        pageContent.strengthsLabel = isFirstPage ? "描述学员优点：" : "学员优点（续）：";
        remainingStrengths = result.remaining;
      }
    }

    // 处理能力提升
    if (!remainingStrengths && remainingImprovements && contentAvailableLines > 2) {
      const improvementsLines = calculateLines(remainingImprovements, CHARS_PER_LINE);

      if (improvementsLines <= contentAvailableLines) {
        pageContent.improvements = remainingImprovements;
        pageContent.improvementsLabel = isFirstPage && !pageContent.strengths ? "能力提升：" : (pageContent.strengths ? "能力提升：" : "能力提升（续）：");
        remainingImprovements = "";
        const usedLines = improvementsLines + 2;
        contentAvailableLines = contentAvailableLines - usedLines - 1;
      } else {
        const result = splitTextByLines(remainingImprovements, contentAvailableLines, CHARS_PER_LINE);
        pageContent.improvements = result.content;
        pageContent.improvementsLabel = pageContent.strengths ? "能力提升：" : "能力提升（续）：";
        remainingImprovements = result.remaining;
      }
    }

    // 处理需要提升
    if (!remainingStrengths && !remainingImprovements && remainingWeaknesses && contentAvailableLines > 2) {
      const weaknessesLines = calculateLines(remainingWeaknesses, CHARS_PER_LINE);

      if (weaknessesLines <= contentAvailableLines) {
        pageContent.weaknesses = remainingWeaknesses;
        pageContent.weaknessesLabel = isFirstPage && !pageContent.strengths && !pageContent.improvements ? "需要提升：" : "需要提升：";
        remainingWeaknesses = "";
      } else {
        const result = splitTextByLines(remainingWeaknesses, contentAvailableLines, CHARS_PER_LINE);
        pageContent.weaknesses = result.content;
        pageContent.weaknessesLabel = "需要提升：";
        remainingWeaknesses = result.remaining;
      }
    }

    // 只有当页面有实际内容时才添加
    if (pageContent.strengths || pageContent.improvements || pageContent.weaknesses) {
      pages.push(pageContent);
    }
    isFirstPage = false;
  }

  return pages;
}

// 计算课程规划表格分页
function calculateCoursePlanPages(plans: CoursePlan[]): CoursePlanPageData[] {
  const ROWS_PER_FIRST_PAGE = 8;
  const ROWS_PER_PAGE = 10;

  const pages: CoursePlanPageData[] = [];

  let remainingPlans = [...plans];
  let pageNum = 1;

  // 首页
  if (remainingPlans.length > 0) {
    const firstPagePlans = remainingPlans.splice(0, ROWS_PER_FIRST_PAGE);
    pages.push({
      plans: firstPagePlans,
      isFirstPage: true,
      pageNum,
      totalPages: Math.ceil((plans.length - ROWS_PER_FIRST_PAGE) / ROWS_PER_PAGE) + 1
    });
    pageNum++;
  }

  // 后续页
  while (remainingPlans.length > 0) {
    const pagePlans = remainingPlans.splice(0, ROWS_PER_PAGE);
    pages.push({
      plans: pagePlans,
      isFirstPage: false,
      pageNum,
      totalPages: Math.ceil((plans.length - ROWS_PER_FIRST_PAGE) / ROWS_PER_PAGE) + 1
    });
    pageNum++;
  }

  return pages;
}

// 计算教师建议的分页
function calculateRecommendationPages(recommendations: string): RecommendationPageData[] {
  if (!recommendations) {
    return [];
  }

  const CHARS_PER_LINE = 30;
  const LINES_PER_PAGE = 35;
  const HEADER_LINES = 2;
  const FOOTER_LINES = 4;

  const pages: RecommendationPageData[] = [];

  let remainingContent = recommendations;
  let pageNum = 1;

  while (remainingContent) {
    const isFirstPage = pages.length === 0;
    const availableLines = isFirstPage
      ? LINES_PER_PAGE - HEADER_LINES - FOOTER_LINES
      : LINES_PER_PAGE - 2;

    const result = splitTextByLines(remainingContent, availableLines, CHARS_PER_LINE);

    if (result.content) {
      const totalPages = Math.ceil(calculateLines(recommendations, CHARS_PER_LINE) / availableLines);
      pages.push({
        content: result.content,
        isFirstPage,
        pageNum,
        totalPages: Math.max(totalPages, pageNum)
      });
      pageNum++;
    }

    remainingContent = result.remaining;
    if (!result.remaining) break;
  }

  // 更新总页数
  const totalPages = pages.length;
  return pages.map(p => ({ ...p, totalPages }));
}

export interface UsePdfPaginationReturn {
  analysisPages: AnalysisPageData[];
  coursePlanPages: CoursePlanPageData[];
  recommendationPages: RecommendationPageData[];
}

export function usePdfPagination(reportData: ReportData | null): UsePdfPaginationReturn {
  const [analysisPages, setAnalysisPages] = useState<AnalysisPageData[]>([]);
  const [coursePlanPages, setCoursePlanPages] = useState<CoursePlanPageData[]>([]);
  const [recommendationPages, setRecommendationPages] = useState<RecommendationPageData[]>([]);

  useEffect(() => {
    if (!reportData) return;

    // 计算学情分析分页
    const analysis = calculateAnalysisPages(
      reportData.strengths || "",
      reportData.improvements || "",
      reportData.weaknesses || ""
    );
    setAnalysisPages(analysis);

    // 计算课程规划分页
    if (reportData.hasCoursePlan && reportData.coursePlans && reportData.coursePlans.length > 0) {
      const coursePlan = calculateCoursePlanPages(reportData.coursePlans);
      setCoursePlanPages(coursePlan);
    } else {
      setCoursePlanPages([]);
    }

    // 计算教师建议分页
    if (reportData.recommendations) {
      const rec = calculateRecommendationPages(reportData.recommendations);
      setRecommendationPages(rec);
    } else {
      setRecommendationPages([]);
    }
  }, [reportData]);

  return { analysisPages, coursePlanPages, recommendationPages };
}
