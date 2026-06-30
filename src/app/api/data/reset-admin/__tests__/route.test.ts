import { describe, expect, test, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as resetAdminHandler } from "../route";
import { createTestDb } from "@/test/db";
import {
  users,
  teachers,
  classes,
  students,
  feedbacks,
  tags,
  teachingThemes,
  courseStages,
  classTransfers,
} from "@/storage/database/shared/schema";
import { hashPassword } from "@/lib/auth";
import type { AuthUserResult } from "@/lib/route-auth";

let testDb: Awaited<ReturnType<typeof createTestDb>>;
type DrizzleDb = typeof testDb.drizzleDb;

// Mock drizzle-client：db 走 Proxy 转发到 PGlite 实例；
// withTransaction 直接在 PGlite 上执行 fn，模拟事务边界。
vi.mock("@/storage/database/drizzle-client", () => ({
  db: new Proxy({} as DrizzleDb, {
    get(_, prop) {
      if (!testDb) {
        throw new Error("testDb not initialized");
      }
      return testDb.drizzleDb[prop as keyof DrizzleDb];
    },
  }),
  withTransaction: async <T>(fn: (tx: DrizzleDb) => Promise<T>): Promise<T> =>
    fn(testDb.drizzleDb),
}));

// Mock route-auth：直接返回受控的 AuthUserResult
vi.mock("@/lib/route-auth", () => ({
  getAuthUser: vi.fn(),
}));

import { getAuthUser } from "@/lib/route-auth";

function makeRequest(body?: unknown) {
  return new NextRequest("http://localhost/api/data/reset-admin", {
    method: "POST",
    body: body === undefined ? "" : JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/data/reset-admin", () => {
  beforeEach(async () => {
    testDb = await createTestDb();
    vi.mocked(getAuthUser).mockReset();
  });

  afterEach(async () => {
    await testDb.client.close();
  });

  async function seedFullDataset() {
    // 旧 admin
    await testDb.drizzleDb.insert(users).values({
      id: "u-old-admin",
      username: "admin",
      name: "Old Admin",
      password: await hashPassword("old-pass"),
      role: "admin",
      isActive: true,
    });
    await testDb.drizzleDb.insert(teachers).values({
      id: "u-old-admin",
      name: "Old Admin",
      email: "old-admin@school.com",
      role: "admin",
      isActive: true,
    });

    // teacher
    await testDb.drizzleDb.insert(users).values({
      id: "u-teacher",
      username: "teacher1",
      name: "Teacher One",
      password: await hashPassword("pass"),
      role: "teacher",
      isActive: true,
    });
    await testDb.drizzleDb.insert(teachers).values({
      id: "u-teacher",
      name: "Teacher One",
      email: "t1@school.com",
      role: "teacher",
      isActive: true,
    });

    // 业务数据
    await testDb.drizzleDb.insert(tags).values({
      id: "tag-1",
      category: "strength",
      name: "专注",
    });
    await testDb.drizzleDb.insert(teachingThemes).values({
      id: "theme-1",
      name: "课堂参与",
      category: "default",
    });
    await testDb.drizzleDb.insert(courseStages).values({
      id: "stage-1",
      stageCode: "S1",
      stageName: "阶段一",
      theme: "Scratch",
      level: "beginner",
      sortOrder: 1,
    });
    await testDb.drizzleDb.insert(classes).values({
      id: "cls-1",
      name: "一班",
      teacherId: "u-teacher",
    });
    await testDb.drizzleDb.insert(students).values({
      id: "stu-1",
      name: "Student One",
      adminTeacherId: "u-teacher",
    });
    await testDb.drizzleDb.insert(feedbacks).values({
      id: "fb-1",
      studentId: "stu-1",
      teacherId: "u-teacher",
      status: "draft",
    });
    await testDb.drizzleDb.insert(classTransfers).values({
      id: "ct-1",
      studentId: "stu-1",
      fromTeacherId: "u-teacher",
      toTeacherId: "u-old-admin",
      transferredAt: new Date(),
    });
  }

  test("未认证返回 401", async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null);
    const res = await resetAdminHandler(makeRequest({}));

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("未授权访问");
  });

  test("teacher 角色返回 403", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({
      userId: "u-teacher",
      userRole: "teacher",
      teacherRole: "teacher",
    } as AuthUserResult);

    const res = await resetAdminHandler(makeRequest({}));

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("管理员");
  });

  test("admin 重置后所有业务数据被清空，新 admin 账户被创建", async () => {
    await seedFullDataset();
    vi.mocked(getAuthUser).mockResolvedValue({
      userId: "u-old-admin",
      userRole: "admin",
    } as AuthUserResult);

    const res = await resetAdminHandler(makeRequest({}));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.adminCredentials.username).toBe("admin");
    expect(json.data.logs).toContain("✓ 管理员账户已创建 (admin)");

    // 业务数据应全部清空
    expect(await testDb.drizzleDb.select().from(feedbacks)).toHaveLength(0);
    expect(await testDb.drizzleDb.select().from(students)).toHaveLength(0);
    expect(await testDb.drizzleDb.select().from(classes)).toHaveLength(0);
    expect(await testDb.drizzleDb.select().from(tags)).toHaveLength(0);
    expect(await testDb.drizzleDb.select().from(teachingThemes)).toHaveLength(0);
    expect(await testDb.drizzleDb.select().from(courseStages)).toHaveLength(0);
    expect(await testDb.drizzleDb.select().from(classTransfers)).toHaveLength(0);

    // teachers 表应全部清空（新 admin 不在 teachers 表中）
    expect(await testDb.drizzleDb.select().from(teachers)).toHaveLength(0);

    // users 表应只剩新 admin
    const remainingUsers = await testDb.drizzleDb.select().from(users);
    expect(remainingUsers).toHaveLength(1);
    expect(remainingUsers[0].username).toBe("admin");
    expect(remainingUsers[0].role).toBe("admin");
    // 新 admin 的 id 应不同于旧 admin
    expect(remainingUsers[0].id).not.toBe("u-old-admin");
  });

  test("admin 重置后旧 admin 账户被替换（用户名复用）", async () => {
    await seedFullDataset();
    vi.mocked(getAuthUser).mockResolvedValue({
      userId: "u-old-admin",
      userRole: "admin",
      teacherRole: "admin",
    } as AuthUserResult);

    const res = await resetAdminHandler(makeRequest({}));

    expect(res.status).toBe(200);

    // 旧密码应已失效：用旧密码哈希比对验证已替换
    const remainingUsers = await testDb.drizzleDb.select().from(users);
    expect(remainingUsers).toHaveLength(1);
    expect(remainingUsers[0].username).toBe("admin");
    // 旧密码哈希应不同于新密码哈希
    const oldHash = await hashPassword("old-pass");
    expect(remainingUsers[0].password).not.toBe(oldHash);
  });

  test("空数据库重置也能成功", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({
      userId: "u-admin-empty",
      userRole: "admin",
    } as AuthUserResult);

    const res = await resetAdminHandler(makeRequest({}));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.adminCredentials.username).toBe("admin");

    const remainingUsers = await testDb.drizzleDb.select().from(users);
    expect(remainingUsers).toHaveLength(1);
    expect(remainingUsers[0].username).toBe("admin");
  });
});
