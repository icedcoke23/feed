# 教学反馈系统

面向教学机构的全栈 Web 应用，用于生成 AI 驱动的学员反馈报告、管理学员/班级/教师，并支持 PDF 报告导出与数据备份恢复。系统提供管理员（admin）与教师（teacher）两级权限，内置 API 限流与 JWT 鉴权。

## 技术栈

- **框架**: Next.js 16.1.1（App Router）+ React 19.2 + TypeScript 5
- **数据库**: Drizzle ORM 0.45 + PostgreSQL（`pg` 驱动，连接池）
- **UI**: shadcn/ui（基于 Radix UI）+ Tailwind CSS v4
- **数据获取**: SWR + react-hook-form + zod（表单与校验）
- **鉴权**: JWT（`jose` 签发 + `bcryptjs` 密码哈希 + httpOnly Cookie）
- **测试**: vitest + `@electric-sql/pglite`（内存数据库）+ Playwright（E2E）
- **部署**: Docker 多阶段构建（standalone 产物 + 迁移工具镜像）
- **包管理器**: pnpm 9+（通过 `packageManager` 与 `only-allow` 锁定）

详见 [package.json](./package.json)。

## 快速开始

环境要求：Node.js 20+、pnpm 9+、PostgreSQL 15+。

```bash
# 1. 安装依赖
pnpm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，填写 DATABASE_URL 与 JWT_SECRET（生产环境必填）

# 3. 应用数据库迁移
pnpm db:migrate

# 4. 启动开发服务器（默认端口 5000）
pnpm dev
```

