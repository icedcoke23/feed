# 工程质量与可维护性全面提升实现计划

> **面向 AI 代理的工作者：** 必需子技能：superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 建立测试体系、清零 lint 警告、迁移 Supabase 遗留脚本、增强 CI、补齐文档。

**架构：** 使用 Vitest 作为测试运行器，pg-mem 作为内存测试数据库，React Testing Library 测组件，Playwright 测 E2E；通过 husky + lint-staged 在提交前拦截问题；GitHub Actions 跑完整质量门禁。

**技术栈：** Next.js、TypeScript、Drizzle ORM、Vitest、React Testing Library、Playwright、husky、lint-staged、GitHub Actions。

---

## 文件清单

- `package.json`：添加测试依赖与脚本
- `vitest.config.ts`：Vitest 配置
- `src/test/setup.ts`：测试全局 setup（mock crypto、环境变量）
- `src/test/db.ts`：pg-mem 测试数据库初始化与迁移工具
- `.github/workflows/quality.yml`：质量门禁 CI
- `.husky/pre-commit`：pre-commit 钩子
- `.lintstagedrc.json`：lint-staged 配置
- `scripts/import-schedule.ts`：迁移后的课表导入脚本（替代 `scripts/import-schedule.js`）
- `src/lib/services/__tests__/*.test.ts`：Service 单元测试
- `src/lib/repositories/__tests__/*.test.ts`：Repository 单元测试
- `src/app/api/**/__tests__/route.test.ts`：API 路由集成测试
- `src/components/**/__tests__/*.test.tsx`：组件单元测试
- `e2e/`：Playwright E2E 测试
- `docs/development.md`：本地开发指南
- `docs/testing.md`：测试指南
- `docs/api-errors.md`：API 错误码规范

---

## 任务 1：测试基础设施搭建

**文件：**
- 创建：`vitest.config.ts`
- 创建：`src/test/setup.ts`
- 创建：`src/test/db.ts`
- 修改：`package.json`
- 修改：`tsconfig.json`（如需 include test 类型）

- [ ] **步骤 1：安装依赖**

```bash
pnpm add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @vitest/coverage-v8 pg-mem
pnpm add -D playwright @playwright/test
pnpm exec playwright install --with-deps chromium
```

- [ ] **步骤 2：创建 Vitest 配置**

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 50,
        statements: 60,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **步骤 3：创建测试 setup 文件**

```ts
// src/test/setup.ts
import "@testing-library/jest-dom";

// 为测试提供稳定的 crypto.randomUUID
let uuidCounter = 0;
Object.defineProperty(globalThis, "crypto", {
  value: {
    randomUUID: () => `test-uuid-${++uuidCounter}`,
    getRandomValues: (arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
      return arr;
    },
  },
  writable: true,
});
```

- [ ] **步骤 4：创建 pg-mem 测试数据库工具**

```ts
// src/test/db.ts
import { newDb } from "pg-mem";
import { drizzle } from "drizzle-orm/pg-mem";
import * as schema from "@/storage/database/shared/schema";

export function createTestDb() {
  const db = newDb();
  db.public.registerFunction({
    name: "gen_random_uuid",
    returns: DataType.uuid,
    implementation: () => crypto.randomUUID(),
  });

  const pg = db.adapters.createPg();
  const client = pg.Client;
  const connection = new client();
  const drizzleDb = drizzle(connection, { schema });

  return { db, drizzleDb, connection };
}
```

> 注：pg-mem 对 Drizzle 的适配可能需要根据实际运行情况调整，若遇阻则改用 Docker 测试 PostgreSQL。

- [ ] **步骤 5：修改 package.json 脚本**

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

- [ ] **步骤 6：添加第一个基础设施验证测试**

```ts
// src/test/smoke.test.ts
import { describe, it, expect } from "vitest";
import { createTestDb } from "./db";

describe("test infrastructure", () => {
  it("can create test database", () => {
    const { drizzleDb } = createTestDb();
    expect(drizzleDb).toBeDefined();
  });

  it("crypto.randomUUID is mocked", () => {
    expect(crypto.randomUUID()).toBe("test-uuid-1");
  });
});
```

- [ ] **步骤 7：运行验证测试**

```bash
pnpm test
```
预期：2 passing

- [ ] **步骤 8：Commit**

