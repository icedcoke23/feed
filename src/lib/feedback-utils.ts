import {
  User,
  GraduationCap,
  Tag,
  FileText,
  CheckCircle2,
  Camera,
  Download,
} from "lucide-react";
import type { GeneratedReport, StepConfig } from "@/types/feedback";

export const STEPS: StepConfig[] = [
  { id: "student", title: "选择学员", icon: User },
  { id: "plan", title: "课程规划", icon: GraduationCap },
  { id: "tags", title: "能力评价", icon: Tag },
  { id: "content", title: "生成报告", icon: FileText },
  { id: "photos", title: "学员风采", icon: Camera },
  { id: "export", title: "导出文档", icon: Download },
];

export function generateDescriptionByRating(
  tagName: string,
  rating: number,
  category: string
): string {
  const descriptions: Record<string, Record<number, string[]>> = {
    strength: {
      1: ["在这方面有较大提升空间", "需要重点关注和培养"],
      2: ["表现还不够稳定", "还需要继续努力"],
      3: ["表现一般，有待提升", "有进步空间"],
      4: ["表现较好", "有明显进步"],
      5: ["表现出色", "令人印象深刻", "非常优秀"],
    },
    improvement: {
      1: ["能力提升缓慢", "需要加强训练"],
      2: ["提升速度较慢", "需要更多练习"],
      3: ["正在稳步提升", "进步趋势良好"],
      4: ["提升明显", "进步显著"],
      5: ["进步神速", "提升非常明显", "令人惊喜的进步"],
    },
    weakness: {
      1: ["需要重点加强", "存在明显不足"],
      2: ["需要持续关注", "有待改进"],
      3: ["表现一般", "可以做得更好"],
      4: ["有所改善", "正在进步"],
      5: ["已克服困难", "进步显著", "值得肯定"],
    },
  };

  const categoryDescs = descriptions[category] || descriptions.strength;
  const ratingDescs = categoryDescs[rating] || categoryDescs[3];
  const randomDesc = ratingDescs[Math.floor(Math.random() * ratingDescs.length)];

  return `${tagName}：${randomDesc}`;
}

export function parseGeneratedContent(content: string): GeneratedReport {
  const sections: GeneratedReport = {
    strengths: "",
    improvements: "",
    weaknesses: "",
    recommendations: "",
    summary: "",
  };

  const lines = content.split("\n");
  let currentSection = "";

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine.includes("【学员优点】") || trimmedLine.includes("【优点】")) {
      currentSection = "strengths";
      continue;
    }
    if (trimmedLine.includes("【能力提升】") || trimmedLine.includes("【提升】")) {
      currentSection = "improvements";
      continue;
    }
    if (trimmedLine.includes("【需要提升】") || trimmedLine.includes("【待提升】")) {
      currentSection = "weaknesses";
      continue;
    }
    if (trimmedLine.includes("【阶段性建议】") || trimmedLine.includes("【建议】")) {
      currentSection = "recommendations";
      continue;
    }
    if (trimmedLine.includes("【总结】")) {
      currentSection = "summary";
      continue;
    }

    if (currentSection && trimmedLine) {
      sections[currentSection as keyof GeneratedReport] += line + "\n";
    }
  }

  // 如果没有解析出内容，尝试旧的关键词方式
  if (!sections.strengths && !sections.improvements && !sections.weaknesses) {
    currentSection = "";
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (
        trimmedLine.includes("优点") ||
        trimmedLine.includes("优势") ||
        trimmedLine.includes("强项")
      ) {
        currentSection = "strengths";
      } else if (
        trimmedLine.includes("能力提升") ||
        trimmedLine.includes("进步") ||
        trimmedLine.includes("成长")
      ) {
        currentSection = "improvements";
      } else if (
        trimmedLine.includes("需要提升") ||
        trimmedLine.includes("待提升") ||
        trimmedLine.includes("不足")
      ) {
        currentSection = "weaknesses";
      } else if (trimmedLine.includes("建议") || trimmedLine.includes("推荐")) {
        currentSection = "recommendations";
      } else if (trimmedLine.includes("总结") || trimmedLine.includes("概括")) {
        currentSection = "summary";
      }

      if (currentSection && trimmedLine && !trimmedLine.startsWith("#")) {
        sections[currentSection as keyof GeneratedReport] += line + "\n";
      }
    }
  }

  // 如果仍然没有解析出内容，直接使用原文
  if (!sections.strengths && !sections.improvements) {
    sections.summary = content;
  }

  return sections;
}

