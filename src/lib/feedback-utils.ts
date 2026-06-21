import {
  User,
  GraduationCap,
  Tag,
  FileText,
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

function normalizeHeader(line: string): string {
  return line
    .replace(/^[\s#*\-]+/, "")
    .replace(/[\s#*\-]+$/, "")
    // 去除「第X部分：」或「第X部分」前缀（X=一/二/.../1/2/...）
    .replace(/^第[一二三四五六七八九十\d]+部分[：:]?/, "")
    // 去除「」括号
    .replace(/[「」]/g, "")
    .replace(/[【】\[\]()（）:：]/g, "")
    .replace(/\s+/g, "")
    .trim();
}

/** 去除常见的数字/中文序号前缀，如 "1."、"一、" */
function stripListPrefix(text: string): string {
  return text
    .replace(/^\d+[\.、\)\]\]]+/, "")
    .replace(/^[一二三四五六七八九十]+[\.、\)\]\]]+/, "")
    .trim();
}

type SectionKey = "strengths" | "improvements" | "weaknesses" | "recommendations" | "summary";

const SECTION_KEYS: SectionKey[] = [
  "strengths",
  "improvements",
  "weaknesses",
  "recommendations",
  "summary",
];

function detectSection(line: string): SectionKey | "" {
  const normalized = normalizeHeader(line);
  const clean = stripListPrefix(normalized);

  if (/^(学员)?优点|^优势|^强项|^亮点|^优势与亮点|^突出表现|^闪光点|^优秀表现|^长处/.test(clean)) return "strengths";
  if (/^能力提升|^能力提高|^进步|^成长|^提升|^进步表现|^成长记录|^能力进步|^发展进步/.test(clean)) return "improvements";
  if (/^(需要|待)提升|^不足|^待改进|^改进空间|^改进点|^需要改进|^提升点|^待改进之处|^改进方向|^不足之处|^薄弱环节|^需要加强|^提升空间/.test(clean)) return "weaknesses";
  if (/^(阶段性|教学|学习)?建议|^推荐|^指导意见|^下一步学习规划|^学习规划|^发展建议|^指导建议|^改进建议|^后续建议|^培养建议/.test(clean)) return "recommendations";
  if (/^总结|^概括|^小结|^总体评价|^教师评语|^综合评价|^整体评价|^教师寄语/.test(clean)) return "summary";

  return "";
}

/** 统计非空段落数 */
function countNonEmpty(report: GeneratedReport): number {
  let count = 0;
  if (report.strengths.trim()) count++;
  if (report.improvements.trim()) count++;
  if (report.weaknesses.trim()) count++;
  if (report.recommendations.trim()) count++;
  if (report.summary.trim()) count++;
  return count;
}

function emptyReport(): GeneratedReport {
  return {
    strengths: "",
    improvements: "",
    weaknesses: "",
    recommendations: "",
    summary: "",
  };
}

/** 策略1：基于章节标题匹配 */
function parseByHeaders(content: string): GeneratedReport {
  const sections = emptyReport();

  const lines = content.split("\n");
  let currentSection: SectionKey | "" = "";
  let hasDetectedAnyHeader = false;

  for (const line of lines) {
    const detected = detectSection(line);
    if (detected) {
      currentSection = detected;
      hasDetectedAnyHeader = true;
      continue;
    }

    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    if (currentSection) {
      sections[currentSection] += line + "\n";
    } else if (!hasDetectedAnyHeader) {
      sections.summary += line + "\n";
    }
  }

  if (!hasDetectedAnyHeader) {
    return {
      strengths: "",
      improvements: "",
      weaknesses: "",
      recommendations: "",
      summary: content,
    };
  }

  if (
    !sections.strengths.trim() &&
    !sections.improvements.trim() &&
    !sections.weaknesses.trim() &&
    !sections.recommendations.trim() &&
    !sections.summary.trim()
  ) {
    sections.summary = content;
  }

  return sections;
}

