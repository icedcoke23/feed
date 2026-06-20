# Checklist

## Phase 1: 数据库深度优化

### 1.1 Schema 与约束
- [ ] `classes.teacher_id` 有外键约束指向 `teachers.id`，ON DELETE SET NULL
- [ ] `students.admin_teacher_id` 有外键约束指向 `teachers.id`，ON DELETE SET NULL
- [ ] `students.current_teacher_id` 有外键约束指向 `teachers.id`，ON DELETE SET NULL
- [ ] `feedbacks.student_id` 有外键约束指向 `students.id`，ON DELETE CASCADE
- [ ] `feedbacks.teacher_id` 有外键约束指向 `teachers.id`，ON DELETE RESTRICT
- [ ] `feedbacks.parent_feedback_id` 有外键约束指向 `feedbacks.id`，ON DELETE SET NULL
- [ ] `class_transfers.student_id` 有外键约束指向 `students.id`，ON DELETE CASCADE
- [ ] `class_transfers.from_teacher_id` 有外键约束指向 `teachers.id`，ON DELETE SET NULL
- [ ] `class_transfers.to_teacher_id` 有外键约束指向 `teachers.id`，ON DELETE RESTRICT
- [ ] `teachers.id` 有外键约束指向 `users.id`，ON DELETE CASCADE
- [ ] `student_classes.student_id` 有外键约束指向 `students.id`，ON DELETE CASCADE
- [ ] `student_classes.class_id` 有外键约束指向 `classes.id`，ON DELETE CASCADE
- [ ] `course_prompts.stage_code` 有外键约束指向 `course_stages.stage_code`，ON DELETE CASCADE

### 1.2 feedback_items 表
- [ ] `feedback_items` 表已创建，包含 id, feedback_id, tag_id, category, name, description, rating, sort_order, created_at
- [ ] `feedback_items.feedback_id` 有外键 ON DELETE CASCADE
- [ ] `feedback_items.tag_id` 有外键 ON DELETE SET NULL
- [ ] `feedback_items.category` 有 CHECK 约束 `IN ('strength','improvement','weakness')`
- [ ] `feedback_items.rating` 有 CHECK 约束 `BETWEEN 1 AND 5`
- [ ] `idx_feedback_items_feedback_id` 索引已创建
- [ ] `idx_feedback_items_tag_id` 索引已创建
- [ ] `idx_feedback_items_category` 索引已创建
- [ ] 现有 JSONB 数据已迁移到 `feedback_items` 表
- [ ] Drizzle Schema 中已添加 `feedback_items` 表定义

### 1.3 feedback_ability_scores 表
- [ ] `feedback_ability_scores` 表已创建，包含 id, feedback_id, ability_name, score, created_at
- [ ] `feedback_ability_scores.feedback_id` 有外键 ON DELETE CASCADE
- [ ] `feedback_ability_scores.score` 有 CHECK 约束 `BETWEEN 1 AND 5`
- [ ] `idx_feedback_ability_unique(feedback_id, ability_name)` 唯一索引已创建
- [ ] 现有 ability_scores JSONB 数据已迁移
- [ ] Drizzle Schema 中已添加 `feedback_ability_scores` 表定义

### 1.4 student_classes Schema
- [ ] `studentClasses` 表定义已添加到 Drizzle Schema
- [ ] `is_primary` 字段和唯一约束已定义
- [ ] `relations.ts` 中已添加 `studentClasses` 关系定义
- [ ] Zod 校验 schema 和 TypeScript 类型已生成

### 1.5 ai_settings 结构化
- [ ] 新 `ai_settings` 表已创建（结构化字段）
- [ ] 现有 key-value 数据已迁移到结构化表
- [ ] Drizzle Schema 中 `aiSettings` 表定义已更新
- [ ] `src/lib/ai-client.ts` 的 `getAISettings()` 已更新

