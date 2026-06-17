# Tasks

## Phase 1: P0 编译修复（阻断性）

- [x] Task 1: 修复 4 个文件未导入函数的编译错误
  - [x] 1.1: `src/app/api/ai-settings/route.ts` — 添加 `forbiddenError` 到 import
  - [x] 1.2: `src/app/api/init-data/route.ts` — 添加 `successResponse, errorResponse` 到 import，添加 `getAuthUser` 认证
  - [x] 1.3: `src/app/api/batch-import/classes/route.ts` — 添加 `errorResponse, successResponse` 到 import
  - [x] 1.4: `src/app/api/export/route.ts` — 添加 `errorResponse` 到 import

## Phase 2: P0 功能修复（阻断性）

- [x] Task 2: 修复转班 RPC 列名错误
  - [x] 2.1: 修复 `scripts/enable-rls.sql` 中 `transfer_student` RPC 的 INSERT 列名（`from_class_id`→`from_class`, `to_class_id`→`to_class`, `transfer_date`→`transferred_at`）
  - [x] 2.2: 修复转班 RPC 更新 `current_teacher_id` 和 `current_class` 字段
  - [ ] 2.3: 在 Supabase 中重新执行修复后的 RPC 定义

- [x] Task 3: 修复 `updated_at` 字段不匹配的运行时错误
  - [x] 3.1: `src/app/api/users/[id]/route.ts` — 移除或条件化 `updated_at` 更新（users 表无此字段）
  - [x] 3.2: `src/app/api/users/[id]/reset-password/route.ts` — 无需修改（本就没有 updated_at）
  - [x] 3.3: `src/app/api/auth/change-password/route.ts` — 无需修改（本就没有 updated_at）
  - [x] 3.4: `src/app/api/tags/[id]/route.ts` DELETE — 移除 `updated_at`（tags 表无此字段）
  - [x] 3.5: `src/app/api/tags/[id]/route.ts` PUT — 确认不设置 `updated_at`
  - [x] 3.6: `src/app/api/themes/[id]/route.ts` PUT — 确认不设置 `updated_at`

- [x] Task 4: 修复 `use-photo-editor.ts` 属性名 bug
  - [x] 4.1: 第 62 行 `fallbackUrl` 改为 `url: fallbackUrl`

## Phase 3: P0 安全修复

- [x] Task 5: 为缺少认证的 API 路由添加 `getAuthUser()` 检查
  - [x] 5.1: `src/app/api/init-data/route.ts` POST（Task 1 已添加）
  - [x] 5.2: `src/app/api/classes/route.ts` POST
  - [x] 5.3: `src/app/api/classes/[id]/route.ts` GET

- [x] Task 6: 为缺少 admin 角色校验的路由添加权限检查
  - [x] 6.1-6.13: 全部 13 个路由已添加 admin 校验（forbiddenError 从 @/lib/api-error 导入）

- [x] Task 7: 反馈创建添加教务老师权限验证
  - [x] 7.1: `src/app/api/feedbacks/route.ts` POST — 教务老师验证 admin_teacher_id 匹配（使用 authUser.userId）
  - [x] 7.2: `src/app/api/students/[id]/transfer/route.ts` — 添加权限校验

## Phase 4: P1 数据一致性

- [x] Task 8: 教务老师数据隔离
  - [x] 8.1: `src/app/api/home-data/route.ts` — 教务老师按 `admin_teacher_id` 过滤学生
  - [x] 8.2: `src/app/api/stats/route.ts` — 教务老师按 `admin_teacher_id` 过滤统计
  - [x] 8.3: `src/app/api/feedbacks/route.ts` GET — 教务老师按 `admin_teacher_id` 过滤

