import { describe, expect, test, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as meHandler } from "../route";
import { createTestDb } from "@/test/db";
import { users } from "@/storage/database/shared/schema";
import { hashPassword, signToken, COOKIE_NAME } from "@/lib/auth";

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

function createMeRequest(cookie?: string) {
  const headers: Record<string, string> = {};
  if (cookie) {
    headers.Cookie = cookie;
  }
  return new NextRequest("http://localhost/api/auth/me", {
    method: "GET",
    headers,
  });
}

describe("GET /api/auth/me", () => {
  beforeEach(async () => {
    testDb = await createTestDb();
  });

  afterEach(async () => {
    await testDb.client.close();
  });

  async function seedAdminUser() {
    await testDb.drizzleDb.insert(users).values({
      id: "u-me",
      username: "me-admin",
      name: "Me Admin",
      password: await hashPassword("admin123"),
      role: "admin",
      isActive: true,
    });
  }

  test("未认证返回 401", async () => {
    const req = createMeRequest();
    const res = await meHandler(req);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.code).toBe("UNAUTHORIZED");
  });

  test("认证后返回当前用户信息", async () => {
    await seedAdminUser();
    const token = await signToken({ userId: "u-me", role: "admin" });
    const req = createMeRequest(`${COOKIE_NAME}=${token}`);
    const res = await meHandler(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.user.id).toBe("u-me");
    expect(json.data.user.username).toBe("me-admin");
    expect(json.data.user.name).toBe("Me Admin");
    expect(json.data.user.role).toBe("admin");
  });
});