/** 策略2：基于编号段落匹配（一、1.、（一）等） */
function parseByNumberedParagraphs(content: string): GeneratedReport {
  const sections = emptyReport();

  // 匹配中文序号（一、二、...）、阿拉伯数字序号（1. 2.）、括号序号（（一）（二））
  const numberedPattern = /^(?:[一二三四五六七八九十]+[、.．]|（[一二三四五六七八九十]+）|\([一二三四五六七八九十]+\)|\d+[、.．)）])/;

  const lines = content.split("\n");
  const segments: string[] = [];
  let currentSegment = "";

  for (const line of lines) {
    if (numberedPattern.test(line.trim()) && currentSegment.trim()) {
      segments.push(currentSegment.trim());
      currentSegment = line + "\n";
    } else {
      currentSegment += line + "\n";
    }
  }
  if (currentSegment.trim()) {
    segments.push(currentSegment.trim());
  }

  // 按顺序映射到五个 section
  for (let i = 0; i < segments.length && i < SECTION_KEYS.length; i++) {
    sections[SECTION_KEYS[i]] = segments[i];
  }

  return sections;
}

/** 策略3：等分回退 */
function parseByEqualDivision(content: string): GeneratedReport {
  const sections = emptyReport();

  // 按双换行分段
  const paragraphs = content
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (paragraphs.length >= 5) {
    // 等分到五个 section
    const perSection = Math.ceil(paragraphs.length / 5);
    for (let i = 0; i < 5; i++) {
      const start = i * perSection;
      const end = Math.min(start + perSection, paragraphs.length);
      if (start < paragraphs.length) {
        sections[SECTION_KEYS[i]] = paragraphs.slice(start, end).join("\n\n");
      }
    }
  } else {
    // 少于5段：第一段归 strengths，其余归 summary
    if (paragraphs.length > 0) {
      sections.strengths = paragraphs[0];
      if (paragraphs.length > 1) {
        sections.summary = paragraphs.slice(1).join("\n\n");
      }
    }
  }

  return sections;
}

/** 去除内容中整行的标题（Markdown标题、带【】的标题、detectSection匹配的行） */
function cleanSectionContent(content: string): string {
  const lines = content.split("\n");
  const result: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      result.push(line);
      continue;
    }
    const isTitleOnly = /^#{1,6}\s+/.test(trimmed) ||
                        /^[【\[][^】\]]+[】\]]$/.test(trimmed) ||
                        detectSection(trimmed) !== "";
    if (isTitleOnly) continue;
    result.push(line);
  }
  return result.join("\n").trim();
}

export function parseGeneratedContent(content: string): GeneratedReport {
  // 策略1：基于章节标题匹配
  const result1 = parseByHeaders(content);
  const count1 = countNonEmpty(result1);
  if (count1 >= 3) {
    // 清理标题行
    for (const key of SECTION_KEYS) {
      result1[key] = cleanSectionContent(result1[key]);
    }
    return result1;
  }

  // 策略2：基于编号段落匹配
  const result2 = parseByNumberedParagraphs(content);
  const count2 = countNonEmpty(result2);
  if (count2 >= 3) {
    for (const key of SECTION_KEYS) {
      result2[key] = cleanSectionContent(result2[key]);
    }
    return result2;
  }

  // 策略3：等分回退
  const result3 = parseByEqualDivision(content);
  const count3 = countNonEmpty(result3);

  // 选择非空段最多的结果
  const best = count1 >= count2 && count1 >= count3 ? result1
    : count2 >= count1 && count2 >= count3 ? result2
    : result3;
  const bestCount = Math.max(count1, count2, count3);

  // 清理标题行
  for (const key of SECTION_KEYS) {
    best[key] = cleanSectionContent(best[key]);
  }

  if (bestCount < 3) {
    best.parseWarning = true;
  }

  return best;
}