- [x] Task 9: 修复软删除查询遗漏
  - [x] 9.1: `src/app/api/feedbacks/route.ts` — 查询学生 ID 时过滤 `is_active`
  - [x] 9.2: `src/app/api/stats/route.ts` — feedbacks 查询关联过滤软删除学生
  - [x] 9.3: `src/app/api/students/[id]/history/route.ts` — 校验学生未软删除
  - [x] 9.4: `src/lib/route-auth.ts` — `getTeacherClassIds` 和 `canTeacherAccessStudent` 过滤 `is_active`

- [x] Task 10: 修复字段映射混淆
  - [x] 10.1: `src/hooks/use-student-actions.ts` — 修正 `currentTeacherId` 与 `adminTeacherId` 的赋值
  - [x] 10.2: `src/app/student/[id]/page.tsx` — 修正 `adminTeacherId` 取值来源

## Phase 5: P1 前端质量

- [x] Task 11: 修复 `handleAddStudent` 缺少 saving 状态
  - [x] 11.1: `src/hooks/use-student-actions.ts` — 添加 `adding` 状态

- [x] Task 12: 修复编辑模式加载竞态条件
  - [x] 12.1: `src/hooks/use-feedback-form.ts` — `loadFeedbackForEdit` 添加 `cancelled` 标志和 cleanup

- [x] Task 13: 修复 SSE 流未自动 abort
  - [x] 13.1: `src/hooks/use-sse-stream.ts` — 添加 `useEffect` cleanup 调用 `abortStream`

- [x] Task 14: 修复 Blob URL 内存泄漏
  - [x] 14.1: `src/hooks/use-photo-editor.ts` — 照片删除/替换时调用 `URL.revokeObjectURL`
  - [x] 14.2: `src/hooks/use-feedback-form.ts` — 照片删除时调用 `URL.revokeObjectURL`

- [x] Task 15: 搜索输入框防抖
  - [x] 15.1: `src/hooks/use-home-data.ts` — `searchQuery` 添加 300ms 防抖

- [x] Task 16: PDF 数据加载失败处理
  - [x] 16.1: `src/app/feedback/pdf/page.tsx` — JSON.parse 失败时设置 `noData=true`

## Phase 6: P1 PDF/图片

- [x] Task 17: 修复自由裁剪旋转/翻转坐标错误
  - [x] 17.1: `src/components/business/image-crop-dialog.tsx` — `getFreeCropPixels` 考虑旋转后的坐标变换

- [x] Task 18: 裁剪输出格式优化
  - [x] 18.1: `src/components/business/image-crop-dialog.tsx` — PNG 保留 PNG，其他输出 JPEG

- [x] Task 19: 统一 compressImage 实现
  - [x] 19.1: 删除 `src/utils/image-utils.ts`（无引用）
  - [x] 19.2: 修复 `src/utils/compress-image.ts` PNG 透明通道保留逻辑

- [x] Task 20: PDF 打印流程处理保存失败
  - [x] 20.1: `src/app/feedback/pdf/page.tsx` — `handleSave` 返回 boolean，`handlePrint` 根据结果决定

## Phase 7: P2 代码质量

- [x] Task 21: 提取通用 CRUD hook（跳过，风险较大）
  - [x] 21.1: 跳过 — 提取泛型 hook 容易破坏现有功能，保持现状

- [x] Task 22: 添加 error 状态
  - [x] 22.1: `src/hooks/use-feedback-data.ts` — 添加 `error` 状态
  - [x] 22.2: `src/hooks/use-home-data.ts` — 添加 `error` 状态

# Task Dependencies
- [Task 5] depends on [Task 1] (init-data 需先修复 import)
- [Task 6] depends on [Task 1] (batch-import/classes 需先修复 import)
- [Task 7] depends on [Task 6] (权限验证依赖 admin 校验基础)
- [Task 8] depends on [Task 9] (数据隔离依赖软删除过滤)
- [Task 1-4] 可并行执行
- [Task 5-7] 可并行执行
- [Task 8-10] 可并行执行
- [Task 11-16] 可并行执行
- [Task 17-20] 可并行执行
