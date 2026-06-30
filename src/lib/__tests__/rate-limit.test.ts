import { describe, expect, test } from "vitest";
import {
  checkRateLimit,
  enforceRateLimit,
  getClientIp,
  rateLimitResponse,
} from "@/lib/rate-limit";

// rate-limit.ts 持有模块级 requestStore，测试间用唯一 key 隔离，避免相互干扰。
describe("rate-limit", () => {
  describe("checkRateLimit", () => {
    test("未达上限时放行并记录请求", () => {
      const key = `test-allow-${Date.now()}-${Math.random()}`;
      const r1 = checkRateLimit(key, 3, 60_000);
      expect(r1.allowed).toBe(true);
      expect(r1.retryAfterMs).toBe(0);

      const r2 = checkRateLimit(key, 3, 60_000);
      expect(r2.allowed).toBe(true);
    });

    test("达到上限时拒绝并返回正数 retryAfterMs", () => {
      const key = `test-block-${Date.now()}-${Math.random()}`;
      checkRateLimit(key, 2, 60_000);
      checkRateLimit(key, 2, 60_000);
      const r3 = checkRateLimit(key, 2, 60_000);
      expect(r3.allowed).toBe(false);
      expect(r3.retryAfterMs).toBeGreaterThan(0);
      // 不应超过窗口长度
      expect(r3.retryAfterMs).toBeLessThanOrEqual(60_000);
    });

    test("不同 key 互不影响", () => {
      const keyA = `test-isolated-a-${Date.now()}`;
      const keyB = `test-isolated-b-${Date.now()}`;
      checkRateLimit(keyA, 1, 60_000);
      expect(checkRateLimit(keyA, 1, 60_000).allowed).toBe(false);
      // keyB 未消耗配额，应放行
      expect(checkRateLimit(keyB, 1, 60_000).allowed).toBe(true);
    });

    test("窗口过期后恢复配额", () => {
      const key = `test-window-${Date.now()}-${Math.random()}`;
      // 使用 50ms 短窗口便于测试
      checkRateLimit(key, 1, 50);
      expect(checkRateLimit(key, 1, 50).allowed).toBe(false);
      // 等待窗口过期
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const r = checkRateLimit(key, 1, 50);
          expect(r.allowed).toBe(true);
          resolve();
        }, 60);
      });
    });

    test("默认参数：5 次每分钟", () => {
      const key = `test-default-${Date.now()}-${Math.random()}`;
      for (let i = 0; i < 5; i++) {
        expect(checkRateLimit(key).allowed).toBe(true);
      }
      // 第 6 次应被拒绝
      expect(checkRateLimit(key).allowed).toBe(false);
    });
  });

  describe("rateLimitResponse", () => {
    test("返回 429 状态码与 Retry-After 头", async () => {
      const res = rateLimitResponse(30_000);
      expect(res.status).toBe(429);
      expect(res.headers.get("Retry-After")).toBe("30");
      const body = await res.json();
      expect(body.code).toBe("RATE_LIMITED");
      expect(body.error).toBeTruthy();
      expect(body.retryAfter).toBe(30);
    });

    test("retryAfterMs 不足 1 秒时向上取整为 1 秒", async () => {
      const res = rateLimitResponse(100);
      expect(res.headers.get("Retry-After")).toBe("1");
    });
  });

  describe("enforceRateLimit", () => {
    test("放行时返回 null", () => {
      const key = `test-enforce-allow-${Date.now()}-${Math.random()}`;
      const result = enforceRateLimit(key, 5, 60_000);
      expect(result).toBeNull();
    });

    test("超限返回 429 Response", async () => {
      const key = `test-enforce-block-${Date.now()}-${Math.random()}`;
      enforceRateLimit(key, 1, 60_000);
      const blocked = enforceRateLimit(key, 1, 60_000);
      expect(blocked).not.toBeNull();
      expect(blocked!.status).toBe(429);
    });
  });

  describe("getClientIp", () => {
    test("优先使用 x-forwarded-for 第一个 IP", () => {
      const req = {
        headers: {
          get: (name: string) =>
            name === "x-forwarded-for"
              ? "1.2.3.4, 5.6.7.8"
              : name === "x-real-ip"
                ? "9.9.9.9"
                : null,
        },
      };
      expect(getClientIp(req)).toBe("1.2.3.4");
    });

    test("回退到 x-real-ip", () => {
      const req = {
        headers: {
          get: (name: string) => (name === "x-real-ip" ? "9.9.9.9" : null),
        },
      };
      expect(getClientIp(req)).toBe("9.9.9.9");
    });

    test("无头时返回 unknown", () => {
      const req = { headers: { get: () => null } };
      expect(getClientIp(req)).toBe("unknown");
    });
  });
});
