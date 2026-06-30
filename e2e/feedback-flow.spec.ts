import { test, expect } from "@playwright/test";

/**
 * E2E: 反馈核心流程
 *
 * 覆盖 happy path：登录 → 拉取学生/标签 → 创建反馈 → 查询反馈 → 导出。
 *
 * 运行前提：
 * - 服务已启动且数据库可达（playwright.config.ts 的 webServer 会自动启动）
 * - 环境变量 E2E_ADMIN_USERNAME / E2E_ADMIN_PASSWORD 指向一个真实存在的 admin 账户
 *   （未配置时整个 suite 跳过，避免在无数据库环境失败）
 * - 数据库中至少存在 1 个学生（用于创建反馈）
 *
 * 运行：pnpm test:e2e feedback-flow
 */

const ADMIN_USERNAME = process.env.E2E_ADMIN_USERNAME ?? "admin";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "";
const BASE_URL = "http://localhost:3000";

// 整个 suite 依赖可用的 admin 凭据；未配置时跳过所有用例
test.skip(!ADMIN_PASSWORD, "未配置 E2E_ADMIN_PASSWORD，跳过反馈流程 E2E");

async function login(request: import("@playwright/test").APIRequestContext) {
  const res = await request.post(`${BASE_URL}/api/auth/login`, {
    data: { username: ADMIN_USERNAME, password: ADMIN_PASSWORD },
  });
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(json.data.user.role).toBe("admin");
  return res.headers()["set-cookie"];
}

test.describe("反馈核心流程", () => {
  test("登录 → 拉取学生 → 创建反馈 → 查询反馈", async ({ request }) => {
    const cookie = await login(request);

    // 1. 拉取学生列表
    const studentsRes = await request.get(`${BASE_URL}/api/students?limit=10`, {
      headers: { cookie },
    });
    expect(studentsRes.status()).toBe(200);
    const studentsJson = await studentsRes.json();
    const students = studentsJson.data ?? [];
    test.skip(students.length === 0, "数据库无学生，跳过创建反馈");
    const studentId = students[0].id;

    // 2. 拉取标签
    const tagsRes = await request.get(`${BASE_URL}/api/tags`, {
      headers: { cookie },
    });
    expect(tagsRes.status()).toBe(200);

    // 3. 创建反馈（draft 状态）
    const createRes = await request.post(`${BASE_URL}/api/feedbacks`, {
      headers: { cookie, "Content-Type": "application/json" },
      data: {
        student_id: studentId,
        status: "draft",
        strengths: [{ content: "课堂专注度高" }],
        improvements: [{ content: "需要加强计算练习" }],
        weaknesses: [{ content: "几何证明薄弱" }],
      },
    });
    expect(createRes.status()).toBe(201);
    const created = await createRes.json();
    const feedbackId = created.data.id;
    expect(feedbackId).toBeTruthy();

    // 4. 查询单个反馈，校验字段持久化
    const fetchRes = await request.get(`${BASE_URL}/api/feedbacks/${feedbackId}`, {
      headers: { cookie },
    });
    expect(fetchRes.status()).toBe(200);
    const fetched = await fetchRes.json();
    expect(fetched.data.id).toBe(feedbackId);
    expect(fetched.data.student_id).toBe(studentId);
    expect(fetched.data.status).toBe("draft");

    // 5. 更新反馈状态为 published，验证乐观锁不冲突（单线程）
    const updateRes = await request.put(`${BASE_URL}/api/feedbacks/${feedbackId}`, {
      headers: { cookie, "Content-Type": "application/json" },
      data: { status: "published" },
    });
    expect(updateRes.status()).toBe(200);
    const updated = await updateRes.json();
    expect(updated.data.status).toBe("published");
    expect(updated.data.version).toBeGreaterThan(fetched.data.version);
  });

  test("导出端点返回非空响应", async ({ request }) => {
    const cookie = await login(request);

    // /api/data/export 返回业务数据 JSON
    const res = await request.get(`${BASE_URL}/api/data/export`, {
      headers: { cookie },
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.data).toBeDefined();
    expect(json.data.version).toBeTruthy();
    expect(Array.isArray(json.data.students)).toBe(true);
  });

  test("未认证访问受保护接口返回 401", async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/feedbacks`);
    expect(res.status()).toBe(401);
  });
});