### 1.6 索引优化
- [ ] `feedbacks(student_id, created_at DESC)` 复合索引已创建
- [ ] `feedbacks(teacher_id, created_at DESC)` 复合索引已创建
- [ ] `feedbacks(status, created_at DESC)` 复合索引已创建
- [ ] `students(admin_teacher_id, created_at DESC)` 复合索引已创建
- [ ] `student_classes(class_id, is_primary) WHERE is_primary = true` 部分索引已创建
- [ ] `class_transfers(student_id, transferred_at DESC)` 复合索引已创建
- [ ] `students(name) WHERE is_active = true` 部分索引已创建
- [ ] `classes(teacher_id) WHERE is_active = true` 部分索引已创建
- [ ] `teachers(role) WHERE is_active = true` 部分索引已创建
- [ ] `course_stages(theme, level) WHERE is_active = true` 部分索引已创建
- [ ] `feedbacks USING GIN (metadata)` 索引已创建
- [ ] `feedbacks USING GIN (work_info)` 索引已创建

### 1.7 触发器
- [ ] `update_updated_at_column()` 函数已创建
- [ ] `teachers` 表有 `updated_at` 触发器
- [ ] `students` 表有 `updated_at` 触发器
- [ ] `classes` 表有 `updated_at` 触发器
- [ ] `feedbacks` 表有 `updated_at` 触发器
- [ ] `course_stages` 表有 `updated_at` 触发器
- [ ] `course_prompts` 表有 `updated_at` 触发器
- [ ] `ai_settings` 表有 `updated_at` 触发器

### 1.8 RPC 函数
- [ ] `transfer_student` 函数已更新，同步写入 `student_classes` 表
- [ ] `create_teacher` 函数确保 users/teachers 原子创建
- [ ] `delete_teacher` 函数级联清理关联数据
- [ ] `increment_feedback_version` 函数可用

### 1.9 统计查询数据库化
- [ ] 标签使用统计改为 SQL 聚合查询 `feedback_items`
- [ ] 年级分布改为 `GROUP BY grade` 查询
- [ ] 反馈趋势改为 `date_trunc('day', created_at)` + `GROUP BY`
- [ ] 能力评分趋势改为查询 `feedback_ability_scores` 表
- [ ] `/api/stats` 路由已更新使用新聚合查询

### 1.10 数据迁移与兼容
- [ ] `scripts/migrate-v1-to-v2.sql` 总迁移脚本已创建
- [ ] feedbacks JSONB 数据已迁移到 `feedback_items`
- [ ] feedbacks ability_scores 已迁移到 `feedback_ability_scores`
- [ ] ai_settings key-value 已迁移到结构化表
- [ ] `student_classes` 数据完整性已验证
- [ ] 回滚脚本 `scripts/rollback-v2-to-v1.sql` 已创建
- [ ] `/api/feedbacks` POST 已适配写入新表
- [ ] `/api/feedbacks` GET 已适配 JOIN 查询
- [ ] `/api/feedbacks/[id]` 已适配新表
- [ ] `/api/stats` 已使用 SQL 聚合
- [ ] `/api/students` 已移除 `class_id` 回退逻辑
- [ ] `/api/home-data` 已移除 `class_id` 回退逻辑
- [ ] `/api/data/export` 已导出新表数据
- [ ] `/api/data/import` 和 `/api/data/full-import` 已适配新表

## Phase 2: 安全加固

- [ ] `/api/data/import` 中 `DEFAULT_ADMIN_TEACHERS` 硬编码已移除
- [ ] `/api/data/full-import` 中 `DEFAULT_ADMIN_TEACHERS` 硬编码已移除
- [ ] 教务老师改为环境变量或安装引导配置
- [ ] `/api/data/export` 使用流式输出，内存占用稳定
- [ ] `/api/data/import` 使用数据库事务，失败回滚
- [ ] `/api/data/full-import` 使用数据库事务，失败回滚
- [ ] `/api/students/batch` 有 Zod 输入校验
- [ ] `/api/data/import` 有导入数据结构校验
- [ ] `/api/data/full-import` 有导入数据结构校验
- [ ] `/api/batch-import/classes` 有 Zod 校验
- [ ] `/api/batch-import/update-admin-teacher` 有 Zod 校验
- [ ] `/api/init-data` 有 Zod 校验
- [ ] `/api/parse` 有 Zod 校验
- [ ] 所有 `console.log` 不输出敏感信息
- [ ] 生产环境错误响应不泄露内部信息
- [ ] API key、密码等字段在日志中脱敏
- [ ] 环境变量统一使用 `NEXT_PUBLIC_SUPABASE_URL` 命名
- [ ] `supabase-client.ts` 中 `COZE_` 前缀回退逻辑已移除
- [ ] `.env.example` 文档已更新

