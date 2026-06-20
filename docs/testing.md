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
- `src/lib/repositories/__tests__/user-repository.test.ts`
- `src/lib/services/__tests__/lookup-service.test.ts`
- `src/components/ui/__tests__/button.test.tsx`
- `e2e/auth.spec.ts`
- `e2e/home.spec.ts`

## 运行命令

```bash
# 运行所有 Vitest 测试
pnpm test

# 查看测试覆盖率（阈值：lines/functions/branches/statements 各 60%）
pnpm test:coverage

# 监听模式开发测试
pnpm test:watch

# 运行 Playwright E2E 测试
pnpm test:e2e
```

## 编写测试注意事项

- API Route 测试请为每个用例使用独立 IP（通过 `x-forwarded-for`），避免登录接口的 rate limit 计数互相污染。
- 组件测试默认使用 jsdom 环境，已在 `vitest.config.ts` 中全局配置。
- 通用初始化逻辑可放在 `src/test/setup.ts`。
