# CI 说明

## Quality Gate Workflow

仓库使用 `.github/workflows/quality.yml` 作为唯一 CI 工作流，在以下事件触发：

- `push` 到 `main` 或 `trae/**` 分支
- 对 `main` 的 `pull_request`

工作流包含两个并行 Job：

### quality Job

1. 检出代码
2. 安装 pnpm 与 Node.js 20（与 `package.json` 的 `engines.node: ">=20"` 一致）
3. 安装依赖（`--frozen-lockfile`）
4. 运行 `pnpm lint`
5. 运行 `pnpm ts-check`
6. 运行 `pnpm db:check` 检查迁移一致性
7. 运行 `pnpm vitest run --coverage` 执行单元/集成测试并收集覆盖率（阈值见 `vitest.config.ts`）
8. 上传 coverage 报告为 artifact（`coverage-report`，保留 7 天）
9. 运行 `pnpm build`

### e2e Job

1. 启动 PostgreSQL 16 service 容器
2. 安装依赖
3. 运行 `pnpm db:migrate` 应用迁移
4. 安装 Playwright Chromium 浏览器
5. 运行 `pnpm test:e2e`（Playwright `webServer` 会自动执行 `pnpm build && pnpm start` 启动应用）
6. 上传 Playwright 报告为 artifact（`playwright-report`，保留 7 天）

E2E Job 使用临时 PostgreSQL 容器与测试用 `JWT_SECRET`，不依赖外部服务。当前 E2E 用例（`e2e/auth.spec.ts`、`e2e/home.spec.ts`）仅验证页面加载与未登录重定向，无需种子数据。

> `build` 步骤不需要数据库连接。若后续 build 需要其他环境变量，请参考 `.env.example` 并在仓库 Settings > Secrets and variables > Actions 中配置。

## 仓库可见性与 GitHub Actions 额度

当前仓库若为 **private**，GitHub Actions 的免费额度可能受限，导致 workflow 因账单或额度问题被跳过或失败。

### 临时方案：推送前后切换仓库可见性

如果希望在免费额度下跑通 CI，可以临时将仓库设为 public，CI 完成后再恢复为 private：

```bash
# 推送前设为 public
curl -L \
  -X PATCH \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer <YOUR_GITHUB_TOKEN>" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  https://api.github.com/repos/<owner>/<repo> \
  -d '{"private":false}'

# 推送代码
git push origin main

# 等待 CI 通过后恢复为 private
curl -L \
  -X PATCH \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer <YOUR_GITHUB_TOKEN>" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  https://api.github.com/repos/<owner>/<repo> \
  -d '{"private":true}'
```

> 注意：频繁切换可见性会影响协作体验，且 public 仓库在切换期间对所有人可见，请确保代码与提交历史中不包含敏感信息。

### 长期方案

- 升级组织/账号到 **GitHub Pro** / **GitHub Team** / **GitHub Enterprise**，获得更充足的 Actions 分钟数。
- 使用 **self-hosted runner** 在自己的服务器上执行 CI，完全脱离 GitHub Actions 的免费额度限制。