```bash
git add package.json vitest.config.ts src/test/ pnpm-lock.yaml
pnpm ts-check && pnpm lint
if [ $? -eq 0 ]; then git commit -m "chore(test): setup vitest, pg-mem and testing utilities"; fi
```

---

## 任务 2：Service 层单元测试

**文件：**
- 创建：`src/lib/services/__tests__/lookup-service.test.ts`
- 创建：`src/lib/services/__tests__/sensitive-mask.test.ts`
- 创建：`src/lib/services/__tests__/auth-service.test.ts`（若存在）

- [ ] **步骤 1：为 lookup-service 编写失败测试**

```ts
// src/lib/services/__tests__/lookup-service.test.ts
import { describe, it, expect } from "vitest";
import * as lookupService from "@/lib/services/lookup-service";

describe("lookupService", () => {
  it("should return empty array when no grades provided", async () => {
    const result = await lookupService.listGrades();
    expect(result).toEqual([]);
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

```bash
pnpm test src/lib/services/__tests__/lookup-service.test.ts
```
预期：FAIL（函数不存在或返回不匹配）

- [ ] **步骤 3：实现最少代码**

若 `lookup-service.ts` 已存在且行为正确，则无需修改；否则补充实现。

- [ ] **步骤 4：运行测试验证通过**

```bash
pnpm test src/lib/services/__tests__/lookup-service.test.ts
```
预期：PASS

- [ ] **步骤 5：为 sensitive-mask 编写测试**

```ts
// src/lib/services/__tests__/sensitive-mask.test.ts
import { describe, it, expect } from "vitest";
import { maskPhone, maskEmail, maskApiKey, maskUrl } from "@/lib/sensitive-mask";

describe("sensitive-mask", () => {
  it("masks phone number", () => {
    expect(maskPhone("13800138000")).toBe("138****8000");
  });

  it("masks email", () => {
    expect(maskEmail("admin@example.com")).toBe("a***n@example.com");
  });

  it("masks api key", () => {
    expect(maskApiKey("sk-1234567890abcdef")).toBe("sk-1************def");
  });

  it("masks url", () => {
    expect(maskUrl("https://api.example.com/v1/secret?token=abc")).toBe("https://api.example.com/...");
  });
});
```

- [ ] **步骤 6：运行 sensitive-mask 测试并通过**

```bash
pnpm test src/lib/services/__tests__/sensitive-mask.test.ts
```
预期：PASS

- [ ] **步骤 7：Commit**

```bash
git add src/lib/services/__tests__
git commit -m "test(service): add unit tests for lookup and sensitive-mask"
```

---

## 任务 3：Repository 层单元测试

**文件：**
- 创建：`src/lib/repositories/__tests__/user-repository.test.ts`
- 创建：`src/lib/repositories/__tests__/tag-repository.test.ts`

- [ ] **步骤 1：编写 user-repository 测试**

```ts
// src/lib/repositories/__tests__/user-repository.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb } from "@/test/db";
import * as userRepo from "@/lib/repositories/user-repository";
import { users } from "@/storage/database/shared/schema";

describe("userRepository", () => {
  let { drizzleDb: db } = createTestDb();

  beforeEach(async () => {
    const fresh = createTestDb();
    db = fresh.drizzleDb;
    await db.delete(users);
  });

  it("finds user by username", async () => {
    await db.insert(users).values({
      id: "u1",
      username: "alice",
      name: "Alice",
      password: "hash",
      role: "teacher",
      isActive: true,
    });

    const user = await userRepo.findByUsername("alice");
    expect(user).toBeDefined();
    expect(user?.name).toBe("Alice");
  });
});
```

> 注：若 `userRepo.findByUsername` 内部使用全局 `db` 而非参数注入，需要重构为可注入形式，或统一在 repository 中暴露 `withTestDb` 重载。此处假设通过依赖注入或全局测试 db 实现。

- [ ] **步骤 2：运行测试并调整 repository 以支持测试**

若 repository 使用全局 `db` 无法替换，则在 repository 中增加可选参数：

```ts
export async function findByUsername(username: string, tx = db) {
  return tx.select().from(users).where(eq(users.username, username)).limit(1).then(rows => rows[0] ?? null);
}
```

- [ ] **步骤 3：运行测试验证通过**

```bash
pnpm test src/lib/repositories/__tests__/user-repository.test.ts
```
预期：PASS

- [ ] **步骤 4：Commit**

```bash
git add src/lib/repositories/__tests__ src/lib/repositories/user-repository.ts
git commit -m "test(repository): add user-repository tests and support test db injection"
```

---

## 任务 4：API 路由集成测试

**文件：**
- 创建：`src/app/api/health/__tests__/route.test.ts`
- 创建：`src/app/api/auth/login/__tests__/route.test.ts`

- [ ] **步骤 1：为健康检查路由编写测试**

```ts
// src/app/api/health/__tests__/route.test.ts
import { describe, it, expect } from "vitest";
import { GET } from "../route";