## Phase 3: API 层优化

- [ ] `src/lib/db/index.ts` 统一导出已创建
- [ ] `src/lib/db/students.ts` 学生查询封装已创建
- [ ] `src/lib/db/teachers.ts` 教师查询封装已创建
- [ ] `src/lib/db/classes.ts` 班级查询封装已创建
- [ ] `src/lib/db/feedbacks.ts` 反馈查询封装已创建
- [ ] `src/lib/db/tags.ts` 标签查询封装已创建
- [ ] `src/lib/db/course-stages.ts` 课程阶段查询封装已创建
- [ ] `src/lib/db/stats.ts` 统计查询封装已创建
- [ ] `drizzle.config.ts` 已配置
- [ ] `src/lib/db/drizzle-client.ts` Drizzle 客户端已创建
- [ ] 数据访问层已逐步用 Drizzle 替代 Supabase Client
- [ ] Drizzle relational queries 已用于简化关联查询
- [ ] 缓存方案已确定（Redis 或数据库缓存表）
- [ ] `src/lib/cache.ts` 缓存抽象层已创建
- [ ] `/api/stats` 使用新缓存层替代内存 `Map`
- [ ] 标签、课程阶段等配置数据已添加缓存
- [ ] 所有列表 API 支持分页参数
- [ ] 错误响应格式统一为 `{ error, code?, details? }`
- [ ] 全局错误处理中间件已添加

## Phase 4: 前端架构优化

- [ ] `src/app/feedback/new/page.tsx` 已拆分为多个组件（每个 < 300 行）
- [ ] `src/app/settings/page.tsx` 已拆分为多个组件（每个 < 300 行）
- [ ] `src/app/student/[id]/page.tsx` 已拆分为多个组件
- [ ] `swr` 依赖已安装
- [ ] `src/lib/swr-config.ts` 全局配置已创建
- [ ] `useHomeData` 已改造使用 SWR
- [ ] `useFeedbackData` 已改造使用 SWR
- [ ] `useSettingsData` 已改造使用 SWR
- [ ] 乐观更新已支持
- [ ] 首页 `page.tsx` 已改为服务端组件 + 客户端子组件
- [ ] `loading.tsx` 和 `error.tsx` 已添加
- [ ] `dynamic()` 导入策略已优化
- [ ] Middleware 与 RouteGuard 职责已明确分离
- [ ] RouteGuard 中重复权限判断已移除
- [ ] RSC 导航处理逻辑已优化

## Phase 5: 性能优化

- [ ] `/api/students` 已使用批量查询替代逐条关联
- [ ] `/api/home-data` 已使用 JOIN 或批量查询优化
- [ ] `/api/classes` 已使用 JOIN 查询教师信息
- [ ] S3 预签名 URL 已启用
- [ ] `src/lib/s3-presign.ts` 预签名工具已创建
- [ ] 前端直接上传到 S3
- [ ] 图片缩略图生成已添加
- [ ] 构建产物大小已分析
- [ ] 第三方依赖按需加载已优化
- [ ] `experimental.optimizePackageImports` 已配置
- [ ] Nginx 为 `/api/generate` 配置 `proxy_read_timeout 300s`
- [ ] Nginx 为 `/api/generate/review` 配置 `proxy_buffering off`
- [ ] Nginx gzip 压缩已配置
- [ ] Nginx 静态资源缓存头已配置

## Phase 6: 可维护性提升

- [ ] ESLint 规则已强化（`no-console`、`no-explicit-any` 等）
- [ ] `eslint-plugin-import` 已添加检查导入顺序
- [ ] Prettier 已配置统一格式化
- [ ] `lint-staged` + `husky` pre-commit 钩子已配置
- [ ] Vitest 测试框架已配置
- [ ] 认证流程测试已编写
- [ ] 数据访问层测试已编写
- [ ] 关键 API 路由集成测试已编写
- [ ] 所有 API 路由有 JSDoc 注释
- [ ] OpenAPI/Swagger 文档已生成
- [ ] 文档页面已挂载（仅开发环境）
- [ ] API 响应时间监控已添加
- [ ] 数据库查询慢日志已添加
- [ ] 错误率告警已添加
- [ ] 健康检查端点已增强