启动后访问 [http://localhost:5000](http://localhost:5000)。

构建与运行生产版本：

```bash
pnpm build
pnpm start
```

> 本地开发环境变量配置详见 [docs/development.md](./docs/development.md)。

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 启动 Next.js 开发服务器（端口 5000，先清理占用端口） |
| `pnpm build` | 构建生产版本（`scripts/build.sh`） |
| `pnpm start` | 启动生产服务器（`scripts/start.sh`） |
| `pnpm lint` | 运行 ESLint 检查代码风格 |
| `pnpm ts-check` | 运行 TypeScript 类型检查（`tsc`） |
| `pnpm test` | 运行 vitest 单元/集成测试 |
| `pnpm test:typecheck` | 测试文件类型检查（独立 tsconfig，包含测试文件） |
| `pnpm test:e2e` | 运行 Playwright 端到端测试（需配置 `E2E_ADMIN_USERNAME` / `E2E_ADMIN_PASSWORD`） |
| `pnpm db:check` | 检查 Drizzle 迁移文件一致性 |
| `pnpm db:generate` | 根据 schema 生成新的迁移文件 |
| `pnpm db:migrate` | 应用迁移到数据库 |
| `node scripts/init-admin.js` | 初始化 admin 账户（CI/首次部署使用，需 `DATABASE_URL`） |

## 项目结构

```
src/
├── app/                          # Next.js App Router
│   ├── admin/students/           # 管理员-学员管理页
│   ├── dashboard/                # 仪表盘
│   ├── feedback/                 # 反馈相关页面（new / [id] / pdf）
│   ├── login/                    # 登录页
│   ├── settings/                 # 设置页（含 tabs：AI、课程阶段、数据、标签、主题、用户）
│   ├── student/[id]/             # 学员详情页
│   ├── api/                      # API 路由（见下文）
│   ├── layout.tsx                # 根布局
│   ├── page.tsx                  # 首页
│   └── globals.css               # 全局样式与主题变量
├── components/
│   ├── ui/                       # shadcn/ui 基础组件
│   ├── business/                 # 业务组件（报告生成、学员列表、PDF 工具栏等）
│   ├── auth/                     # 路由守卫
│   └── providers/                # SWR Provider 等全局 Provider
├── lib/
│   ├── services/                 # 业务服务层（auth、generate、feedback、student 等）
│   ├── repositories/             # 数据访问层（Drizzle 查询封装）
│   ├── route-handlers/           # API 路由高阶封装（with-auth / with-db-error / with-validation）
│   ├── swr/                      # SWR fetcher / keys / options
│   ├── auth.ts                   # JWT 签发与校验、密码哈希
│   ├── rate-limit.ts             # 内存滑动窗口限流
│   ├── api-response.ts           # 统一响应封装
│   ├── api-error.ts              # 错误处理
│   ├── ai-client.ts              # AI SDK 客户端
│   ├── ssrf-guard.ts             # SSRF 防护
│   └── sensitive-mask.ts         # 敏感信息脱敏
├── storage/database/
│   ├── drizzle-client.ts         # Drizzle 客户端与连接池
│   ├── shared/schema.ts          # 数据库 schema
│   ├── shared/relations.ts       # 表关系定义
│   ├── migrations/               # SQL 迁移文件
│   └── types.ts                  # 数据库类型
├── hooks/                        # 自定义 React Hooks（use-feedback-form、use-sse-stream 等）
├── contexts/                     # React Context（auth-context）
├── types/                        # 共享类型定义
├── utils/                        # 工具函数（ai-report、api、compress-image）
├── middleware.ts                 # Next.js 中间件
└── test/                         # 测试基础设施（db、setup）
```

主要 API 路由（`src/app/api/`）：`auth`（login/logout/me/change-password）、`generate`（review）、`feedbacks`、`students`（含 history/transfer/batch）、`classes`、`teachers`、`themes`、`tags`、`course-prompts`、`course-stages`、`users`（含 reset-password）、`ai-settings`、`data`（backup/restore/export/import/clear）、`stats`、`home-data`、`parse`、`health`、`init-data`、`batch-import`。

## 核心功能

- **AI 反馈生成**：基于课程阶段与学员标签，通过流式接口（SSE）实时生成反馈内容
- **学员/班级/教师管理**：支持学员转班、批量导入、历史记录查询
- **PDF 报告导出**：可定制封面、背景图、自由排版照片
- **数据备份与恢复**：全量导出/导入、备份恢复
- **用户鉴权与权限控制**：JWT + httpOnly Cookie，区分 admin / teacher 角色
- **API 限流**：内存滑动窗口限流，登录等敏感接口强制限流并返回 429
- **课程阶段与提示词管理**：可配置课程阶段、AI 提示词模板

## 环境变量

关键环境变量（完整列表见 [.env.example](./.env.example)）：

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `DATABASE_URL` | 是 | PostgreSQL 连接字符串，例如 `postgresql://user:password@localhost:5432/feedback_db` |
| `JWT_SECRET` | 是 | JWT 签名密钥，生产环境必须显式设置（无默认值，未设置时启动会失败） |
| `COZE_API_KEY` | 否 | AI SDK API Key，用于反馈生成 |
| `NEXT_PUBLIC_APP_URL` | 否 | 应用公网地址，默认 `http://localhost:5000` |
| `NEXT_PUBLIC_BG_IMAGE_URL` | 否 | PDF 背景图地址，不配置则使用默认素材 |
| `ADMIN_DEFAULT_PASSWORD` | 否 | 管理员默认密码，未设置则随机生成 |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` / `S3_BUCKET_NAME` | 否 | 对象存储配置，用于文件上传 |

> `JWT_SECRET` 在生产环境缺失时，[src/lib/auth.ts](./src/lib/auth.ts) 会抛出 `FATAL` 错误终止启动。配置说明详见 [docs/development.md](./docs/development.md)。

## Docker 部署

项目提供多阶段 Dockerfile 与 docker-compose 编排，包含 PostgreSQL 16 与应用容器，启动时自动执行数据库迁移。

```bash
docker compose up --build -d
```

应用容器监听 3000 端口。`JWT_SECRET` 必须通过环境变量或 `docker-compose.yml` 显式提供（未设置时 compose 会拒绝启动并提示生成命令）：

```bash
openssl rand -hex 32
```

部署细节、默认账号获取与生产环境建议详见 [docs/docker-deploy.md](./docs/docker-deploy.md)。

## 测试

```bash
# 单元/集成测试（使用 pglite 内存数据库，无需启动 PostgreSQL）
pnpm test

# 端到端测试（Playwright）
pnpm test:e2e
```

测试分层、文件位置约定与覆盖率目标详见 [docs/testing.md](./docs/testing.md)。

## 文档

- [开发指南](./docs/development.md)
- [测试指南](./docs/testing.md)
- [Docker 部署指南](./docs/docker-deploy.md)
- [API 错误码](./docs/api-errors.md)
- [CI 配置](./docs/ci.md)
