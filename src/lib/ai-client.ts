import { db } from "@/storage/database/drizzle-client";
import { aiSettings } from "@/storage/database/shared/schema";
import { DEFAULT_COZE_MODEL, getDefaultPrompt } from "@/lib/constants/ai";
import { sanitizeErrorMessage } from "@/lib/sensitive-mask";

// AI 设置类型
export interface AISettings {
  apiKey: string;
  baseUrl: string;
  modelId: string;
  maxConcurrent: string;
  systemPrompt: string;
  useCustomAI: boolean;
}

// 获取 AI 设置（从数据库）
export async function getAISettings(): Promise<AISettings | null> {
  try {
    const rows = await db.select().from(aiSettings).limit(1);
    const data = rows[0];

    if (!data) {
      return null;
    }

    return {
      apiKey: data.apiKey || "",
      baseUrl: data.baseUrl || "",
      modelId: data.modelId || DEFAULT_COZE_MODEL,
      maxConcurrent: String(data.maxConcurrent ?? 5),
      systemPrompt: data.systemPrompt || getDefaultPrompt(),
      useCustomAI: data.useCustomAi ?? false,
    };
  } catch (error) {
    console.error("Failed to get AI settings:", error);
    return null;
  }
}

// 掩码密钥检测
export function isMaskedKey(key: string): boolean {
  return key.includes("****");
}

// 流式调用第三方 AI（返回 Response）
export async function streamThirdPartyAI(
  baseUrl: string,
  apiKey: string,
  modelId: string,
  messages: Array<{ role: string; content: string }>,
  temperature: number = 0.7
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120_000);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages,
        temperature,
        stream: true,
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      clearTimeout(timeoutId);
      throw new Error(`API请求失败: ${response.status}`);
    }

    // 创建 ReadableStream 用于转发第三方AI的流式响应
    const readableStream = new ReadableStream({
      async start(streamController) {
        const reader = response.body?.getReader();
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();

        if (!reader) {
          clearTimeout(timeoutId);
          streamController.close();
          return;
        }

        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // 按 \n\n 分割，处理完整的 SSE 事件
            const parts = buffer.split("\n\n");
            // 最后一段可能不完整，保留在 buffer 中
            buffer = parts.pop() || "";

            for (const part of parts) {
              const lines = part.split("\n");
              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith("data: ")) continue;
                const data = trimmed.slice(6);
                if (data === "[DONE]") {
                  streamController.enqueue(encoder.encode(`data: [DONE]\n\n`));
                } else {
                  try {
                    const parsed = JSON.parse(data);
                    const content = parsed.choices?.[0]?.delta?.content || "";
                    if (content) {
                      streamController.enqueue(
                        encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
                      );
                    }
                  } catch {
                    // 忽略解析错误
                  }
                }
              }
            }
          }

          // 处理 buffer 中剩余的数据
          if (buffer.trim()) {
            const lines = buffer.split("\n");
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith("data: ")) continue;
              const data = trimmed.slice(6);
              if (data === "[DONE]") {
                streamController.enqueue(encoder.encode(`data: [DONE]\n\n`));
              } else {
                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content || "";
                  if (content) {
                    streamController.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
                    );
                  }
                } catch {
                  // 忽略解析错误
                }
              }
            }
          }
        } catch (error) {
          if ((error as Error).name === "AbortError") {
            streamController.enqueue(
              encoder.encode(`data: ${JSON.stringify({ error: "AI调用超时" })}\n\n`)
            );
          }
        } finally {
          clearTimeout(timeoutId);
          reader.releaseLock();
          streamController.close();
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    clearTimeout(timeoutId);
    console.error("Third-party AI error:", error);
    // 脱敏：移除错误消息中可能包含的 URL 和 API key
    const rawMessage = error instanceof Error ? error.message : "未知错误";
    const sanitizedMessage = sanitizeErrorMessage(rawMessage);
    return new Response(
      JSON.stringify({ error: `AI调用失败: ${sanitizedMessage}` }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

// 非流式调用第三方 AI
export async function invokeThirdPartyAI(
  baseUrl: string,
  apiKey: string,
  modelId: string,
  messages: Array<{ role: string; content: string }>,
  temperature: number = 0.1
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages,
        temperature,
        stream: false,
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  } finally {
    clearTimeout(timeoutId);
  }
}

// 用户输入转义（防 Prompt 注入）
export function sanitizeUserInput(input: string): string {
  return input
    .replace(/【/g, "[")
    .replace(/】/g, "]")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .substring(0, 500);
}
