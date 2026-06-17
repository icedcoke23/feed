# Tasks

## Phase 1: 安全修复（P0）

- [x] Task 1: Supabase RLS 保护
  - [x] 1.1: 创建 `scripts/enable-rls.sql` — 为所有表启用 RLS 并创建策略（anon 只读公共数据，service_role 全权限）
  - [x] 1.2: 修改 `src/storage/database/supabase-client.ts` — 区分服务端客户端（service_role）和客户端（anon），API 路由使用服务端客户端
  - [x] 1.3: 验证所有 API 路由在 RLS 启用后仍正常工作

- [x] Task 2: API 路由统一认证
  - [x] 2.1: 修改所有未使用 `getAuthUser()` 的 API 路由，添加认证检查
  - [x] 2.2: 移除前端 `use-home-data.ts` 和 `use-class-actions.ts` 中的 x-user-id/x-user-role 请求头设置

- [x] Task 3: 教师资源级权限隔离
  - [x] 3.1: 修改 `src/lib/route-auth.ts` — 添加 `getTeacherClassIds(userId)` 辅助函数
  - [x] 3.2: 修改 `/api/students` GET — 教师仅返回自己班级的学员
  - [x] 3.3: 修改 `/api/students/[id]` PUT/DELETE — 教师仅能操作自己班级的学员
  - [x] 3.4: 修改 `/api/feedbacks` GET — 教师仅返回自己班级学员的反馈
  - [x] 3.5: 修改 `/api/feedbacks/[id]` PUT/DELETE — 教师仅能操作自己班级学员的反馈
  - [x] 3.6: 修改 `/api/feedbacks` POST — 教师仅能为自己班级学员创建反馈

- [x] Task 4: SSRF 防护增强
  - [x] 4.1: 修改 `src/lib/ssrf-guard.ts` — 添加 DNS 解析后二次校验、禁止十六进制/十进制/IPv6 映射 IP
  - [x] 4.2: 在 AI 相关路由中，发起请求前调用增强的 SSRF 检查

- [x] Task 5: XSS 防护
  - [x] 5.1: 安装 DOMPurify 依赖
  - [x] 5.2: 修改 `src/components/business/ai-stream-dialog.tsx` — 使用 DOMPurify 消毒后再渲染

- [x] Task 6: 移除硬编码凭据
  - [x] 6.1: 修改 `src/components/business/data-management.tsx` — 移除硬编码默认密码，改为从 API 获取或环境变量
  - [x] 6.2: 修改 `src/hooks/use-export.ts` — 移除硬编码校区名称，改为从设置获取
  - [x] 6.3: 修改 `src/app/feedback/pdf/page.tsx` — 移除硬编码校区和品牌信息

- [x] Task 7: 登录速率限制
  - [x] 7.1: 创建 `src/lib/rate-limit.ts` — 基于 IP 的滑动窗口速率限制
  - [x] 7.2: 修改 `src/app/api/auth/login/route.ts` — 添加速率限制中间件

## Phase 2: 逻辑 Bug 修复（P0-P1）

- [x] Task 8: 反馈持久化
  - [x] 8.1: 修改反馈创建流程 — 在向导最后一步添加"保存反馈"操作，调用 POST /api/feedbacks
  - [x] 8.2: 确保 feedbacks 表的 metadata 字段包含完整的标签评分和报告内容
  - [x] 8.3: 修改反馈详情页 — 从数据库加载反馈数据而非 sessionStorage

- [x] Task 9: 反馈版本号原子更新
  - [x] 9.1: 修改 `src/app/api/feedbacks/[id]/route.ts` PUT — 使用 Supabase RPC 或 SQL 表达式 `version = version + 1` 实现原子更新

- [x] Task 10: 统计逻辑修正
  - [x] 10.1: 修改 `src/hooks/use-home-data.ts` — "本月新增"同时比较年份和月份

- [x] Task 11: 批量操作数组长度限制
  - [x] 11.1: 修改 `batchStudentsSchema` 和 `batchThemesSchema` — 添加 `.max(100)` 限制
  - [x] 11.2: 修改导入路由 — 添加数组长度和 JSON 大小限制

## Phase 3: 数据一致性（P1）

- [x] Task 12: 数据库事务保护
  - [x] 12.1: 创建 Supabase RPC 函数 — `create_teacher`（事务性创建 users + teachers）
  - [x] 12.2: 创建 Supabase RPC 函数 — `delete_teacher`（事务性禁用 users + teachers）
  - [x] 12.3: 创建 Supabase RPC 函数 — `transfer_student`（事务性转班）
  - [x] 12.4: 修改相关 API 路由使用 RPC 函数

