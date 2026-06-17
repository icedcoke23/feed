# 教学反馈系统深度分析与优化计划

## 当前状态分析

### 项目概述
这是一个基于 Next.js 16 + Supabase + Drizzle ORM 的**个性化教学反馈系统**，核心功能包括学员管理、教师管理、班级管理、AI 生成教学反馈报告、数据看板等。

### 技术栈
- 前端: React 19 + Next.js 16 (App Router) + shadcn/ui + Tailwind CSS v4
- 数据库: Supabase (PostgreSQL) + Drizzle ORM (仅 Schema)
- AI: coze-coding-dev-sdk (豆包/Coze)
- 部署: Docker standalone + Nginx

### 发现的关键问题（按严重程度排序）

#### P0 - 致命问题（必须修复）
1. **明文密码存储和比对** - `/api/auth/login` 直接比对明文密码
2. **无服务端 API 认证** - 所有 20+ API 端点完全开放，无 Token 验证
3. **硬编码密码** - 管理员密码 `a2485204216.` 和默认教师密码硬编码在代码中
4. **危险 API 无保护** - `/api/data/clear`、`/api/data/reset-admin` 等可被任何人调用

#### P1 - 严重问题（强烈建议修复）
5. **execSync 执行 Python 代码** - `supabase-client.ts` 中使用 `execSync` 执行 Python 脚本读取环境变量，存在命令注入风险
6. **双表同步 (users/teachers)** - 两个表通过相同 UUID 关联，创建/更新/删除需手动同步，容易数据不一致
7. **Schema 与实际数据库不同步** - `users`、`ai_settings` 表未在 Schema 中定义，`students` 表缺少 `class_id`、`admin_teacher_id` 等字段
8. **无 API 输入校验** - 虽已通过 drizzle-zod 生成 Zod schema，但 API 路由中未使用
9. **超大页面组件** - 三个主要页面 1640~2628 行，所有逻辑集中在一个文件
10. **ADMIN_ROUTES 未实现** - 管理员路由保护为空数组

#### P2 - 优化建议
11. **Drizzle ORM 仅用于 Schema 定义** - 实际查询全部通过 Supabase Client，类型安全能力浪费
12. **无数据缓存层** - 每次页面切换都重新 fetch，无 SWR/TanStack Query
13. **无分页** - 大部分 GET 接口无分页，数据量大时性能堪忧
14. **N+1 查询** - `/api/stats` 在应用层遍历 JSONB 做统计
15. **环境变量命名不一致** - `.env.example` 用 `NEXT_PUBLIC_SUPABASE_URL`，代码用 `COZE_SUPABASE_URL`
16. **console.log 遗留** - 生产代码中大量调试日志
17. **缺少 .dockerignore** - Docker 构建会复制 .env、node_modules 等
18. **Nginx SSE 超时不足** - AI 生成接口可能超过 60s 超时
19. **relations.ts 空文件** - Drizzle 关系定义未实现
20. **无业务组件** - 所有业务逻辑直接写在页面文件中，未抽取复用组件

---

## 提议的变更

### 变更 1: 安全认证体系重构（P0）
**文件**:
- 新建 `src/middleware.ts` - Next.js Middleware 统一 API 认证
- 重写 `src/contexts/auth-context.tsx` - JWT Token 管理
- 重写 `src/app/api/auth/login/route.ts` - bcrypt 密码哈希 + JWT 签发
- 修改所有 API 路由 - 添加认证检查
- 移除硬编码密码，改为环境变量 + 首次启动引导

**为什么**: 当前系统无任何服务端认证，所有 API 完全开放，密码明文存储，这是不可接受的安全状态。

**怎么做**:
1. 引入 `bcryptjs` 做密码哈希
2. 引入 `jose` 做 JWT 签发/验证（Edge Runtime 兼容）
3. 在 `middleware.ts` 中验证 JWT Token，保护所有 `/api/*` 路由（除 `/api/auth/login`）
4. 前端登录后获取 JWT，存储在 httpOnly Cookie 中
5. 移除所有硬编码密码，创建数据库迁移脚本将现有明文密码转为哈希

