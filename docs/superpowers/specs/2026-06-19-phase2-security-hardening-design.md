# Phase 2 安全加固 + 全量 lint 修复设计

## 背景

当前 `/workspace` 分支为原始状态，尚未包含之前在工作树中完成的安全加固改动。本次需要基于当前代码重新执行 Phase 2 安全加固，并在完成后修复全量 `pnpm lint` 问题。

## 目标

1. 移除应用层硬编码账号。
2. 流式导出大数据，避免内存溢出。
3. 使用 PostgreSQL RPC 保护导入事务。
4. 统一 API 输入校验与敏感信息脱敏。
5. 统一 Supabase 环境变量命名。
6. 全量 lint errors/warnings 修复。

## 技术栈

- Next.js App Router
- TypeScript
- Supabase (supabase-js)
- PostgreSQL / plpgsql RPC
- Zod
- Tailwind CSS

## 设计要点

### 1. 环境变量统一

- 仅使用 `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`。
- 服务端使用 `SUPABASE_SERVICE_ROLE_KEY`。
- 默认教务老师配置使用 `DEFAULT_ADMIN_TEACHERS`（JSON 数组）。
- 更新 `.env.example` 与 `src/storage/database/supabase-client.ts`。

### 2. 敏感信息脱敏

- 新增 `src/lib/sanitize.ts`：
  - `sanitizeText`：正则替换 API key、密码、URL、手机号、邮箱。
  - `sanitizeObject`：递归脱敏敏感 key。
  - `sanitizeError`：对 Error / string / message 对象统一脱敏。
- 修改 `src/lib/api-error.ts`：`handleDbError` 日志与响应消息均走 `sanitizeError`。

### 3. 移除硬编码教务老师

- 新增 `src/lib/admin-teachers.ts`：
  - 解析 `DEFAULT_ADMIN_TEACHERS`。
  - `ensureAdminTeachers`：优先按环境变量创建，否则复用数据库已有 admin 教师。
  - `mapLegacyAdminTeacherId`：处理旧备份 admin_teacher_id 映射。
- `src/app/api/data/import/route.ts` 与 `full-import/route.ts` 改用该模块。

### 4. 首次安装引导

- 新增 `src/app/setup/page.tsx` + `src/app/setup/actions.ts`。
- 新增 `src/app/api/setup/check/route.ts`。
- `src/middleware.ts` 放行 `/setup`、`/api/setup/check`。

### 5. 导入事务保护（RPC）

- 新增 `scripts/rpc-import-transaction.sql`：创建 `import_data_transaction` 函数。
- 覆盖模式在 RPC 内清空相关表，然后逐表插入/更新。
- API 层仅负责 ID 映射与校验，调用 RPC 一次性完成写入。

### 6. 导入/导出 API 改造

- `src/app/api/data/import/route.ts`：使用 `dataImportSchema` + RPC。
- `src/app/api/data/full-import/route.ts`：固定覆盖模式 + RPC。
- `src/app/api/data/export/route.ts`：使用 `ReadableStream` 分批次查询并写入 JSON。

### 7. API 输入校验全覆盖

- `src/lib/validations/schemas.ts` 新增：
  - `dataImportSchema`
  - `batchImportClassSchema`
  - `updateAdminTeacherSchema`
  - `initDataSchema`
- 应用到 `batch-import/classes`、`batch-import/update-admin-teacher`、`init-data`。
- `students/batch`、`parse` 保持已有校验，catch 块脱敏。

### 8. 敏感信息审计

- 审计 `ai-settings`、`ai-client`、`parse`、`students/batch`、`init-data`、`batch-import/*`、`import`、`full-import`、`export` 的日志输出。
- 所有 `console.error` 不再直接打印原始错误对象。

### 9. 全量 lint 修复

- 先运行 `pnpm lint -- --fix` 处理可自动修复问题。
- 剩余问题分类处理：
  - `react-hooks/set-state-in-effect`
  - `react/no-unescaped-entities`
  - `@typescript-eslint/no-unused-vars`
  - `react-hooks/exhaustive-deps`
  - `@next/next/no-img-element`
- 最终全量 `pnpm lint` 与 `pnpm ts-check` 通过。

## 执行方式

按原 11 个任务逐步执行，每个任务独立验证并 commit；lint 修复作为最后独立批次完成并提交。

## 验收标准

- [ ] `pnpm ts-check` 无错误。
- [ ] `pnpm lint` 无 errors、无 warnings。
- [ ] 硬编码教务老师已移除。
- [ ] `/setup` 页面可公开访问且能创建第一个管理员。
- [ ] 导出接口流式返回且排除 `api_key`。
- [ ] 导入接口使用 RPC 事务且带输入校验。
