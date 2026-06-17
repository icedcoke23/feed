import { NextRequest } from "next/server";
import { z } from "zod";
import { getAISettings, sanitizeUserInput } from "@/lib/ai-client";
import { validateInput } from "@/lib/validations";
import https from "https";
import http from "http";
import { isSafeUrlAsync } from "@/lib/ssrf-guard";
import { getAuthUser } from "@/lib/route-auth";
import { errorResponse } from "@/lib/api-response";
import { unauthorizedError } from "@/lib/api-error";

const reviewSchema = z.object({
  studentName: z.string().max(50).optional(),
  theme: z.string().max(100).optional(),
  report: z.object({
    strengths: z.string().optional(),
    improvements: z.string().optional(),
    weaknesses: z.string().optional(),
    recommendations: z.string().optional(),
    summary: z.string().optional(),
  }),
  tagInfo: z.array(z.object({
    name: z.string().max(50),
    rating: z.number().min(1).max(5),
    note: z.string().max(200).optional(),
  })).optional(),
});

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
    const result = validateInput(reviewSchema, body);
    if ("error" in result) return result.error;
    const { studentName, theme, report, tagInfo } = result.data;

    const safeName = studentName ? sanitizeUserInput(studentName) : "学员";
    const safeTheme = theme ? sanitizeUserInput(theme) : "未指定";
    const tagInfoStr = (tagInfo && tagInfo.length > 0)
      ? tagInfo.map((t) => `- ${t.name}: ${t.rating}星${t.note ? "，" + t.note : ""}`).join("\n")
      : "暂无评分数据";

    const prompt = `你是一位资深的教育专家和报告审核员。请对以下教学反馈报告进行复检和优化。

## 学员信息
- 学员姓名：${safeName}
- 教学主题：${safeTheme}

## 原始报告内容

### 学员优点
${report.strengths || "无"}

### 能力提升
${report.improvements || "无"}

### 需要提升
${report.weaknesses || "无"}

### 教学建议
${report.recommendations || "无"}

### 总结
${report.summary || "无"}

## 评价维度评分
${tagInfoStr}

## 复检要求
1. 检查报告内容是否与评分一致
2. 优化语言表达，使其更专业、更具体
3. 确保建议具有可操作性
4. 调整内容结构，使其更清晰
5. 保持原文的核心意思，但可以优化表达方式
6. 确保"需要提升"部分措辞委婉但明确

请直接输出优化后的报告，格式如下：

【学员优点】（优化后的优点描述）

【能力提升】（优化后的提升描述）

【需要提升】（优化后的待提升描述）

【阶段性建议】（优化后的建议）

【总结】（优化后的总结）`;

    const aiSettings = await getAISettings();
    if (!aiSettings?.useCustomAI || !aiSettings.apiKey || !aiSettings.baseUrl) {
      return errorResponse("AI服务未配置，请在系统设置中配置第三方AI参数", 400);
    }

    // SSRF 防护：校验 baseUrl
    const ssrfCheck = await isSafeUrlAsync(aiSettings.baseUrl);
    if (!ssrfCheck.safe) {
      return errorResponse(`AI 服务地址不安全: ${ssrfCheck.reason}`, 400);
    }

    // Use native Node.js http/https to avoid Next.js fetch patching issues
    const aiUrl = new URL(`${aiSettings.baseUrl}/chat/completions`);
    const isHttps = aiUrl.protocol === "https:";
    const requestModule = isHttps ? https : http;

    const aiRequestBody = JSON.stringify({
      model: aiSettings.modelId || "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
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
    console.error("Review error:", error);
    const rawMessage = error instanceof Error ? error.message : "未知错误";
    const sanitizedMessage = rawMessage.replace(/https?:\/\/[^\s]+/gi, "[URL]").replace(/sk-[a-zA-Z0-9]{8,}/g, "[KEY]");
    return errorResponse(`复检失败: ${sanitizedMessage}`, 500);
  }
}
