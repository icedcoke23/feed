# Phase 2 安全加固 + 本地 PostgreSQL + 全量 lint 修复设计

## 背景

当前 `/workspace` 分支为原始状态，使用远程 Supabase（`supabase-js`）。用户要求：

1. 数据改在**本地 PostgreSQL** 中存储，不再使用 Supabase 托管数据库。
2. 重新执行 Phase 2 安全加固。
3. 完成后修复全量 `pnpm lint` 问题。

## 目标

1. 用 Drizzle ORM + 本地 PostgreSQL 替换 `supabase-js` 数据访问层。
2. 移除应用层硬编码账号。
3. 流式导出大数据。
4. 使用 Drizzle 事务保护导入。
5. 统一 API 输入校验与敏感信息脱敏。
6. 全量 lint errors/warnings 修复。

## 技术栈

- Next.js App Router
- TypeScript
- PostgreSQL（本地，推荐 Docker）
- Drizzle ORM + `pg`
- Drizzle Kit（迁移）
- Zod
- Tailwind CSS

## 设计要点

### 1. 本地数据库接入

- 新增 `docker-compose.yml` 或更新现有文件，启动本地 PostgreSQL。
- 环境变量改为 `DATABASE_URL`（例如 `postgresql://postgres:postgres@localhost:5432/edu_db`）。
- 删除 `COZE_SUPABASE_URL`、`COZE_SUPABASE_ANON_KEY`、`NEXT_PUBLIC_SUPABASE_*` 等 Supabase 数据库相关变量。
- 新增 `drizzle.config.ts` 配置 schema 路径与数据库连接。
- 新增 `src/storage/database/drizzle-client.ts`：使用 `pg` 创建连接池并导出 `db` 实例。
- 保留 `src/storage/database/supabase-client.ts` 作为过渡，但内部改为抛错或重定向，避免旧代码误用；最终删除。

### 2. Schema 补全

- 在 `src/storage/database/shared/schema.ts` 中补全所有应用表：
  - `student_classes`（班级-学生多对多）
  - 检查并补齐 `users.password`、`teachers.email`、`class_transfers`、`feedbacks` 等字段与代码一致。
- 新增 `src/storage/database/shared/relations.ts` 定义表关系（可选，用于简化 join）。
- 使用 `drizzle-kit generate` 生成迁移文件，`drizzle-kit migrate` 应用到本地数据库。
- 新增 `scripts/seed.ts`（可选）：初始化管理员账号、默认标签、课程阶段等。

### 3. 数据访问层迁移

- 把所有 `getServerSupabaseClient()` + `.from(...)` 调用替换为 `db` 查询。
- 封装常用查询到 `src/lib/db/` 模块，例如：
  - `src/lib/db/users.ts`
  - `src/lib/db/teachers.ts`
  - `src/lib/db/students.ts`
  - `src/lib/db/classes.ts`
  - `src/lib/db/feedbacks.ts`
  - `src/lib/db/data-transfer.ts`（导入导出）
- 优先改造 Phase 2 涉及文件：
  - `src/app/api/data/import/route.ts`
  - `src/app/api/data/full-import/route.ts`
  - `src/app/api/data/export/route.ts`
  - `src/app/api/data/reset-admin/route.ts`
  - `src/app/api/ai-settings/route.ts`
  - `src/lib/ai-client.ts`
  - `src/lib/route-auth.ts`
- 其他路由按模块分批迁移：auth、users、teachers、students、classes、feedbacks、stats、home-data、themes、tags、course-stages、course-prompts、batch-import、generate。

### 4. 导入事务保护

- 不再使用 Supabase RPC。
- 在 `src/lib/db/data-transfer.ts` 中使用 Drizzle 事务：

```ts
await db.transaction(async (tx) => {
  if (mode === "overwrite") {
    await tx.delete(...);
  }
  await tx.insert(...);
  await tx.update(...);
});
```

- 导入前在应用层做 ID 映射与校验，事务内使用映射后的 ID 写入。

### 5. 流式导出

- `src/app/api/data/export/route.ts` 使用 Drizzle 分页查询 + `ReadableStream` 写入 JSON。
- `ai_settings` 表排除 `api_key` 字段。
- 错误时使用 `controller.error()` 终止流。

### 6. 移除硬编码教务老师

- 新增 `src/lib/admin-teachers.ts`：
  - 解析 `DEFAULT_ADMIN_TEACHERS` 环境变量（JSON 数组）。
  - `ensureAdminTeachers`：优先按环境变量创建/更新，否则复用数据库已有 admin 教师。
  - `mapLegacyAdminTeacherId`：旧备份数据 `admin_teacher_id` 映射到本地教师 ID。
- 在导入流程中调用。

### 7. 首次安装引导

- 新增 `src/app/setup/page.tsx` + `src/app/setup/actions.ts`。
- 新增 `src/app/api/setup/check/route.ts`。
- `src/middleware.ts` 放行 `/setup`、`/api/setup/check`。
- 当数据库中无管理员用户时，引导创建第一个管理员。

### 8. 敏感信息脱敏

- 新增 `src/lib/sanitize.ts`：
  - `sanitizeText`：替换 API key、密码、URL、手机号、邮箱。
  - `sanitizeObject`：递归脱敏敏感 key。
  - `sanitizeError`：统一 Error / string / message 对象脱敏。
- 修改 `src/lib/api-error.ts`：`handleDbError` 日志与响应消息均走 `sanitizeError`。
- 审计所有 `console.error`，不再直接打印原始错误对象。

### 9. API 输入校验全覆盖

- `src/lib/validations/schemas.ts` 新增：
  - `dataImportSchema`
  - `batchImportClassSchema`
  - `updateAdminTeacherSchema`
  - `initDataSchema`
- 应用到 `batch-import/classes`、`batch-import/update-admin-teacher`、`init-data`。
- `students/batch`、`parse` 保持已有校验，catch 块脱敏。

### 10. 全量 lint 修复

- 先运行 `pnpm lint -- --fix` 处理可自动修复问题。
- 剩余问题分类处理：
  - `react-hooks/set-state-in-effect`
  - `react/no-unescaped-entities`
  - `@typescript-eslint/no-unused-vars`
  - `react-hooks/exhaustive-deps`
  - `@next/next/no-img-element`
- 最终全量 `pnpm lint` 与 `pnpm ts-check` 通过。

## 执行方式

按以下阶段逐步执行，每个阶段独立验证并 commit：

1. 本地数据库环境 + Drizzle 配置 + schema 补全。
2. Drizzle client 与数据访问层基础封装。
3. 迁移 Phase 2 核心路由（import / full-import / export / reset-admin / ai-settings / route-auth / ai-client）。
4. 迁移剩余 API 路由（auth / users / teachers / students / classes / feedbacks / stats / home-data / themes / tags / course-stages / course-prompts / batch-import / generate）。
5. 移除硬编码教务老师 + setup 引导页。
6. 敏感信息脱敏 + API 输入校验全覆盖。
7. 全量 lint 修复。
8. 最终验证与清理。

## 验收标准

- [ ] `pnpm ts-check` 无错误。
- [ ] `pnpm lint` 无 errors、无 warnings。
- [ ] `docker-compose up postgres` 可启动本地数据库。
- [ ] `drizzle-kit migrate` 可创建所有表。
- [ ] 应用启动后能正常读写本地 PostgreSQL。
- [ ] 硬编码教务老师已移除。
- [ ] `/setup` 页面可公开访问且能创建第一个管理员。
- [ ] 导出接口流式返回且排除 `api_key`。
- [ ] 导入接口使用 Drizzle 事务且带输入校验。