describe("GET /api/health", () => {
  it("returns 200", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
  });
});
```

> 若不存在 health route，可改为 auth/login 路由。

- [ ] **步骤 2：运行测试验证失败/通过**

```bash
pnpm test src/app/api/health/__tests__/route.test.ts
```

- [ ] **步骤 3：为 login 路由编写集成测试**

```ts
// src/app/api/auth/login/__tests__/route.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { POST } from "../route";
import { createTestDb } from "@/test/db";

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    createTestDb();
  });

  it("returns 400 for invalid credentials", async () => {
    const request = new Request("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "unknown", password: "wrong" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
```

- [ ] **步骤 4：运行测试并通过**

```bash
pnpm test src/app/api/auth/login/__tests__/route.test.ts
```
预期：PASS

- [ ] **步骤 5：Commit**

```bash
git add src/app/api/**/__tests__
git commit -m "test(api): add route integration tests for health and login"
```

---

## 任务 5：组件单元测试

**文件：**
- 创建：`src/components/ui/__tests__/button.test.tsx`
- 创建：`src/components/business/__tests__/student-card.test.tsx`（如存在简单组件）

- [ ] **步骤 1：为 Button 组件编写测试**

```tsx
// src/components/ui/__tests__/button.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("renders children", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText("Click me")).toBeInTheDocument();
  });
});
```

- [ ] **步骤 2：运行测试并通过**

```bash
pnpm test src/components/ui/__tests__/button.test.tsx
```
预期：PASS

- [ ] **步骤 3：Commit**

```bash
git add src/components/ui/__tests__
git commit -m "test(ui): add Button component test"
```

---

## 任务 6：E2E 测试

**文件：**
- 创建：`playwright.config.ts`
- 创建：`e2e/auth.spec.ts`
- 创建：`e2e/home.spec.ts`

- [ ] **步骤 1：创建 Playwright 配置**

```ts
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "pnpm build && pnpm start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
});
```

- [ ] **步骤 2：编写登录 E2E 测试**

```ts
// e2e/auth.spec.ts
import { test, expect } from "@playwright/test";

