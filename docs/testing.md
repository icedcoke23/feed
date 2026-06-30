# 测试指南

本文档说明项目的测试策略、测试数据库与运行方式。

## 测试策略

项目采用分层测试：

| 层级     | 范围                            | 工具                                         | 目标                         |
| -------- | ------------------------------- | -------------------------------------------- | ---------------------------- |
| 单元测试 | Service、Repository、纯函数     | Vitest                                       | 验证业务逻辑与数据访问       |
| 集成测试 | API Route（Next.js App Router） | Vitest + `NextRequest`                       | 验证请求处理、鉴权、参数校验 |
| 组件测试 | React 组件                      | Vitest + React Testing Library (RTL) + jsdom | 验证组件渲染与交互           |
| E2E      | 完整用户流程                    | Playwright                                   | 验证页面流转与真实浏览器行为 |

## 测试数据库

- 单元/集成测试使用 `@electric-sql/pglite` 内存数据库，无需额外启动 PostgreSQL 服务。
- 测试数据库通过 `src/test/db.ts` 创建，并自动执行 `src/storage/database/migrations` 下的 SQL 迁移文件。
- 测试中使用 `vi.mock` 将 `@/storage/database/drizzle-client` 的 `db` 代理到测试数据库，以隔离真实数据库连接。

## 测试文件位置约定

- 单元/集成测试：`__tests__/<name>.test.ts` 或 `__tests__/<name>.test.tsx`，与被测文件放在同一目录。
- 组件测试：`src/components/ui/__tests__/<component>.test.tsx`。
- API Route 测试：`src/app/api/<route>/__tests__/route.test.ts`。
- E2E 测试：`e2e/<name>.spec.ts`。

现有示例：

- `src/app/api/auth/login/__tests__/route.test.ts`
- `src/app/api/auth/me/__tests__/route.test.ts`
- `src/app/api/data/clear/__tests__/route.test.ts`
- `src/app/api/data/reset-admin/__tests__/route.test.ts`
- `src/lib/repositories/__tests__/user-repository.test.ts`
- `src/lib/repositories/__tests__/tag-repository.test.ts`
- `src/lib/services/__tests__/lookup-service.test.ts`
- `src/lib/services/__tests__/auth-service.test.ts`
- `src/lib/services/__tests__/feedback-service.test.ts`
- `src/lib/services/__tests__/stats-service.test.ts`
- `src/lib/__tests__/rate-limit.test.ts`
- `src/components/ui/__tests__/button.test.tsx`
- `e2e/auth.spec.ts`
- `e2e/home.spec.ts`
- `e2e/feedback-flow.spec.ts`
- `e2e/data-management.spec.ts`

## 运行命令

```bash
# 运行所有 Vitest 测试
pnpm test

# 测试类型检查（独立 tsconfig，包含测试文件）
pnpm test:typecheck

# 查看测试覆盖率（阈值：lines/functions/statements 各 30%，branches 20%）
pnpm vitest run --coverage

# 监听模式开发测试
pnpm vitest

# 运行 Playwright E2E 测试（需配置 E2E_ADMIN_USERNAME / E2E_ADMIN_PASSWORD）
pnpm test:e2e
```

## 编写测试注意事项

- API Route 测试请为每个用例使用独立 IP（通过 `x-forwarded-for`），避免登录接口的 rate limit 计数互相污染。rate limit 已扩展到 AI 生成、数据导入、批量操作等路由，测试这些路由时同样需要注意限流计数。
- 破坏性操作（如 `data/clear`、`data/reset-admin`）测试请使用不同的 `userId`，避免触发每分钟 2 次的限流。
- 组件测试默认使用 jsdom 环境，已在 `vitest.config.ts` 中全局配置。
- 通用初始化逻辑可放在 `src/test/setup.ts`。
- Service 层测试可使用 PGlite + Proxy mock drizzle-client 模式（参考 `auth-service.test.ts`），无需真实数据库。
- 纯函数测试（如 mappers、validators）可直接测试，无需 mock。

## 覆盖率目标与现状

工程质量提升计划已建立测试基础设施与门禁，目前已完成 Service 层关键模块的单元测试覆盖：

- 当前测试总数：**85 个**（含 16 个测试文件）。
- 覆盖模块：API Route（auth/login、auth/me、data/clear、data/reset-admin）、Service（auth、feedback、stats、lookup）、Repository（user、tag）、工具函数（rate-limit、sensitive-mask、smoke）。
- `vitest.config.ts` 中 coverage thresholds 已上调至：
  - `lines`: **30%**
  - `functions`: **30%**
  - `statements`: **30%**
  - `branches`: **20%**

后续随着测试补全，应继续分阶段上调阈值，最终目标是达到稳定的全局 60% 以上。

## 测试待补清单

| 优先级 | 模块 | 待补内容 | 状态 |
| ------ | ---- | -------- | ---- |
| 高 | student-service | CRUD + 权限校验 + 转班逻辑 | 待补 |
| 高 | teacher-service | CRUD + 软删除 + 最后 admin 保护 | 待补 |
| 高 | class-service | CRUD + 学生关联 | 待补 |
| 中 | data-repository | importData 事务回滚 + 错误收集 | 待补 |
| 中 | parse-service | AI 响应解析 + JSON 二次保护 | 待补 |
| 中 | home-service | enrichStudents + 脱敏 | 待补 |
| 中 | init-data-service | 事务 + onConflictDoNothing | 待补 |
| 低 | ai-client | 流式响应 + 错误处理 | 待补 |
| 低 | pdf-session | 会话管理 + 过期清理 | 待补 |
| 低 | export-service | 导出格式 + 数据完整性 | 待补 |

## E2E 测试

E2E 测试位于 `e2e/` 目录，使用 Playwright 运行。完整流程测试需要：

1. 可用的数据库连接（`DATABASE_URL`）
2. 已初始化的 admin 账户（通过 `scripts/init-admin.js` 创建）
3. 环境变量 `E2E_ADMIN_USERNAME` / `E2E_ADMIN_PASSWORD`

未配置凭据时，依赖认证的测试会自动跳过（`test.skip`），避免在无数据库环境失败。

CI 中 E2E job 会自动：
1. 启动 PostgreSQL 服务
2. 应用数据库迁移
3. 初始化 admin 账户
4. 复用 quality job 的构建产物（避免重复 build）
5. 运行 Playwright 测试
