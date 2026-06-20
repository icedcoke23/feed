# 工程质量与可维护性全面提升设计规格

> **状态：** 已批准  
> **目标：** 在现有架构基础上建立可持续的工程质量体系，让后续功能迭代、多人协作和线上运维都有据可依。

---

## 1. 背景与现状

当前项目已完成 API 层从 Supabase 到 Drizzle ORM 的迁移，前端已迁移到 Server Component + SWR 架构，数据库索引与 `updated_at` 触发器已落地，敏感信息脱敏已统一。但工程基础仍存在明显短板：

- **零测试覆盖**：项目没有任何自动化测试。
- **Lint 警告未清零**：当前 `pnpm lint` 仍有 50 个 warning。
- **遗留脚本依赖 Supabase**：`scripts/import-schedule.js` 仍直接使用 Supabase 客户端。
- **CI 触发依赖人工切换仓库可见性**：private 仓库 Actions 易因额度/账单问题失败。
- **开发文档缺失**：新成员难以在本地复现环境、运行迁移和测试。

## 2. 范围与目标

### 2.1 测试体系

建立三层测试防护：

| 层级 | 工具 | 覆盖对象 | 目标 |
|------|------|----------|------|
| 单元测试 | Vitest | Service、Repository、utils | 核心逻辑覆盖率 ≥ 80% |
| 集成测试 | Vitest + Next.js test request | API Route Handlers | 所有 API 路由至少 1 条 happy path + 1 条错误路径 |
| E2E 测试 | Playwright | 关键用户流程（登录、生成反馈、导入数据） | 覆盖 3-5 个核心流程 |

测试数据库使用独立的 PostgreSQL 数据库或 `pg-mem`/`postgres-mem`，避免污染开发数据。Schema 复用 Drizzle schema，测试前自动迁移。

### 2.2 代码规范

- 清理现有 50 个 ESLint warning。
- 引入 `husky` + `lint-staged`，在 `pre-commit` 阶段运行 `lint` 与 `ts-check`。
- 统一错误响应格式与日志打印规范，禁止在 Service 层直接 `console.error`。

### 2.3 遗留脚本迁移

- 将 `scripts/import-schedule.js` 从 Supabase 迁移到 Drizzle。
- 支持 CLI 参数：`--input`、`--env`、 `--dry-run`、 `--verbose`。
- 为该脚本编写单元测试，确保解析与导入逻辑可验证。

### 2.4 CI/CD 增强

新增/完善 GitHub Actions workflow：

```yaml
jobs:
  quality:
    steps:
      - checkout
      - pnpm install
      - pnpm lint
      - pnpm ts-check
      - pnpm db:migrate:test
      - pnpm test
      - pnpm build
```

- 评估 private 仓库 Actions 额度问题，提供两种方案：
  1. 保持 public 运行 CI（当前临时方案），文档化切换流程。
  2. 若数据隐私要求高，改用 self-hosted runner 或 GitHub Pro。
- 增加迁移文件一致性检查：确保 schema.ts 与迁移文件同步。

### 2.5 文档补齐

- `docs/development.md`：本地开发环境、数据库、测试、迁移命令。
- `docs/api-errors.md`：统一错误码与响应格式。
- `docs/testing.md`：测试策略、测试数据库说明、如何写测试。

## 3. 验收标准

- `pnpm test` 全绿，整体覆盖率 ≥ 60%，Service/Repository 覆盖率 ≥ 80%。
- `pnpm lint` 0 warning。
- `pnpm ts-check` 0 error。
- `scripts/import-schedule.js` 不再依赖 `@supabase/supabase-js`。
- CI workflow 能完整跑完 lint → type-check → test → build。
- 新增/更新的文档能通过新成员本地跑通项目。

## 4. 非目标

- 不引入新的业务功能。
- 不修改现有 UI 视觉设计。
- 不替换现有技术栈（Next.js、Drizzle、Tailwind 等保持不变）。

## 5. 风险与应对

| 风险 | 应对 |
|------|------|
| 测试数据库配置复杂 | 提供 `docker-compose.test.yml` 与一键测试脚本 |
| 老代码耦合高难以测试 | 优先测新增/已迁移的 Service/Repository，逐步补旧代码 |
| CI 在 private 下仍失败 | 先文档化 public/private 切换，后续评估付费/self-hosted |
| husky 与现有工作流冲突 | 提供跳过方式 `git commit --no-verify` 并记录 |

## 6. 执行原则

- 分阶段推进，每个阶段独立可验证、可 commit。
- 优先建立测试基础设施，再补业务测试。
- 所有改动必须通过 `pnpm ts-check && pnpm lint`。
