# Tasks

- [x] Task 1: 修复登录路由安全漏洞（P0）
  - [x] 1.1: 修复 `src/app/api/auth/login/route.ts` — 移除 cost factor 检查和密码绕过逻辑，仅使用 bcrypt compare
  - [x] 1.2: 确保登录失败时绝不信任用户输入

- [x] Task 2: API 路由认证安全加固（P0）
  - [x] 2.1: 创建 `src/lib/route-auth.ts` — 提供统一的 `getAuthUser(request)` 函数
  - [x] 2.2: 修改 API 路由 — 将 `request.headers.get("x-user-id")` 替换为 `getAuthUser(request)`
  - [x] 2.3: 修改 middleware — 移除向请求头注入 x-user-id/x-user-role 的逻辑

- [x] Task 3: SSRF 防护（P0）
  - [x] 3.1: 创建 `src/lib/ssrf-guard.ts` — `isSafeUrl()` 函数
  - [x] 3.2: 修改 `src/app/api/ai-settings/route.ts` PUT — 校验 base_url
  - [x] 3.3: 修改 `src/app/api/ai-settings/test/route.ts` — 校验 base_url
  - [x] 3.4: 修改 generate/review/parse 路由 — 校验 base_url

- [x] Task 4: 数据导入安全加固（P0）
  - [x] 4.1: 修改 `src/app/api/data/import/route.ts` — 字段白名单 + null 保护
  - [x] 4.2: 修改 `src/app/api/data/full-import/route.ts` — 同上

- [x] Task 5: 全局 ErrorBoundary（P0）
  - [x] 5.1: 修改 `src/app/layout.tsx` — 包裹 ErrorBoundary
  - [x] 5.2: ErrorBoundary 显示友好的错误提示和重试按钮

- [x] Task 6: 修复路由守卫配置（P0）
  - [x] 6.1: 修改 `route-guard.tsx` — PROTECTED_ROUTES 添加 /student /dashboard，ADMIN_ROUTES 仅 /admin
  - [x] 6.2: 修改 `middleware.ts` — ADMIN_ONLY_PAGES 同步调整

- [x] Task 7: 修复 PDF 页面内存泄漏（P0）
  - [x] 7.1: FreeLayoutPhotoEditor 裁剪事件监听器组件卸载时清理

- [x] Task 8: 补全输入校验（P1）
  - [x] 8.1: students/route.ts — POST/PUT 使用 validatedData 替代 body
  - [x] 8.2: feedbacks/route.ts — 收紧 schema，使用 validatedData
  - [x] 8.3: transfer/route.ts — 添加 Zod schema
  - [x] 8.4: batch/route.ts — 添加 Zod schema
  - [x] 8.5: themes/batch/route.ts — 添加 Zod schema
  - [x] 8.6: export/route.ts — 添加 Zod schema
  - [x] 8.7: ai-settings/test/route.ts — 添加 Zod schema

- [x] Task 9: Middleware ADMIN_ONLY 路由补全（P1）
  - [x] 9.1: ADMIN_ONLY_API_PREFIXES 添加 6 个敏感路由前缀

- [x] Task 10: Dashboard 组件提取（P1）
  - [x] 10.1: SimpleBarChart/SimplePieChart 提取到文件顶层
  - [x] 10.2: Dashboard 使用共享 AppHeader/AppSidebar

- [x] Task 11: 清理硬编码凭据（P0）
  - [x] 11.1: run-init.ps1 — 改用环境变量
  - [x] 11.2: init-db.js — 改用环境变量
  - [x] 11.3: create-admin.js — 改用环境变量

- [x] Task 12: 同步初始化脚本 schema（P1）
  - [x] 12.1: init-db.js — 添加 metadata/work_info/ability_scores 列和唯一索引
  - [x] 12.2: init-db-pg.js — 同步更新

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 2]
- [Task 8] depends on [Task 2]
- [Task 9] depends on [Task 6]
