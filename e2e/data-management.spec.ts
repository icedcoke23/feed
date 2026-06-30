import { test, expect } from "@playwright/test";

/**
 * E2E: 数据管理流程
 *
 * 覆盖 admin 数据备份 → 清空 → 恢复 → 校验。
 *
 * 运行前提：
 * - 服务已启动且数据库可达
 * - 环境变量 E2E_ADMIN_USERNAME / E2E_ADMIN_PASSWORD 指向一个真实存在的 admin 账户
 *   （未配置时整个 suite 跳过）
 *
 * 注意：本 suite 会修改数据库状态（清空业务数据），不应在生产数据库运行。
 * 建议在隔离的测试数据库中执行。
 *
 * 运行：pnpm test:e2e data-management
 */

const ADMIN_USERNAME = process.env.E2E_ADMIN_USERNAME ?? "admin";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "";
const BASE_URL = "http://localhost:3000";

test.skip(!ADMIN_PASSWORD, "未配置 E2E_ADMIN_PASSWORD，跳过数据管理 E2E");

async function login(request: import("@playwright/test").APIRequestContext) {
  const res = await request.post(`${BASE_URL}/api/auth/login`, {
    data: { username: ADMIN_USERNAME, password: ADMIN_PASSWORD },
  });
  expect(res.status()).toBe(200);
  return res.headers()["set-cookie"];
}

test.describe("数据管理流程", () => {
  test("admin 备份 → 清空 → 恢复 → 校验数据一致", async ({ request }) => {
    const cookie = await login(request);

    // 1. 备份：拿到当前所有业务数据
    const backupRes = await request.get(`${BASE_URL}/api/data/export`, {
      headers: { cookie },
    });
    expect(backupRes.status()).toBe(200);
    const backupJson = await backupRes.json();
    const backup = backupJson.data;
    expect(backup).toBeDefined();

    const beforeCounts = {
      students: backup.students?.length ?? 0,
      classes: backup.classes?.length ?? 0,
      feedbacks: backup.feedbacks?.length ?? 0,
      tags: backup.tags?.length ?? 0,
      themes: backup.themes?.length ?? 0,
    };

    // 2. 清空：调用 clearAll（破坏性操作，限流 2 次/分钟）
    const clearRes = await request.delete(`${BASE_URL}/api/data/clear`, {
      headers: { cookie },
    });
    expect(clearRes.status()).toBe(200);
    const clearJson = await clearRes.json();
    expect(clearJson.data.details).toBeDefined();
    // admin 账户应保留
    const afterClearStudents = await request.get(`${BASE_URL}/api/students`, {
      headers: { cookie },
    });
    const afterClearStudentsJson = await afterClearStudents.json();
    expect(afterClearStudentsJson.data ?? []).toHaveLength(0);

    // 3. 恢复：将备份数据写回
    const restoreRes = await request.post(`${BASE_URL}/api/data/restore`, {
      headers: { cookie, "Content-Type": "application/json" },
      data: backup,
    });
    // restore 可能返回 200 或 207（部分失败）
    expect([200, 207]).toContain(restoreRes.status);

    // 4. 校验：恢复后数据量应与备份前一致
    const afterRestoreRes = await request.get(`${BASE_URL}/api/students?limit=1000`, {
      headers: { cookie },
    });
    expect(afterRestoreRes.status()).toBe(200);
    const afterRestoreJson = await afterRestoreRes.json();
    expect((afterRestoreJson.data ?? []).length).toBe(beforeCounts.students);

    // 标签、主题也应恢复
    const tagsRes = await request.get(`${BASE_URL}/api/tags`, {
      headers: { cookie },
    });
    const tagsJson = await tagsRes.json();
    expect((tagsJson.data ?? []).length).toBe(beforeCounts.tags);

    const themesRes = await request.get(`${BASE_URL}/api/themes`, {
      headers: { cookie },
    });
    const themesJson = await themesRes.json();
    expect((themesJson.data ?? []).length).toBe(beforeCounts.themes);
  });

  test("非 admin 用户无法清空数据", async ({ request }) => {
    // 不登录直接访问
    const res = await request.delete(`${BASE_URL}/api/data/clear`);
    expect(res.status()).toBe(401);
  });

  test("备份接口返回完整数据结构", async ({ request }) => {
    const cookie = await login(request);

    const res = await request.get(`${BASE_URL}/api/data/export`, {
      headers: { cookie },
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    const data = json.data;

    // 校验关键字段存在（即使为空数组）
    expect(data.exportTime).toBeTruthy();
    expect(data.version).toBeTruthy();
    expect(Array.isArray(data.students)).toBe(true);
    expect(Array.isArray(data.classes)).toBe(true);
    expect(Array.isArray(data.feedbacks)).toBe(true);
    expect(Array.isArray(data.tags)).toBe(true);
    expect(Array.isArray(data.themes)).toBe(true);
    expect(Array.isArray(data.courseStages)).toBe(true);
    expect(Array.isArray(data.classTransfers)).toBe(true);
  });
});
