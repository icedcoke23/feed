"use client";

import { useState, useCallback, useRef, useEffect } from "react";

export type ConnectionStatus = "idle" | "connecting" | "connected" | "error";

interface UseSSEStreamOptions {
  onChunk?: (content: string) => void;
  onMetadata?: (metadata: Record<string, unknown>) => void;
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
  const mountCountRef = useRef(0);
  const startLockRef = useRef(false);
  const expectedAbortRef = useRef(false);

  const startStream = useCallback(async (url: string, body: Record<string, unknown>, retryCount = 0): Promise<string | null> => {
    // 防止并发或重复请求（React StrictMode 双 mount、用户快速点击等）
    if (startLockRef.current || abortControllerRef.current) {
      console.warn("[SSE Stream] 已有进行中的流，忽略新请求");
      return null;
    }
    startLockRef.current = true;
    expectedAbortRef.current = false;

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
      const TIMEOUT_MS = 300_000;
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
              if (parsed.metadata && typeof parsed.metadata === "object") {
                options?.onMetadata?.(parsed.metadata as Record<string, unknown>);
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
            if (parsed.metadata && typeof parsed.metadata === "object") {
              options?.onMetadata?.(parsed.metadata as Record<string, unknown>);
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
      const err = error instanceof Error ? error : new Error(String(error));
      if (err.name === "AbortError" || err.message?.includes("abort")) {
        if (!expectedAbortRef.current) {
          // 非预期的中止（如浏览器主动中断），按错误处理
          console.warn("[SSE Stream] 请求被意外中断");
          setConnectionStatus("error");
          options?.onError?.(new Error("请求被中断，请重试"));
        }
        expectedAbortRef.current = false;
      } else if (retryCount < 1 && (err.message?.includes("ERR_ABORTED") || err.message?.includes("Failed to fetch") || err.message?.includes("网络"))) {
        // 网络中断自动重试一次
        console.warn(`[SSE Stream] 连接中断，${retryCount + 1}秒后自动重试...`);
        abortControllerRef.current = null;
        startLockRef.current = false;
        await new Promise(r => setTimeout(r, 2000));
        return startStream(url, body, retryCount + 1);
      } else {
        console.error("[SSE Stream] error:", err.message, err);
        setConnectionStatus("error");
        options?.onError?.(err);
      }
      setIsStreaming(false);
      return null;
    } finally {
      abortControllerRef.current = null;
      startLockRef.current = false;
    }
  }, [options]);

  const abortStream = useCallback(() => {
    expectedAbortRef.current = true;
    abortControllerRef.current?.abort();
    startLockRef.current = false;
    setIsStreaming(false);
    setConnectionStatus("idle");
  }, []);

  // 组件卸载时自动中止流，避免内存泄漏与悬挂请求。
  // 使用 mountCountRef + setTimeout 避免 React StrictMode 双 mount 时误 abort 正在进行的请求。
  useEffect(() => {
    mountCountRef.current += 1;
    return () => {
      mountCountRef.current -= 1;
      const controller = abortControllerRef.current;
      setTimeout(() => {
        if (mountCountRef.current === 0) {
          expectedAbortRef.current = true;
          controller?.abort();
        }
      }, 0);
    };
  }, []);

  return { streamingContent, isStreaming, connectionStatus, startStream, abortStream };
}
