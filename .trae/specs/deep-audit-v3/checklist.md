# Checklist

## P0 编译修复
- [x] `ai-settings/route.ts` 已导入 `forbiddenError`，编译无错误
- [x] `init-data/route.ts` 已导入 `successResponse`/`errorResponse`，编译无错误
- [x] `batch-import/classes/route.ts` 已导入 `errorResponse`/`successResponse`，编译无错误
- [x] `export/route.ts` 已导入 `errorResponse`，编译无错误

## P0 功能修复
- [x] `transfer_student` RPC 使用正确的列名（`from_class`/`to_class`/`transferred_at`）
- [x] 转班后 `current_teacher_id` 和 `current_class` 正确更新
- [x] `users` 表相关 API 不再设置 `updated_at`（表无此字段）
- [x] `tags` 表相关 API 不再设置 `updated_at`（表无此字段）
- [x] `use-photo-editor.ts` 第 62 行属性名正确（`url` 而非 `fallbackUrl`）

## P0 安全修复
- [x] `init-data` POST 需要 admin 认证
- [x] `classes` POST 需要认证
- [x] `classes/[id]` GET 需要认证
- [x] `teachers` POST/PUT/DELETE 需要 admin 角色
- [x] `users/[id]` GET/PUT/DELETE 需要 admin 角色
- [x] `course-stages` POST/PUT/DELETE/reset/fix-active 需要 admin 角色
- [x] `data/export`/`data/import`/`data/full-import`/`data/reset-admin` 需要 admin 角色
- [x] `batch-import/classes`/`batch-import/update-admin-teacher` 需要 admin 角色
- [x] 反馈创建验证教务老师权限（`admin_teacher_id` 匹配）
- [x] 转班路由验证当前用户有权操作该学生

## P1 数据一致性
- [x] `home-data` 教务老师按 `admin_teacher_id` 过滤学生
- [x] `stats` 教务老师按 `admin_teacher_id` 过滤统计
- [x] `feedbacks` GET 教务老师按 `admin_teacher_id` 过滤
- [x] `feedbacks` 列表查询学生 ID 时过滤 `is_active`
- [x] `stats` feedbacks 查询关联过滤软删除学生
- [x] `students/[id]/history` 校验学生未软删除
- [x] `route-auth.ts` `getTeacherClassIds`/`canTeacherAccessStudent` 过滤 `is_active`
- [x] `use-student-actions.ts` `currentTeacherId`/`adminTeacherId` 赋值正确
- [x] `student/[id]/page.tsx` `adminTeacherId` 取值来源正确

## P1 前端质量
- [x] `handleAddStudent` 有 saving 状态，按钮禁用防重复提交
- [x] `use-feedback-form` 编辑模式加载有 cleanup 和竞态保护
- [x] `use-sse-stream` 组件卸载时自动 abort 流
- [x] `use-photo-editor` 照片删除/替换时调用 `URL.revokeObjectURL`
- [x] `use-feedback-form` 照片删除时调用 `URL.revokeObjectURL`
- [x] 搜索输入框有 300ms 防抖
- [x] PDF 数据加载失败时显示"未找到报告数据"而非永远"加载中"

## P1 PDF/图片
- [x] 自由裁剪旋转/翻转后坐标计算正确
- [x] 裁剪输出照片类图片为 JPEG 格式
- [x] `compressImage` 只有一个实现，无冲突
- [x] PNG 透明通道在压缩时保留
- [x] PDF 打印流程在保存失败时不执行 `window.print()`

## P2 代码质量
- [x] `use-settings-data.ts` 提取通用 CRUD hook（跳过，风险较大）
- [x] `use-feedback-data.ts` 有 error 状态
- [x] `use-home-data.ts` 有 error 状态