- [x] Task 13: 统一错误处理
  - [x] 13.1: 修改所有直接返回 `error.message` 的路由 — 改用 `handleDbError`
  - [x] 13.2: 确保 AI 调用失败时不泄露 API Key 和 base_url

- [x] Task 14: 修复软删除查询遗漏
  - [x] 14.1: 审查所有列表查询，确保已过滤 `is_active = true`
  - [x] 14.2: 修复缺失 `updated_at` 的软删除操作

## Phase 4: API 设计优化（P1）

- [x] Task 15: 统一 API 响应格式
  - [x] 15.1: 创建 `src/lib/api-response.ts` — `successResponse(data, message?)` 和 `errorResponse(error, status)` 辅助函数
  - [x] 15.2: 修改所有 API 路由使用统一响应格式
  - [x] 15.3: 修改前端 API 调用代码适配新响应格式

- [x] Task 16: 列表接口分页支持
  - [x] 16.1: 创建 `src/lib/pagination.ts` — 分页参数解析和响应构建辅助
  - [x] 16.2: 修改 `/api/students` — 支持 page/limit 参数
  - [x] 16.3: 修改 `/api/feedbacks` — 支持 page/limit 参数
  - [x] 16.4: 修改 `/api/teachers` — 支持 page/limit 参数
  - [x] 16.5: 修改 `/api/classes` — 支持 page/limit 参数
  - [x] 16.6: 修改前端列表组件适配分页

## Phase 5: 前端重构（P2）

- [x] Task 17: PDF 页面组件拆分
  - [x] 17.1: 提取 `src/components/business/free-layout-photo-editor.tsx`
  - [x] 17.2: 提取 `src/components/business/pdf-cover-page.tsx`
  - [x] 17.3: 提取 `src/components/business/pdf-analysis-page.tsx`
  - [x] 17.4: 提取 `src/hooks/use-pdf-pagination.ts`
  - [x] 17.5: 重构 `src/app/feedback/pdf/page.tsx` 使用拆分后的组件

- [x] Task 18: 统一类型定义
  - [x] 18.1: 创建 `src/types/student.ts` — 合并所有 Student 接口定义
  - [x] 18.2: 创建 `src/types/teacher.ts` — 合并所有 Teacher 接口定义
  - [x] 18.3: 创建 `src/types/feedback.ts` — 合并所有 Feedback 接口定义
  - [x] 18.4: 创建 `src/types/class.ts` — 合并所有 ClassItem 接口定义
  - [x] 18.5: 修改所有页面和组件使用统一类型

- [x] Task 19: 替换 confirm() 为 AlertDialog
  - [x] 19.1: 创建 `src/components/business/confirm-dialog.tsx` — 可复用的确认对话框组件
  - [x] 19.2: 修改 `use-class-actions.ts` — 使用 AlertDialog 替代 confirm()
  - [x] 19.3: 修改 `use-settings-data.ts` — 使用 AlertDialog 替代所有 confirm()
  - [x] 19.4: 修改其他使用 confirm() 的文件

- [x] Task 20: 前端错误处理统一
  - [x] 20.1: 修改所有数据获取 hook — 失败时统一使用 toast.error 提示用户
  - [x] 20.2: 统一加载状态为 Skeleton 骨架屏

## Phase 6: 清理与优化（P3）

- [x] Task 21: 代码清理
  - [x] 21.1: 移除硬编码 UUID 映射（batch-import/classes、data/import、data/full-import）
  - [x] 21.2: 移除 `data/clear` 的 POST 方法（仅保留 DELETE）
  - [x] 21.3: 清理生产环境 console.log/error（共 117 处）
  - [x] 21.4: 修复 `history` 接口中 `overall_rating` 硬编码为 4 的问题

- [x] Task 22: 移动客户端代码位置
  - [x] 22.1: 将 `src/lib/feedback-utils.ts` 中的 `compressImage` 移到 `src/utils/`
  - [x] 22.2: 将 `src/lib/api.ts` 移到 `src/utils/`

- [x] Task 23: 更新页面 metadata
  - [x] 23.1: 修改 `src/app/layout.tsx` — 将 metadata 从"扣子编程"更新为项目实际名称

# Task Dependencies
- [Task 2] depends on [Task 1] (RLS 启用后才能安全地切换客户端)
- [Task 3] depends on [Task 2] (权限隔离依赖统一认证)
- [Task 8] depends on [Task 2] (反馈持久化需要认证)
- [Task 12] depends on [Task 1] (RPC 函数需要 service_role key)
- [Task 15] depends on [Task 13] (响应格式统一需要错误处理先统一)
- [Task 16] depends on [Task 15] (分页响应格式依赖统一格式)
- [Task 17] depends on [Task 6] (PDF 拆分前先移除硬编码)
- [Task 18] depends on [Task 15] (类型定义需要适配新响应格式)
