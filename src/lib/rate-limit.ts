// In-memory sliding window rate limiter
// Suitable for single-server deployment

import { NextResponse } from "next/server";

const requestStore = new Map<string, number[]>();

// Periodic cleanup to prevent memory leaks
const CLEANUP_INTERVAL = 60_000; // 1 minute
let lastCleanup = Date.now();

function cleanup(now: number, windowMs: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  const cutoff = now - windowMs;
  for (const [key, timestamps] of requestStore) {
    const filtered = timestamps.filter((t) => t > cutoff);
    if (filtered.length === 0) {
      requestStore.delete(key);
    } else if (filtered.length !== timestamps.length) {
      requestStore.set(key, filtered);
    }
  }
}

export function checkRateLimit(
  key: string,
  maxRequests: number = 5,
  windowMs: number = 60_000
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const windowStart = now - windowMs;

  cleanup(now, windowMs);

  const timestamps = requestStore.get(key) ?? [];
  // Filter to only timestamps within the current window
  const recent = timestamps.filter((t) => t > windowStart);

  if (recent.length >= maxRequests) {
    // Calculate when the oldest request in the window will expire
    const oldestInWindow = recent[0];
    const retryAfterMs = oldestInWindow + windowMs - now;
    // Still update the store with cleaned timestamps
    requestStore.set(key, recent);
    return { allowed: false, retryAfterMs: Math.max(retryAfterMs, 0) };
  }

  // Allow the request and record the timestamp
  recent.push(now);
  requestStore.set(key, recent);
  return { allowed: true, retryAfterMs: 0 };
}

// 统一的 429 响应，含 Retry-After 头（秒）便于客户端处理
export function rateLimitResponse(retryAfterMs: number): NextResponse {
  const retryAfterSec = Math.max(1, Math.ceil(retryAfterMs / 1000));
  return NextResponse.json(
    { error: "请求过于频繁，请稍后再试", code: "RATE_LIMITED", retryAfter: retryAfterSec },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
  );
}

// 便捷封装：检查限流，若被限则直接返回 429 Response，否则返回 null
// 用法：const limited = enforceRateLimit(`generate:${userId}`, 10, 60_000); if (limited) return limited;
export function enforceRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): NextResponse | null {
  const { allowed, retryAfterMs } = checkRateLimit(key, maxRequests, windowMs);
  if (!allowed) return rateLimitResponse(retryAfterMs);
  return null;
}

// 从请求头提取客户端 IP（用于未登录场景如 login）
export function getClientIp(request: { headers: { get: (name: string) => string | null } }): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}
