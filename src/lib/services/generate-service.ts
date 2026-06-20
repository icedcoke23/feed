import { getAISettings, sanitizeUserInput, streamThirdPartyAI } from "@/lib/ai-client";
import { getDomainPrompt, extractEvaluationDimensions } from "@/lib/constants/ai";
import * as courseStageRepo from "@/lib/repositories/course-stage-repository";
import * as coursePromptRepo from "@/lib/repositories/course-prompt-repository";
import { isSafeUrlAsync } from "@/lib/ssrf-guard";
import { errorResponse } from "@/lib/api-response";

export interface TagInfo {
  name: string;
  category: "strength" | "improvement" | "weakness";
  rating: number;
  note?: string | null;
}

export interface GenerateFeedbackInput {
  studentName: string;
  grade?: string;
  className?: string;
  theme?: string;
  themeCategory?: string;
  tagInfo?: TagInfo[];
  ratings?: Record<string, number>;
  notes?: string;
  courseStageInfo?: string;
  historyFeedback?: string;
  history?: Array<Record<string, unknown>>;
  promptStageCode?: string;
  currentStageId?: string;
  level?: string;
}

export interface ReviewFeedbackInput {
  studentName?: string;
  theme?: string;
  report: {
    strengths?: string;
    improvements?: string;
    weaknesses?: string;
    recommendations?: string;
    summary?: string;
  };
  tagInfo?: Array<{ name: string; rating: number; note?: string | null }>;
  promptStageCode?: string;
  currentStageId?: string;
  level?: string;
}

function formatTagWithRating(tags: Array<{ name: string; rating: number; note?: string | null }>): string {
  if (!tags || tags.length === 0) return "本阶段暂无相关记录。";
  return tags
    .map((t) => {
      const stars = "⭐".repeat(t.rating || 3);
      return `【${t.name}】${stars} (${t.rating || 3}星)\n${t.note || "表现良好"}`;
    })
    .join("\n\n");
}

async function resolveStageCode(input: {
  promptStageCode?: string;
  currentStageId?: string;
  theme?: string;
  level?: string;
}): Promise<{ stageCode: string | null; courseSystemPrompt: string | null }> {
  const { promptStageCode, currentStageId, theme, level } = input;
  let stageCodeToQuery = promptStageCode ?? null;

  if (!stageCodeToQuery && currentStageId) {
    const stage = await courseStageRepo.findById(currentStageId);
    if (stage?.stageCode) {
      stageCodeToQuery = stage.stageCode;
    }
  }

  if (!stageCodeToQuery && theme && level) {
    const stages = await courseStageRepo.list({ theme, level });
    if (stages[0]?.stageCode) {
      stageCodeToQuery = stages[0].stageCode;
    }
  }

  if (!stageCodeToQuery) {
    return { stageCode: null, courseSystemPrompt: null };
  }

  const coursePrompt = await coursePromptRepo.findByStageCode(stageCodeToQuery);
  if (!coursePrompt?.systemPrompt) {
    return { stageCode: stageCodeToQuery, courseSystemPrompt: null };
  }

  const courseSystemPrompt = coursePrompt.reportStructure
    ? `${coursePrompt.systemPrompt}\n\n${coursePrompt.reportStructure}`
    : coursePrompt.systemPrompt;

  return { stageCode: stageCodeToQuery, courseSystemPrompt };
}

async function validateAISettings() {
  const aiSettings = await getAISettings();
  if (!aiSettings?.useCustomAI || !aiSettings.apiKey || !aiSettings.baseUrl) {
    return { valid: false as const, error: errorResponse("AI服务未配置，请在系统设置中配置第三方AI参数", 400) };
  }

  const ssrfCheck = await isSafeUrlAsync(aiSettings.baseUrl);
  if (!ssrfCheck.safe) {
    return { valid: false as const, error: errorResponse(`AI 服务地址不安全: ${ssrfCheck.reason}`, 400) };
  }

  return { valid: true as const, aiSettings };
}

