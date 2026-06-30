# 本地开发指南

本文档说明如何在本地启动和开发项目。

## 环境要求

- Node.js 20+
- pnpm 9+（项目通过 `packageManager` 与 `only-allow` 锁定 pnpm）
- PostgreSQL 15+（Drizzle ORM 通过 `DATABASE_URL` 直连）

## 初始化步骤

1. 复制环境变量模板：

   ```bash
   cp .env.example .env
   ```

2. 编辑 `.env`，填写以下关键配置：

   - `DATABASE_URL`：本地 PostgreSQL 连接字符串，例如 `postgresql://user:password@localhost:5432/edu_db`。**注意**：`.env.example` 中未包含此变量，但 `src/storage/database/drizzle-client.ts` 依赖它，必须手动添加。
   - `JWT_SECRET`：用于签发登录 Token，本地可填任意字符串，生产环境必须更换。
   - `COZE_API_KEY`：调用 AI SDK 时使用，不跑相关功能可暂时留空。
   - `NEXT_PUBLIC_APP_URL`：默认 `http://localhost:5000`，与 `pnpm dev` 端口一致。

3. 安装依赖：

   ```bash
   pnpm install
   ```

4. 应用数据库迁移：

   ```bash
   pnpm db:migrate
   ```

   > `package.json` 已提供 `db:migrate` 与 `db:generate` 脚本，分别对应 `drizzle-kit migrate` 与 `drizzle-kit generate`。`DATABASE_URL` 需在 `.env` 中配置。

5. 启动开发服务器：

   ```bash
   pnpm dev
   ```

   默认监听 `http://localhost:5000`。

## 常用命令

| 命令              | 说明                                  |
| ----------------- | ------------------------------------- |
| `pnpm dev`        | 启动 Next.js 开发服务器（端口 5000）  |
| `pnpm lint`       | 运行 ESLint 检查代码风格              |
| `pnpm ts-check`   | 运行 TypeScript 类型检查              |
| `pnpm test`       | 运行单元/集成测试（Vitest）           |
| `pnpm test:e2e`   | 运行端到端测试（Playwright）          |
| `pnpm build`      | 构建生产版本                          |
| `pnpm db:check`   | 检查 Drizzle 迁移文件一致性           |
| `pnpm db:generate`| 根据 schema 生成新的迁移文件          |
| `pnpm db:migrate` | 应用迁移到数据库                      |

## 补充说明

- 开发脚本位于 `scripts/dev.sh`，会先清理端口再启动服务。
- 构建脚本位于 `scripts/build.sh`，会先安装依赖再执行 `next build`。
- 若使用 Supabase，请提供兼容 PostgreSQL 协议的连接字符串作为 `DATABASE_URL`。