### 变更 2: 数据库层统一（P1）
**文件**:
- 重写 `src/storage/database/shared/schema.ts` - 补充缺失表和字段
- 重写 `src/storage/database/shared/relations.ts` - 定义 Drizzle 关系
- 重写 `src/storage/database/supabase-client.ts` - 移除 Python execSync
- 新建 `src/lib/db/index.ts` - 统一数据访问层
- 新建 `src/lib/db/students.ts`, `teachers.ts`, `feedbacks.ts` 等 - 封装数据库操作

**为什么**: Schema 与实际数据库不同步，Drizzle ORM 能力浪费，数据库操作散落在各 API 路由中难以维护。

**怎么做**:
1. 补充 `users`、`ai_settings` 表定义，同步 `students` 表字段
2. 定义 Drizzle relations（students->teachers, feedbacks->students 等）
3. 移除 `supabase-client.ts` 中的 Python execSync，改用 dotenv
4. 创建统一数据访问层，将散落在 API 路由中的 Supabase 调用集中管理
5. 逐步将 Supabase Client 查询迁移为 Drizzle ORM 查询

### 变更 3: API 输入校验（P1）
**文件**:
- 新建 `src/lib/validations/` 目录 - 集中管理 Zod 校验 schema
- 修改所有 POST/PUT API 路由 - 添加输入校验

**为什么**: 当前所有 API 路由直接 `await request.json()` 使用，无任何校验，存在注入和数据完整性风险。

**怎么做**:
1. 基于已有的 drizzle-zod schema，创建 API 输入校验 schema
2. 在每个 POST/PUT 路由中添加 Zod 校验
3. 返回统一的 400 错误响应格式

### 变更 4: 前端组件化重构（P1）
**文件**:
- 拆分 `src/app/page.tsx` (~1640行) → 多个业务组件 + 自定义 Hook
- 拆分 `src/app/feedback/new/page.tsx` (~2628行) → 多个业务组件 + 自定义 Hook
- 拆分 `src/app/settings/page.tsx` (~2376行) → 多个业务组件 + 自定义 Hook
- 新建 `src/components/business/` 目录 - 业务组件
- 新建 `src/hooks/` 目录 - 自定义 Hook

**为什么**: 三个超大页面组件严重影响可维护性、代码复用性和首屏渲染性能。

**怎么做**:
1. 从每个页面中抽取独立业务组件（学员卡片、标签评分、AI报告预览等）
2. 抽取数据获取逻辑为自定义 Hook（useStudents, useTeachers 等）
3. 引入 SWR 或 TanStack Query 做数据缓存
4. 每个组件控制在 300 行以内

### 变更 5: 性能优化（P2）
**文件**:
- 修改 `/api/stats` - 使用数据库聚合替代应用层计算
- 修改所有列表 API - 添加分页支持
- 修改 `nginx.conf.example` - SSE 超时配置
- 新建 `.dockerignore`
- 清理 `console.log`

**为什么**: 无分页、N+1 查询、无缓存等导致系统在数据量增长后性能急剧下降。

**怎么做**:
1. `/api/stats` 改用 SQL 聚合函数
2. 所有列表 API 添加 `page`/`pageSize` 参数
3. Nginx 为 `/api/generate` 配置 `proxy_read_timeout 300s`
4. 添加 `.dockerignore`
5. 移除/替换 console.log

---

## 假设与决策

1. **认证方案选择 JWT + httpOnly Cookie** - 比 Session 更适合 Docker 部署的无状态架构
2. **数据访问层选择 Drizzle ORM** - 项目已引入 Drizzle，应充分利用其类型安全查询能力
3. **前端数据缓存选择 SWR** - 比 TanStack Query 更轻量，与 Next.js 生态更契合
4. **密码哈希选择 bcryptjs** - 纯 JS 实现，无需原生编译，Docker alpine 镜像兼容
5. **组件化重构渐进式** - 不做一次性大重构，按页面逐步拆分

## 验证步骤

1. 安全测试：验证未认证请求被拦截，密码已哈希存储
2. API 测试：验证输入校验生效，非法输入返回 400
3. 功能测试：验证所有现有功能正常工作
4. 性能测试：验证分页和缓存生效
5. 构建测试：`pnpm build` 成功，Docker 镜像正常构建