test("login page loads", async ({ page }) => {
  await page.goto("/login");
  await expect(page).toHaveTitle(/登录|Login/);
});
```

- [ ] **步骤 3：运行 E2E 测试**

```bash
pnpm test:e2e
```
预期：至少 1 passing

- [ ] **步骤 4：Commit**

```bash
git add playwright.config.ts e2e/
git commit -m "test(e2e): setup playwright and add login smoke test"
```

---

## 任务 7：Lint 警告清零

**文件：**
- 修改：所有含 warning 的源文件
- 修改：`.eslintrc.json` 或 `eslint.config.mjs`（如需规则微调）

- [ ] **步骤 1：运行 lint 并分类警告**

```bash
pnpm lint
```

- [ ] **步骤 2：批量清理未使用变量/导入**

按文件修复 `@typescript-eslint/no-unused-vars` 警告：

```ts
// 示例：src/app/api/data/reset-admin/route.ts
// 将 body 参数改为 _body
async (_req, { authUser, body: _body }) => { ... }
```

- [ ] **步骤 3：修复 React Hook 依赖警告**

对 `react-hooks/exhaustive-deps` 警告：
- 若依赖确实不需要变化，使用 `useCallback`/`useMemo` 包裹并加入依赖。
- 若明确不需要，使用 `eslint-disable-next-line react-hooks/exhaustive-deps` 并注释原因。

- [ ] **步骤 4：修复 img 标签警告**

将关键 `<img>` 替换为 `next/image` 的 `<Image>`；对于用户上传/动态内容，若优化不可行，可添加 `eslint-disable-next-line @next/next/no-img-element`。

- [ ] **步骤 5：验证 lint 0 warning**

```bash
pnpm lint
```
预期：0 problems

- [ ] **步骤 6：Commit**

```bash
git add -A
git commit -m "style: resolve all existing eslint warnings"
```

---

## 任务 8：husky + lint-staged

**文件：**
- 创建：`.husky/pre-commit`
- 创建：`.lintstagedrc.json`
- 修改：`package.json`

- [ ] **步骤 1：安装依赖**

```bash
pnpm add -D husky lint-staged
```

- [ ] **步骤 2：初始化 husky**

```bash
pnpm exec husky init
```

- [ ] **步骤 3：创建 lint-staged 配置**

```json
// .lintstagedrc.json
{
  "*.{ts,tsx}": ["pnpm lint --fix", "pnpm ts-check"],
  "*.{js,jsx,mjs,cjs}": ["pnpm lint --fix"],
  "*.{json,md}": ["prettier --write"]
}
```

- [ ] **步骤 4：修改 pre-commit 钩子**

```bash
# .husky/pre-commit
pnpm lint-staged
```

- [ ] **步骤 5：验证提交拦截**

```bash
echo '// bad code' > src/tmp-bad.ts
git add src/tmp-bad.ts
git commit -m "test: should be blocked"
# 预期：commit 被 lint/type-check 拦截
rm src/tmp-bad.ts
```

- [ ] **步骤 6：Commit**

```bash
git add .husky .lintstagedrc.json package.json
git commit -m "chore: setup husky and lint-staged pre-commit hooks"
```

---

## 任务 9：迁移 import-schedule.js 到 Drizzle

**文件：**
- 创建：`scripts/import-schedule.ts`
- 删除：`scripts/import-schedule.js`
- 创建：`scripts/__tests__/import-schedule.test.ts`
- 修改：`package.json`（脚本命令）

- [ ] **步骤 1：安装 tsx 用于运行 TS 脚本**

```bash
pnpm add -D tsx
```

- [ ] **步骤 2：将 import-schedule.js 改写为 TypeScript 并使用 Drizzle**

```ts
// scripts/import-schedule.ts
import { parseArgs } from "node:util";
import fs from "node:fs";
import path from "node:path";
import { db } from "@/storage/database/drizzle-client";
// ... 使用 drizzle 查询/插入

async function main() {
  const { values } = parseArgs({
    options: {
      input: { type: "string", default: "scripts/schedule-data.json" },
      env: { type: "string", default: ".env" },
      "dry-run": { type: "boolean", default: false },
      verbose: { type: "boolean", default: false },
    },
  });

  // 加载 .env
  // 读取 schedule-data.json
  // 使用 db 事务导入
}

main().catch((err) => {
  console.error("导入失败:", err);
  process.exit(1);
});
```

- [ ] **步骤 3：添加 package.json 脚本**

```json
{
  "scripts": {
    "import:schedule": "tsx scripts/import-schedule.ts",
    "import:schedule:dry": "tsx scripts/import-schedule.ts --dry-run"
  }
}
```

- [ ] **步骤 4：为解析逻辑编写测试**

```ts
// scripts/__tests__/import-schedule.test.ts
import { describe, it, expect } from "vitest";
import { parseScheduleData } from "../import-schedule";

describe("parseScheduleData", () => {
  it("extracts teachers and classes", () => {
    const result = parseScheduleData({
      teachers: [{ name: "张老师" }],
      classes: [{ name: "周六 10:00  scratch", teacher: "张老师", course: "scratch", day: "周六", time: "10:00" }],
      students: [{ name: "小明", classNames: ["周六 10:00  scratch"], teachers: ["张老师"], adminTeacher: "心心" }],
    });
    expect(result.teachers).toHaveLength(1);
    expect(result.classes).toHaveLength(1);
  });
});
```

- [ ] **步骤 5：运行测试并通过**

```bash
pnpm test scripts/__tests__/import-schedule.test.ts
```

- [ ] **步骤 6：删除旧的 import-schedule.js**

```bash
rm scripts/import-schedule.js
```

- [ ] **步骤 7：Commit**

```bash
git add scripts/ package.json
git commit -m "refactor(scripts): migrate import-schedule from supabase to drizzle"
```

---

## 任务 10：CI 增强

**文件：**
- 创建/修改：`.github/workflows/quality.yml`
- 创建：`docs/ci.md`

- [ ] **步骤 1：创建 quality.yml**

```yaml
# .github/workflows/quality.yml
name: Quality Gate

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "pnpm"

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm lint

      - name: Type check
        run: pnpm ts-check

      - name: Check migrations
        run: pnpm drizzle-kit check

      - name: Unit tests
        run: pnpm test

      - name: Build
        run: pnpm build
