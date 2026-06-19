import { NextRequest } from "next/server";
import { z } from "zod";
import { getAISettings, sanitizeUserInput } from "@/lib/ai-client";
import { validateInput } from "@/lib/validations";
import { getDomainPrompt, extractEvaluationDimensions } from "@/lib/constants/ai";
import { getCoursePromptByStageCode } from "@/lib/course-prompt";
import https from "https";
import http from "http";
import { isSafeUrlAsync } from "@/lib/ssrf-guard";
import { getAuthUser } from "@/lib/route-auth";
import { getServerSupabaseClient } from "@/storage/database/supabase-client";
import { errorResponse } from "@/lib/api-response";
import { unauthorizedError } from "@/lib/api-error";

const generateSchema = z.object({
  studentName: z.string().min(1).max(50),
  grade: z.string().max(50).optional(),
  className: z.string().max(100).optional(),
  theme: z.string().max(100).optional(),
  themeCategory: z.string().max(50).optional(),
  tagInfo: z.array(z.object({
    name: z.string().max(50),
    category: z.enum(["strength", "improvement", "weakness"]),
    rating: z.number().min(1).max(5),
    note: z.string().max(200).optional().nullable(),
  })).optional(),
  ratings: z.record(z.string(), z.number().min(1).max(5)).optional(),
  notes: z.string().max(2000).optional(),
  courseStageInfo: z.string().max(1000).optional(),
  historyFeedback: z.string().max(3000).optional(),
  history: z.array(z.any()).optional(),
  // 课程阶段提示词相关参数（可选）
  promptStageCode: z.string().max(50).optional(),
  currentStageId: z.string().max(50).optional(),
  level: z.string().max(50).optional(),
});

function formatTagWithRating(tags: Array<{ name: string; rating: number; note?: string | null }>): string {
  if (!tags || tags.length === 0) return "本阶段暂无相关记录。";
  return tags.map((t) => {
    const stars = "⭐".repeat(t.rating || 3);
    return `【${t.name}】${stars} (${t.rating || 3}星)\n${t.note || "表现良好"}`;
  }).join("\n\n");
}

