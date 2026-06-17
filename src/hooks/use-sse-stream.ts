"use client";

import { useState, useCallback, useRef, useEffect } from "react";

export type ConnectionStatus = "idle" | "connecting" | "connected" | "error";

interface UseSSEStreamOptions {
  onChunk?: (content: string) => void;
  onDone?: (fullContent: string) => void;
  onError?: (error: Error) => void;
}

interface UseSSEStreamReturn {
  streamingContent: string;
  isStreaming: boolean;
  connectionStatus: ConnectionStatus;
  startStream: (url: string, body: Record<string, unknown>) => Promise<string | null>;
  abortStream: () => void;
}

export function useSSEStream(options?: UseSSEStreamOptions): UseSSEStreamReturn {
  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const abortControllerRef = useRef<AbortController | null>(null);

  const startStream = useCallback(async (url: string, body: Record<string, unknown>): Promise<string | null> => {
    setStreamingContent("");
    setIsStreaming(true);
    setConnectionStatus("connecting");

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: abortController.signal,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`请求失败: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("无法读取响应流");

      const decoder = new TextDecoder();
      let fullContent = "";
      let buffer = "";
      let lastDataTime = Date.now();
      const TIMEOUT_MS = 120_000;
      let hasReceivedData = false;

      while (true) {
        // 检查无数据超时
        if (Date.now() - lastDataTime > TIMEOUT_MS) {
          abortController.abort();
          throw new Error("AI响应超时，请稍后重试");
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        lastDataTime = Date.now();

        // 收到第一个数据块时切换为 connected
        if (!hasReceivedData) {
          hasReceivedData = true;
          setConnectionStatus("connected");
        }

        // 按 \n\n 分割，处理完整的 SSE 事件
        const parts = buffer.split("\n\n");
        // 最后一段可能不完整，保留在 buffer 中
        buffer = parts.pop() || "";

        for (const part of parts) {
          const lines = part.split("\n");
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;
            const data = trimmed.slice(6).trim();
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.error) {
                throw new Error(parsed.error);
              }
              if (parsed.content) {
                fullContent += parsed.content;
                setStreamingContent(fullContent);
                options?.onChunk?.(parsed.content);
              }
            } catch (e) {
              // 如果是我们自己抛出的错误，重新抛出
              if (e instanceof Error && e.message !== "AI响应超时，请稍后重试" && e.message.includes("超时")) {
                throw e;
              }
              // 忽略非 JSON 行
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
          const data = trimmed.slice(6).trim();
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) {
              throw new Error(parsed.error);
            }
            if (parsed.content) {
              fullContent += parsed.content;
              setStreamingContent(fullContent);
              options?.onChunk?.(parsed.content);
            }
          } catch (e) {
            if (e instanceof Error && e.message.includes("超时")) {
              throw e;
            }
          }
        }
      }

      setIsStreaming(false);
      setConnectionStatus("idle");
      options?.onDone?.(fullContent);
      return fullContent;
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        // 用户主动取消
      } else {
        setConnectionStatus("error");
        options?.onError?.(error as Error);
      }
      setIsStreaming(false);
      return null;
    } finally {
      abortControllerRef.current = null;
    }
  }, [options]);

  const abortStream = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
    setConnectionStatus("idle");
  }, []);

  // 组件卸载时自动中止流，避免内存泄漏与悬挂请求
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  return { streamingContent, isStreaming, connectionStatus, startStream, abortStream };
}