```

- [ ] **步骤 2：添加 drizzle-kit check 脚本**

```json
{
  "scripts": {
    "db:check": "drizzle-kit check"
  }
}
```

- [ ] **步骤 3：创建 CI 说明文档**

```markdown
# docs/ci.md

## 仓库可见性

当前 CI 在 private 仓库下可能受 GitHub Actions 免费额度限制。临时方案：
1. 推送前通过 API 将仓库设为 public
2. CI 跑完后恢复为 private

长期方案：
- 升级到 GitHub Pro
- 或使用 self-hosted runner
```

- [ ] **步骤 4：Commit**

```bash
git add .github/workflows/ docs/ci.md package.json
git commit -m "ci: add quality gate workflow with lint, type-check, test and build"
```

---

## 任务 11：文档补齐

**文件：**
- 创建：`docs/development.md`
- 创建：`docs/testing.md`
- 创建：`docs/api-errors.md`

- [ ] **步骤 1：编写开发指南**

```markdown
# docs/development.md

## 环境要求
- Node.js 20+
- pnpm 9+
- PostgreSQL 15+

## 初始化
```bash
cp .env.example .env
# 填写数据库连接信息
pnpm install
pnpm db:migrate
pnpm dev
```

## 常用命令
- `pnpm dev`：启动开发服务器
- `pnpm lint`：代码检查
- `pnpm ts-check`：类型检查
- `pnpm test`：运行单元测试
- `pnpm test:e2e`：运行 E2E 测试
```

- [ ] **步骤 2：编写测试指南**

```markdown
# docs/testing.md

## 测试策略
- 单元测试：Service/Repository/utils
- 集成测试：API Route Handlers
- 组件测试：React Testing Library
- E2E：Playwright

## 测试数据库
使用 pg-mem 内存数据库，在 `src/test/db.ts` 中初始化。

## 新增测试
```bash
# Service 测试
src/lib/services/__tests__/<name>.test.ts

# API 测试
src/app/api/<path>/__tests__/route.test.ts
```
```

- [ ] **步骤 3：编写 API 错误码规范**

```markdown
# docs/api-errors.md

## 统一响应格式
```json
{
  "success": false,
  "error": "错误描述",
  "code": "ERROR_CODE",
  "status": 400
}
```

## 错误码
- `UNAUTHORIZED`：未登录
- `FORBIDDEN`：无权限
- `VALIDATION_ERROR`：参数校验失败
- `NOT_FOUND`：资源不存在
- `INTERNAL_ERROR`：服务器内部错误
```

- [ ] **步骤 4：Commit**

```bash
git add docs/development.md docs/testing.md docs/api-errors.md
git commit -m "docs: add development, testing and api-error guides"
```

---

## 任务 12：最终验证与汇总

- [ ] **步骤 1：全量运行质量门禁**

```bash
pnpm install
pnpm lint
pnpm ts-check
pnpm test
pnpm test:e2e
pnpm build
```

预期：全部通过。

- [ ] **步骤 2：检查覆盖率报告**

```bash
pnpm test:coverage
```

预期：整体 ≥ 60%，Service/Repository ≥ 80%。

- [ ] **步骤 3：提交最终汇总或创建 PR**

```bash
git log --oneline -20
```

根据当前分支状态决定：
- 若一直在 main，则保持 main 提交历史
- 若使用 feature 分支，创建 PR 合并到 main

- [ ] **步骤 4：推送并触发 CI**

```bash
git push origin main
```

监控 GitHub Actions quality workflow 运行结果。

---

## 自检清单

- [ ] 规格中的每个需求都有对应任务
- [ ] 计划中没有 "待定" / "TODO" / "后续实现"
- [ ] 文件路径精确，代码示例可运行
- [ ] 测试步骤遵循 TDD（先写失败测试，再实现）
- [ ] 所有任务修改/创建的文件在文件清单中列出