export async function generateFeedback(input: GenerateFeedbackInput): Promise<Response> {
  const validation = await validateAISettings();
  if (!validation.valid) return validation.error;
  const { aiSettings } = validation;

  const { stageCode, courseSystemPrompt } = await resolveStageCode(input);

  let systemPrompt: string;
  if (courseSystemPrompt) {
    const coursePromptText = courseSystemPrompt;
    systemPrompt = aiSettings.systemPrompt
      ? `${aiSettings.systemPrompt}\n\n${coursePromptText}`
      : coursePromptText;
  } else {
    const domainPrompt = getDomainPrompt(input.theme || input.themeCategory);
    systemPrompt = aiSettings.systemPrompt
      ? `${aiSettings.systemPrompt}\n\n【补充评价维度】\n${extractEvaluationDimensions(domainPrompt)}`
      : domainPrompt;
  }

  const safeName = sanitizeUserInput(input.studentName);
  const safeGrade = input.grade ? sanitizeUserInput(input.grade) : "未填写";
  const safeClass = input.className ? sanitizeUserInput(input.className) : "未填写";
  const safeTheme = input.theme ? sanitizeUserInput(input.theme) : "未指定";
  const safeThemeCategory = input.themeCategory ? sanitizeUserInput(input.themeCategory) : "";

  let userMessage = `请为学员"${safeName}"撰写一份个性化教学反馈报告。\n\n## 学员基本信息\n- 姓名：${safeName}\n- 年级：${safeGrade}\n- 班级：${safeClass}\n- 教学主题：${safeTheme}${safeThemeCategory ? `（${safeThemeCategory}）` : ""}\n\n## 本阶段学情数据`;

  const strengths = input.tagInfo?.filter((t) => t.category === "strength") || [];
  const improvements = input.tagInfo?.filter((t) => t.category === "improvement") || [];
  const weaknesses = input.tagInfo?.filter((t) => t.category === "weakness") || [];

  userMessage += `\n\n### 学员优点（${strengths.length}项）\n${formatTagWithRating(strengths)}\n\n### 能力提升（${improvements.length}项）\n${formatTagWithRating(improvements)}\n\n### 需要提升的点（${weaknesses.length}项）\n${formatTagWithRating(weaknesses)}`;

  if (input.courseStageInfo) {
    userMessage += `\n\n## 课程规划信息\n${sanitizeUserInput(input.courseStageInfo)}`;
  }

  if (input.history && input.history.length > 0) {
    userMessage += "\n\n## 历史数据分析";
    input.history.slice(0, 3).forEach((fb: Record<string, unknown>, i: number) => {
      userMessage += `\n\n### 第${i + 1}次反馈\n- 主题：${fb.teaching_theme || "未记录"}\n- 评分：${fb.overall_rating || "未评分"}星`;
    });
  }

  userMessage += `\n\n**【重要格式要求】**\n请严格按照以下五个部分撰写报告，每部分必须使用 "## 【标题】" 作为标题行（标题独占一行），内容紧随其后。不要合并、遗漏或调换顺序，不要添加额外的章节。每部分务必精炼，不要超出字数范围：\n\n## 【学员优点】\n（100-150字，详细描述学员的优点和突出表现）\n\n## 【能力提升】\n（100-150字，详细描述学员的能力进步和成长）\n\n## 【需要提升】\n（80-120字，客观指出学员需要改进的方面）\n\n## 【阶段性建议】\n（100-150字，给出具体可操作的教学建议）\n\n## 【总结】\n（40-60字，用2-3句话总结整体表现）\n\n总字数控制在500-700字。`;

  const response = await streamThirdPartyAI(
    aiSettings.baseUrl,
    aiSettings.apiKey,
    aiSettings.modelId,
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    0.7
  );

  return wrapWithMetadata(response, stageCode);
}

export async function reviewFeedback(input: ReviewFeedbackInput): Promise<Response> {
  const validation = await validateAISettings();
  if (!validation.valid) return validation.error;
  const { aiSettings } = validation;

  const { stageCode, courseSystemPrompt } = await resolveStageCode(input);

  const safeName = input.studentName ? sanitizeUserInput(input.studentName) : "学员";
  const safeTheme = input.theme ? sanitizeUserInput(input.theme) : "未指定";
  const tagInfoStr =
    input.tagInfo && input.tagInfo.length > 0
      ? input.tagInfo.map((t) => `- ${t.name}: ${t.rating}星${t.note ? "，" + t.note : ""}`).join("\n")
      : "暂无评分数据";

  const prompt = `你是一位资深的教育专家和报告审核员。请对以下教学反馈报告进行复检和优化。\n\n## 学员信息\n- 学员姓名：${safeName}\n- 教学主题：${safeTheme}\n\n## 原始报告内容\n\n### 学员优点\n${input.report.strengths || "无"}\n\n### 能力提升\n${input.report.improvements || "无"}\n\n### 需要提升\n${input.report.weaknesses || "无"}\n\n### 教学建议\n${input.report.recommendations || "无"}\n\n### 总结\n${input.report.summary || "无"}\n\n## 评价维度评分\n${tagInfoStr}\n\n## 复检要求\n1. 检查报告内容是否与评分一致\n2. 优化语言表达，使其更专业、更具体\n3. 确保建议具有可操作性\n4. 调整内容结构，使其更清晰\n5. 保持原文的核心意思，但可以优化表达方式\n6. 确保"需要提升"部分措辞委婉但明确\n\n请直接输出优化后的报告，每部分必须使用 "## 【标题】" 作为标题行，格式如下（注意字数限制）：\n\n## 【学员优点】\n（100-150字，优化后的优点描述）\n\n## 【能力提升】\n（100-150字，优化后的提升描述）\n\n## 【需要提升】\n（80-120字，优化后的待提升描述）\n\n## 【阶段性建议】\n（100-150字，优化后的建议）\n\n## 【总结】\n（40-60字，优化后的总结）\n\n总字数控制在500-700字，每部分务必精炼。`;

  const messages = courseSystemPrompt
    ? [
        { role: "system" as const, content: courseSystemPrompt },
        { role: "user" as const, content: prompt },
      ]
    : [{ role: "user" as const, content: prompt }];

  const response = await streamThirdPartyAI(
    aiSettings.baseUrl,
    aiSettings.apiKey,
    aiSettings.modelId,
    messages,
    0.5
  );

  return wrapWithMetadata(response, stageCode);
}

function wrapWithMetadata(aiResponse: Response, stageCode: string | null): Response {
  if (!stageCode || !aiResponse.body) {
    return aiResponse;
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = aiResponse.body.getReader();

  let metadataSent = false;
  let buffer = "";

  const stream = new ReadableStream({
    async start(controller) {
      const tid = setTimeout(() => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "AI调用超时" })}\n\n`));
        } catch {}
        controller.close();
      }, 120_000);

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          if (!metadataSent) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ metadata: { promptStageCode: stageCode } })}\n\n`)
            );
            metadataSent = true;
          }

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() || "";

          for (const part of parts) {
            for (const line of part.split("\n")) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith("data: ")) continue;
              const data = trimmed.slice(6);
              if (data === "[DONE]") {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                continue;
              }
              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
                }
              } catch {}
            }
          }
        }

        if (buffer.trim()) {
          for (const line of buffer.split("\n")) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;
            const data = trimmed.slice(6);
            if (data === "[DONE]") {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              continue;
            }
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
              }
            } catch {}
          }
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: String(err) })}\n\n`));
        } catch {}
      } finally {
        clearTimeout(tid);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
