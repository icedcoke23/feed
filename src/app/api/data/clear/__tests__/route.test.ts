import { describe, expect, test, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { DELETE as clearHandler } from "../route";
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
// withTransaction 直接在 PGlite 上执行 fn，PGlite 自身支持事务，
// 但 drizzle-orm/pglite 的 transaction API 与 node-postgres 不同，
// 这里采用直接调用 fn(db) 的方式模拟事务边界，验证业务逻辑而非事务本身。
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

// Mock route-auth：直接返回受控的 AuthUserResult，跳过 JWT 解码
vi.mock("@/lib/route-auth", () => ({
  getAuthUser: vi.fn(),
}));

import { getAuthUser } from "@/lib/route-auth";

function makeRequest() {
  return new NextRequest("http://localhost/api/data/clear", {
    method: "DELETE",
  });
}

describe("DELETE /api/data/clear", () => {
  beforeEach(async () => {
    testDb = await createTestDb();
    vi.mocked(getAuthUser).mockReset();
  });

  afterEach(async () => {
    await testDb.client.close();
  });

  async function seedFullDataset() {
    // admin 账户（应保留）
    await testDb.drizzleDb.insert(users).values({
      id: "u-admin",
      username: "admin",
      name: "Admin",
      password: await hashPassword("admin123"),
      role: "admin",
      isActive: true,
    });
    await testDb.drizzleDb.insert(teachers).values({
      id: "u-admin",
      name: "Admin",
      email: "admin@school.com",
      role: "admin",
      isActive: true,
    });

    // teacher 用户 + teachers 记录（应被清空）
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

    // 标签、主题、课程阶段
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

    // 班级、学生、反馈、转班
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
      toTeacherId: "u-admin",
      transferredAt: new Date(),
    });
  }

  test("未认证返回 401", async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null);
    const res = await clearHandler(makeRequest());

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

    const res = await clearHandler(makeRequest());

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("管理员");
  });

  test("admin 清空后所有业务数据被删除，admin 用户保留", async () => {
    await seedFullDataset();
    vi.mocked(getAuthUser).mockResolvedValue({
      userId: "u-admin",
      userRole: "admin",
    } as AuthUserResult);

    const res = await clearHandler(makeRequest());

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.details).toMatchObject({
      feedbacksDeleted: 1,
      transfersDeleted: 1,
      studentsDeleted: 1,
      classesDeleted: 1,
      themesDeleted: 1,
      tagsDeleted: 1,
      courseStagesDeleted: 1,
      teachersDeleted: 1,
      orphanUsersDeleted: 1,
    });

    // 校验数据已被清空
    const remainingFeedbacks = await testDb.drizzleDb.select().from(feedbacks);
    expect(remainingFeedbacks).toHaveLength(0);
    const remainingStudents = await testDb.drizzleDb.select().from(students);
    expect(remainingStudents).toHaveLength(0);
    // admin 的 teacher 记录应保留，仅 teacher 角色被删除
    const remainingTeachers = await testDb.drizzleDb.select().from(teachers);
    expect(remainingTeachers).toHaveLength(1);
    expect(remainingTeachers[0].id).toBe("u-admin");
    expect(remainingTeachers[0].role).toBe("admin");

    // admin 用户应保留
    const remainingUsers = await testDb.drizzleDb.select().from(users);
    expect(remainingUsers).toHaveLength(1);
    expect(remainingUsers[0].username).toBe("admin");
    expect(remainingUsers[0].role).toBe("admin");
  });

  test("admin 角色但 teacherRole 为 admin 时仍允许清空", async () => {
    await seedFullDataset();
    vi.mocked(getAuthUser).mockResolvedValue({
      userId: "u-admin",
      userRole: "admin",
      teacherRole: "admin",
    } as AuthUserResult);

    const res = await clearHandler(makeRequest());

    expect(res.status).toBe(200);
  });

  test("重复清空（空表）返回 0 计数不报错", async () => {
    // 使用不同 userId 避免 rate limit 计数在测试间互相污染
    vi.mocked(getAuthUser).mockResolvedValue({
      userId: "u-admin-empty",
      userRole: "admin",
    } as AuthUserResult);

    const res = await clearHandler(makeRequest());

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.details).toMatchObject({
      feedbacksDeleted: 0,
      studentsDeleted: 0,
      teachersDeleted: 0,
      orphanUsersDeleted: 0,
    });
  });
});