export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return unauthorizedError("未授权访问");
  }

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse("请求体解析失败", 400);
    }
    const result = validateInput(generateSchema, body);
    if ("error" in result) return result.error;
    const { studentName, grade, className, theme, themeCategory, courseStageInfo, tagInfo, history, promptStageCode, currentStageId, level } = result.data;

    let aiSettings: Awaited<ReturnType<typeof getAISettings>>;
    try {
      aiSettings = await getAISettings();
    } catch {
      return errorResponse("获取AI配置失败", 500);
    }

    // 解析课程阶段提示词：优先使用显式传入的 promptStageCode，
    // 否则尝试从 currentStageId 或 theme+level 推导 stage_code
    const supabase = getServerSupabaseClient();
    let courseSystemPrompt: string | null = null;
    let courseReportStructure: string | null = null;
    let stageCodeToQuery = promptStageCode;

    if (!stageCodeToQuery && currentStageId) {
      const { data: stageData } = await supabase
        .from("course_stages")
        .select("stage_code")
        .eq("id", currentStageId)
        .or("is_active.eq.true,is_active.is.null")
        .maybeSingle();
      if (stageData?.stage_code) {
        stageCodeToQuery = stageData.stage_code;
      }
    }

    if (!stageCodeToQuery && theme && level) {
      const { data: stageData } = await supabase
        .from("course_stages")
        .select("stage_code")
        .eq("theme", theme)
        .eq("level", level)
        .or("is_active.eq.true,is_active.is.null")
        .limit(1)
        .maybeSingle();
      if (stageData?.stage_code) {
        stageCodeToQuery = stageData.stage_code;
      }
    }

    if (stageCodeToQuery) {
      const coursePrompt = await getCoursePromptByStageCode(supabase, stageCodeToQuery);
      if (coursePrompt) {
        courseSystemPrompt = coursePrompt.system_prompt;
        courseReportStructure = coursePrompt.report_structure;
      }
    }

    // 组装系统提示词：若找到课程阶段提示词则使用其 system_prompt + report_structure，
    // 否则回退到 getDomainPrompt(theme)；保留与 ai_settings.systemPrompt 的组合逻辑
    let systemPrompt: string;
    if (courseSystemPrompt) {
      const coursePromptText = courseReportStructure
        ? `${courseSystemPrompt}\n\n${courseReportStructure}`
        : courseSystemPrompt;
      systemPrompt = aiSettings?.systemPrompt
        ? `${aiSettings.systemPrompt}\n\n${coursePromptText}`
        : coursePromptText;
    } else {
      const domainPrompt = getDomainPrompt(theme || themeCategory);
      systemPrompt = aiSettings?.systemPrompt
        ? `${aiSettings.systemPrompt}\n\n【补充评价维度】\n${extractEvaluationDimensions(domainPrompt)}`
        : domainPrompt;
    }

    const safeName = sanitizeUserInput(studentName);
    const safeGrade = grade ? sanitizeUserInput(grade) : "未填写";
    const safeClass = className ? sanitizeUserInput(className) : "未填写";
    const safeTheme = theme ? sanitizeUserInput(theme) : "未指定";
    const safeThemeCategory = themeCategory ? sanitizeUserInput(themeCategory) : "";

    let userMessage = `请为学员"${safeName}"撰写一份个性化教学反馈报告。\n\n## 学员基本信息\n- 姓名：${safeName}\n- 年级：${safeGrade}\n- 班级：${safeClass}\n- 教学主题：${safeTheme}${safeThemeCategory ? `（${safeThemeCategory}）` : ""}\n\n## 本阶段学情数据`;

    const strengths = tagInfo?.filter((t) => t.category === "strength") || [];
    const improvements = tagInfo?.filter((t) => t.category === "improvement") || [];
    const weaknesses = tagInfo?.filter((t) => t.category === "weakness") || [];
    userMessage += `\n\n### 学员优点（${strengths.length}项）\n${formatTagWithRating(strengths)}\n\n### 能力提升（${improvements.length}项）\n${formatTagWithRating(improvements)}\n\n### 需要提升的点（${weaknesses.length}项）\n${formatTagWithRating(weaknesses)}`;

    if (courseStageInfo) userMessage += `\n\n## 课程规划信息\n${sanitizeUserInput(courseStageInfo)}`;
    if (history && history.length > 0) {
      userMessage += "\n\n## 历史数据分析";
      history.slice(0, 3).forEach((fb: Record<string, unknown>, i: number) => {
        userMessage += `\n\n### 第${i + 1}次反馈\n- 主题：${fb.teaching_theme || "未记录"}\n- 评分：${fb.overall_rating || "未评分"}星`;
      });
    }

    // 强制输出格式，确保前端能正确解析到五个部分
    userMessage += `\n\n**【重要格式要求】**\n请严格按照以下五个部分撰写报告，每部分必须使用 "## 【标题】" 作为标题行（标题独占一行），内容紧随其后。不要合并、遗漏或调换顺序，不要添加额外的章节。每部分务必精炼，不要超出字数范围：\n\n## 【学员优点】\n（100-150字，详细描述学员的优点和突出表现）\n\n## 【能力提升】\n（100-150字，详细描述学员的能力进步和成长）\n\n## 【需要提升】\n（80-120字，客观指出学员需要改进的方面）\n\n## 【阶段性建议】\n（100-150字，给出具体可操作的教学建议）\n\n## 【总结】\n（40-60字，用2-3句话总结整体表现）\n\n总字数控制在500-700字。`;

    if (!aiSettings?.useCustomAI || !aiSettings.apiKey || !aiSettings.baseUrl) {
      return errorResponse("AI服务未配置，请在系统设置中配置第三方AI参数", 400);
    }

    // SSRF 防护：校验 baseUrl
    const ssrfCheck = await isSafeUrlAsync(aiSettings.baseUrl);
    if (!ssrfCheck.safe) {
      return errorResponse(`AI 服务地址不安全: ${ssrfCheck.reason}`, 400);
    }

    console.log("[GENERATE] Calling AI API...");

    // Use native Node.js http/https to avoid Next.js fetch patching issues
    const aiUrl = new URL(`${aiSettings.baseUrl}/chat/completions`);
    const isHttps = aiUrl.protocol === "https:";
    const requestModule = isHttps ? https : http;

    const aiRequestBody = JSON.stringify({
      model: aiSettings.modelId || "gpt-3.5-turbo",
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }],
      temperature: 0.7,
      stream: true,
    });

    const aiResponse = await new Promise<{ statusCode: number; body: NodeJS.ReadableStream }>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("AI连接超时")), 30000);
      const req = requestModule.request({
        hostname: aiUrl.hostname,
        port: aiUrl.port || (isHttps ? 443 : 80),
        path: aiUrl.pathname + aiUrl.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${aiSettings.apiKey}`,
          "Content-Length": Buffer.byteLength(aiRequestBody),
        },
      }, (res) => {
        clearTimeout(timeout);
        resolve({ statusCode: res.statusCode || 500, body: res });
      });
      req.on("error", (e) => { clearTimeout(timeout); reject(e); });
      req.write(aiRequestBody);
      req.end();
    });

    console.log("[GENERATE] AI API responded:", aiResponse.statusCode);

    if (aiResponse.statusCode >= 300) {
      return errorResponse(`AI请求失败: ${aiResponse.statusCode}`, 500);
    }

    const readableStream = new ReadableStream({
      async start(ctrl) {
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        let buffer = "";
        const tid = setTimeout(() => {
          try { ctrl.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "AI调用超时" })}\n\n`)); } catch {}
          ctrl.close();
        }, 120_000);
        try {
          // 在 reportData.metadata 中记录实际使用的 promptStageCode
          if (stageCodeToQuery) {
            ctrl.enqueue(encoder.encode(`data: ${JSON.stringify({ metadata: { promptStageCode: stageCodeToQuery } })}\n\n`));
          }
          for await (const chunk of aiResponse.body as AsyncIterable<Buffer>) {
            buffer += decoder.decode(chunk, { stream: true });
            const parts = buffer.split("\n\n");
            buffer = parts.pop() || "";
            for (const part of parts) {
              for (const line of part.split("\n")) {
                const t = line.trim();
                if (!t || !t.startsWith("data: ")) continue;
                const d = t.slice(6);
                if (d === "[DONE]") {
                  ctrl.enqueue(encoder.encode("data: [DONE]\n\n"));
                  continue;
                }
                try {
                  const p = JSON.parse(d);
                  const c = p.choices?.[0]?.delta?.content;
                  if (c) ctrl.enqueue(encoder.encode(`data: ${JSON.stringify({ content: c })}\n\n`));
                } catch {}
              }
            }
          }
          ctrl.enqueue(encoder.encode("data: [DONE]\n\n"));
        } catch (err) {
          try { ctrl.enqueue(encoder.encode(`data: ${JSON.stringify({ error: String(err) })}\n\n`)); } catch {}
        } finally {
          clearTimeout(tid);
          ctrl.close();
        }
      },
    });

    return new Response(readableStream, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  } catch (error) {
    console.error("Generate error:", error);
    const rawMessage = error instanceof Error ? error.message : "未知错误";
    const sanitizedMessage = rawMessage.replace(/https?:\/\/[^\s]+/gi, "[URL]").replace(/sk-[a-zA-Z0-9]{8,}/g, "[KEY]");
    return errorResponse(`生成失败: ${sanitizedMessage}`, 500);
  }
}
