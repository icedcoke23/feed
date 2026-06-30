import { describe, expect, test, beforeEach, afterEach, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { POST as loginHandler } from "../route";
import { createTestDb } from "@/test/db";
import { users } from "@/storage/database/shared/schema";
import { hashPassword } from "@/lib/auth";
import type { RouteContext } from "@/lib/route-handlers/types";

// 每个测试使用独立 IP，避免 rate limit 计数在测试间互相污染
const TEST_IPS = ["127.0.0.1", "127.0.0.2", "127.0.0.3"] as const;
// rate limit 测试单独使用一个 IP，避免影响其他用例
const RATE_LIMIT_IP = "127.0.0.4";

let testDb: Awaited<ReturnType<typeof createTestDb>>;

type DrizzleDb = typeof testDb.drizzleDb;

vi.mock("@/storage/database/drizzle-client", () => ({
  db: new Proxy({} as DrizzleDb, {
    get(_, prop) {
      if (!testDb) {
        throw new Error("testDb not initialized");
      }
      return testDb.drizzleDb[prop as keyof DrizzleDb];
    },
  }),
}));

function createLoginRequest(body: object, ip: string) {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": ip,
    },
  });
}

describe("POST /api/auth/login", () => {
  beforeEach(async () => {
    testDb = await createTestDb();
  });

  afterEach(async () => {
    await testDb.client.close();
  });

  async function seedAdminUser() {
    await testDb.drizzleDb.insert(users).values({
      id: "u-admin",
      username: "admin",
      name: "Admin",
      password: await hashPassword("admin123"),
      role: "admin",
      isActive: true,
    });
  }

  test("缺少字段返回 400", async () => {
    const req = createLoginRequest({ username: "admin" }, TEST_IPS[0]);
    const res = await loginHandler(req, {} as RouteContext);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("VALIDATION_ERROR");
    expect(json.error).toBe("请求参数错误");
  });

  test("无效凭据返回 401", async () => {
    const req = createLoginRequest(
      { username: "admin", password: "wrong" },
      TEST_IPS[1]
    );
    const res = await loginHandler(req, {} as RouteContext);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.code).toBe("INVALID_CREDENTIALS");
  });

  test("有效凭据返回 200 并设置 Cookie", async () => {
    await seedAdminUser();
    const req = createLoginRequest(
      { username: "admin", password: "admin123" },
      TEST_IPS[2]
    );
    const res = await loginHandler(req, {} as RouteContext);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.user.username).toBe("admin");
    expect(json.data.user.role).toBe("admin");
    expect(json.message).toBe("登录成功");

    const cookie = (res as NextResponse).cookies.get("auth_token");
    expect(cookie).toBeDefined();
    expect(cookie?.value).toBeTruthy();
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("lax");
    expect(cookie?.path).toBe("/");
    expect(cookie?.maxAge).toBe(60 * 60 * 24);
  });

  test("同一 IP 多次无效登录后触发 rate limit 返回 429", async () => {
    const maxAttempts = 5;

    for (let i = 0; i < maxAttempts; i++) {
      const req = createLoginRequest(
        { username: "admin", password: "wrong" },
        RATE_LIMIT_IP
      );
      const res = await loginHandler(req, {} as RouteContext);
      expect(res.status).toBe(401);
    }

    const blockedReq = createLoginRequest(
      { username: "admin", password: "wrong" },
      RATE_LIMIT_IP
    );
    const blockedRes = await loginHandler(blockedReq, {} as RouteContext);

    expect(blockedRes.status).toBe(429);
    const json = await blockedRes.json();
    expect(json.code).toBe("RATE_LIMITED");
  });
});
