# 深度审计与优化 V3 Spec

## Why
经过四路并行深度分析，发现项目存在编译错误（4 个文件未导入使用的函数）、转班功能完全不可用（RPC 列名错误）、13+ 个 API 路由缺少角色权限校验、多处软删除查询遗漏、前端内存泄漏和竞态条件等问题。这些问题影响功能可用性、数据一致性和安全性。

## What Changes

### P0 编译修复（阻断性）
- 修复 `ai-settings/route.ts` 未导入 `forbiddenError`
- 修复 `init-data/route.ts` 未导入 `successResponse`/`errorResponse`
- 修复 `batch-import/classes/route.ts` 未导入 `errorResponse`/`successResponse`
- 修复 `export/route.ts` 未导入 `errorResponse`

### P0 功能修复（阻断性）
- 修复 `transfer_student` RPC 列名错误（`from_class_id`→`from_class` 等），转班功能不可用
- 修复 `users`/`tags` 表无 `updated_at` 字段但代码尝试更新的运行时错误
- 修复 `use-photo-editor.ts` 第 62 行属性名 bug（`fallbackUrl`→`url`）

### P0 安全修复
- 为 13+ 个缺少角色校验的 API 路由添加 admin 权限检查
- 为 3 个完全无认证的 API 路由添加 `getAuthUser()` 检查
- 反馈创建添加教务老师权限验证
- 转班路由添加权限校验

### P1 数据一致性
- 修复转班未更新 `current_teacher_id`/`current_class`
- 修复 `admin_teacher_id` 在 home-data/stats/feedbacks 查询中未用于数据隔离
- 修复软删除查询遗漏（feedbacks 列表、stats、history 等未过滤 is_active）
- 修复 `use-student-actions`/`student/[id]/page.tsx` 字段映射混淆

### P1 前端质量
- 修复 `handleAddStudent` 缺少 saving 状态（可重复提交）
- 修复 `use-feedback-form` 编辑模式加载缺少 cleanup 与竞态保护
- 修复 `use-sse-stream` 组件卸载时未自动 abort
- 修复 Blob URL 内存泄漏（`use-photo-editor`、`use-feedback-form`）
- 搜索输入框添加防抖
- PDF 数据加载失败时设置 noData 状态（而非永远"加载中"）

### P1 PDF/图片
- 修复自由裁剪旋转/翻转后坐标计算错误
- 裁剪输出改为 JPEG（照片）而非固定 PNG
- 统一两个同名 `compressImage` 实现
- 修复 PNG 透明通道丢失问题
- PDF 打印流程处理保存失败

### P2 代码质量
- `use-settings-data.ts` 提取通用 CRUD hook 消除重复
- 搜索输入框防抖
- 缺少 error 状态的 hook 添加 error 状态

## Impact
- Affected code: `src/app/api/` 全部路由、`src/hooks/`、`src/components/business/`、`scripts/enable-rls.sql`
- **BREAKING**: 无破坏性变更，所有修复向后兼容

## ADDED Requirements

### Requirement: API 角色权限统一校验
The system SHALL enforce admin role checks on all management API routes (users, teachers, course-stages, data import/export/clear, batch-import, init-data).

#### Scenario: Teacher attempts admin operation
- **WHEN** a teacher-role user calls POST /api/teachers
- **THEN** return 403 forbidden

#### Scenario: Unauthenticated user accesses protected route
- **WHEN** an unauthenticated user calls GET /api/classes/[id]
- **THEN** return 401 unauthorized

### Requirement: Transfer Student Functionality
The system SHALL correctly execute student transfer with proper column names and update all related fields.

#### Scenario: Transfer student to new class
- **WHEN** admin transfers a student to a new class
- **THEN** student's class_id, current_teacher_id, and current_class are all updated
- **AND** a class_transfer record is created with correct column names

### Requirement: Staff Teacher Data Isolation
The system SHALL filter data by admin_teacher_id for staff teachers in all relevant queries.

#### Scenario: Staff teacher views homepage
- **WHEN** a staff teacher (teacherRole=admin) loads homepage data
- **THEN** only students with admin_teacher_id matching the teacher's ID are returned
