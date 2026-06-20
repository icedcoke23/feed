# Tasks

## Phase 1: 数据库深度优化（最高优先级）

### 1.1 Schema 与约束

- [ ] Task 1: 添加外键约束
  - [ ] SubTask 1.1: 创建迁移脚本 `scripts/migrate-add-foreign-keys.sql`
  - [ ] SubTask 1.2: `classes.teacher_id` → `teachers.id` ON DELETE SET NULL
  - [ ] SubTask 1.3: `students.admin_teacher_id` → `teachers.id` ON DELETE SET NULL
  - [ ] SubTask 1.4: `students.current_teacher_id` → `teachers.id` ON DELETE SET NULL
  - [ ] SubTask 1.5: `feedbacks.student_id` → `students.id` ON DELETE CASCADE
  - [ ] SubTask 1.6: `feedbacks.teacher_id` → `teachers.id` ON DELETE RESTRICT
  - [ ] SubTask 1.7: `feedbacks.parent_feedback_id` → `feedbacks.id` ON DELETE SET NULL
  - [ ] SubTask 1.8: `class_transfers.student_id` → `students.id` ON DELETE CASCADE
  - [ ] SubTask 1.9: `class_transfers.from_teacher_id` → `teachers.id` ON DELETE SET NULL
  - [ ] SubTask 1.10: `class_transfers.to_teacher_id` → `teachers.id` ON DELETE RESTRICT
  - [ ] SubTask 1.11: `teachers.id` → `users.id` ON DELETE CASCADE（users/teachers 一对一）
  - [ ] SubTask 1.12: `student_classes.student_id` → `students.id` ON DELETE CASCADE
  - [ ] SubTask 1.13: `student_classes.class_id` → `classes.id` ON DELETE CASCADE
  - [ ] SubTask 1.14: `course_prompts.stage_code` → `course_stages.stage_code` ON DELETE CASCADE

- [ ] Task 2: 创建 feedback_items 表（替代 strengths/improvements/weaknesses JSONB）
  - [ ] SubTask 2.1: 创建迁移脚本 `scripts/migrate-feedback-items.sql`
  - [ ] SubTask 2.2: 创建 `feedback_items` 表（id, feedback_id, tag_id, category, name, description, rating, sort_order, created_at）
  - [ ] SubTask 2.3: 添加 `feedback_items.feedback_id` 外键 ON DELETE CASCADE
  - [ ] SubTask 2.4: 添加 `feedback_items.tag_id` 外键 ON DELETE SET NULL
  - [ ] SubTask 2.5: 添加 CHECK 约束 `category IN ('strength','improvement','weakness')`
  - [ ] SubTask 2.6: 添加 CHECK 约束 `rating BETWEEN 1 AND 5`
  - [ ] SubTask 2.7: 创建索引 `idx_feedback_items_feedback_id`
  - [ ] SubTask 2.8: 创建索引 `idx_feedback_items_tag_id`
  - [ ] SubTask 2.9: 创建索引 `idx_feedback_items_category`
  - [ ] SubTask 2.10: 编写数据迁移脚本，将现有 JSONB 数据迁移到 `feedback_items` 表
  - [ ] SubTask 2.11: 在 Drizzle Schema 中添加 `feedback_items` 表定义

- [ ] Task 3: 创建 feedback_ability_scores 表（替代 ability_scores JSONB）
  - [ ] SubTask 3.1: 创建迁移脚本 `scripts/migrate-ability-scores.sql`
  - [ ] SubTask 3.2: 创建 `feedback_ability_scores` 表（id, feedback_id, ability_name, score, created_at）
  - [ ] SubTask 3.3: 添加外键 `feedback_id` ON DELETE CASCADE
  - [ ] SubTask 3.4: 添加 CHECK 约束 `score BETWEEN 1 AND 5`
  - [ ] SubTask 3.5: 创建唯一索引 `idx_feedback_ability_unique(feedback_id, ability_name)`
  - [ ] SubTask 3.6: 编写数据迁移脚本，将现有 ability_scores JSONB 迁移
  - [ ] SubTask 3.7: 在 Drizzle Schema 中添加 `feedback_ability_scores` 表定义

- [ ] Task 4: 将 student_classes 纳入 Drizzle Schema
  - [ ] SubTask 4.1: 在 `schema.ts` 中添加 `studentClasses` 表定义
  - [ ] SubTask 4.2: 添加 `is_primary` 字段和唯一约束
  - [ ] SubTask 4.3: 在 `relations.ts` 中添加 `studentClasses` 关系定义
  - [ ] SubTask 4.4: 生成 Zod 校验 schema 和 TypeScript 类型

- [ ] Task 5: 重构 ai_settings 为结构化表
  - [ ] SubTask 5.1: 创建迁移脚本 `scripts/migrate-ai-settings.sql`
  - [ ] SubTask 5.2: 创建新 `ai_settings_new` 表（id, api_key, base_url, model_id, max_concurrent, system_prompt, use_custom_ai, updated_at）
  - [ ] SubTask 5.3: 编写数据迁移脚本，将 key-value 数据转换为一行
  - [ ] SubTask 5.4: 重命名旧表为 `ai_settings_old`，新表重命名为 `ai_settings`
  - [ ] SubTask 5.5: 更新 Drizzle Schema 中的 `aiSettings` 表定义
  - [ ] SubTask 5.6: 更新 `src/lib/ai-client.ts` 的 `getAISettings()` 函数

### 1.2 索引优化

- [ ] Task 6: 添加关键复合索引
  - [ ] SubTask 6.1: `feedbacks(student_id, created_at DESC)` — 学员反馈历史
  - [ ] SubTask 6.2: `feedbacks(teacher_id, created_at DESC)` — 教师工作台
  - [ ] SubTask 6.3: `feedbacks(status, created_at DESC)` — 按状态筛选
  - [ ] SubTask 6.4: `students(admin_teacher_id, created_at DESC)` — 教务老师看板
  - [ ] SubTask 6.5: `student_classes(class_id, is_primary)` WHERE `is_primary = true` — 主班级查询
  - [ ] SubTask 6.6: `class_transfers(student_id, transferred_at DESC)` — 转班历史

- [ ] Task 7: 添加部分索引过滤软删除
  - [ ] SubTask 7.1: `students(name) WHERE is_active = true`
  - [ ] SubTask 7.2: `classes(teacher_id) WHERE is_active = true`
  - [ ] SubTask 7.3: `teachers(role) WHERE is_active = true`
  - [ ] SubTask 7.4: `course_stages(theme, level) WHERE is_active = true`

- [ ] Task 8: 添加 JSONB GIN 索引
  - [ ] SubTask 8.1: `feedbacks USING GIN (metadata)`
  - [ ] SubTask 8.2: `feedbacks USING GIN (work_info)`

### 1.3 触发器与函数

- [ ] Task 9: 添加 updated_at 自动触发器
  - [ ] SubTask 9.1: 创建 `update_updated_at_column()` 函数
  - [ ] SubTask 9.2: 为 `teachers` 表添加触发器
  - [ ] SubTask 9.3: 为 `students` 表添加触发器
  - [ ] SubTask 9.4: 为 `classes` 表添加触发器
  - [ ] SubTask 9.5: 为 `feedbacks` 表添加触发器
  - [ ] SubTask 9.6: 为 `course_stages` 表添加触发器
  - [ ] SubTask 9.7: 为 `course_prompts` 表添加触发器
  - [ ] SubTask 9.8: 为 `ai_settings` 表添加触发器

- [ ] Task 10: 更新现有 RPC 函数
  - [ ] SubTask 10.1: 更新 `transfer_student` 函数，同步写入 `student_classes` 表
  - [ ] SubTask 10.2: 更新 `create_teacher` 函数，确保 users/teachers 原子创建
  - [ ] SubTask 10.3: 更新 `delete_teacher` 函数，级联清理关联数据
  - [ ] SubTask 10.4: 新增 `increment_feedback_version` 函数（已在 enable-rls.sql 中，验证可用）

### 1.4 统计查询数据库化

- [ ] Task 11: 用 SQL 聚合替代应用层统计
  - [ ] SubTask 11.1: 标签使用统计改为 `GROUP BY` + `COUNT(*) FILTER` 查询 `feedback_items`
  - [ ] SubTask 11.2: 年级分布改为 `GROUP BY grade` 查询
  - [ ] SubTask 11.3: 反馈趋势改为 `date_trunc('day', created_at)` + `GROUP BY`
  - [ ] SubTask 11.4: 能力评分趋势改为查询 `feedback_ability_scores` 表
  - [ ] SubTask 11.5: 更新 `/api/stats` 路由使用新的聚合查询

### 1.5 数据迁移与兼容

- [ ] Task 12: 编写数据迁移脚本
  - [ ] SubTask 12.1: 创建 `scripts/migrate-v1-to-v2.sql` 总迁移脚本
  - [ ] SubTask 12.2: 迁移 feedbacks.strengths/improvements/weaknesses → feedback_items
  - [ ] SubTask 12.3: 迁移 feedbacks.ability_scores → feedback_ability_scores
  - [ ] SubTask 12.4: 迁移 ai_settings key-value → 结构化表
  - [ ] SubTask 12.5: 验证 `student_classes` 数据完整性，补齐缺失记录
  - [ ] SubTask 12.6: 创建回滚脚本 `scripts/rollback-v2-to-v1.sql`

- [ ] Task 13: 更新 API 路由适配新 Schema
  - [ ] SubTask 13.1: 更新 `/api/feedbacks` POST，写入 `feedback_items` 和 `feedback_ability_scores`
  - [ ] SubTask 13.2: 更新 `/api/feedbacks` GET，JOIN 查询 `feedback_items`
  - [ ] SubTask 13.3: 更新 `/api/feedbacks/[id]` GET/PUT/DELETE 适配新表
  - [ ] SubTask 13.4: 更新 `/api/stats` 使用 SQL 聚合
  - [ ] SubTask 13.5: 更新 `/api/students` 移除 `class_id` 回退逻辑
  - [ ] SubTask 13.6: 更新 `/api/home-data` 移除 `class_id` 回退逻辑
  - [ ] SubTask 13.7: 更新 `/api/data/export` 导出新表数据
  - [ ] SubTask 13.8: 更新 `/api/data/import` 和 `/api/data/full-import` 导入新表

## Phase 2: 安全加固

- [ ] Task 14: 移除硬编码默认账号
  - [ ] SubTask 14.1: 移除 `/api/data/import` 中 `DEFAULT_ADMIN_TEACHERS` 硬编码
  - [ ] SubTask 14.2: 移除 `/api/data/full-import` 中 `DEFAULT_ADMIN_TEACHERS` 硬编码
  - [ ] SubTask 14.3: 改为环境变量 `DEFAULT_ADMIN_TEACHERS`（JSON 格式）配置
  - [ ] SubTask 14.4: 或改为首次安装引导页面创建教务老师

- [ ] Task 15: 数据导出分块流式
  - [ ] SubTask 15.1: 重构 `/api/data/export` 使用 ReadableStream 流式输出
  - [ ] SubTask 15.2: 分批查询各表数据（每批 500 条）
  - [ ] SubTask 15.3: 流式拼接 JSON 输出

- [ ] Task 16: 数据导入事务保护
  - [ ] SubTask 16.1: 重构 `/api/data/import` 使用数据库事务
  - [ ] SubTask 16.2: 重构 `/api/data/full-import` 使用数据库事务
  - [ ] SubTask 16.3: 失败时整体回滚
  - [ ] SubTask 16.4: 添加导入进度日志

- [ ] Task 17: API 输入校验全覆盖
  - [ ] SubTask 17.1: `/api/students/batch` 添加 Zod 校验
  - [ ] SubTask 17.2: `/api/data/import` 添加导入数据结构校验
  - [ ] SubTask 17.3: `/api/data/full-import` 添加导入数据结构校验
  - [ ] SubTask 17.4: `/api/batch-import/classes` 添加 Zod 校验
  - [ ] SubTask 17.5: `/api/batch-import/update-admin-teacher` 添加 Zod 校验
  - [ ] SubTask 17.6: `/api/init-data` 添加 Zod 校验
  - [ ] SubTask 17.7: `/api/parse` 添加 Zod 校验

- [ ] Task 18: 敏感信息脱敏审计
  - [ ] SubTask 18.1: 审计所有 `console.log` 输出，移除敏感信息
  - [ ] SubTask 18.2: 确保错误响应不泄露内部信息（生产环境）
  - [ ] SubTask 18.3: API key、密码等字段在日志中脱敏

- [ ] Task 19: 环境变量命名统一
  - [ ] SubTask 19.1: 统一使用 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] SubTask 19.2: 移除 `supabase-client.ts` 中 `COZE_` 前缀回退逻辑
  - [ ] SubTask 19.3: 更新 `.env.example` 文档

## Phase 3: API 层优化

- [ ] Task 20: 创建统一数据访问层
  - [ ] SubTask 20.1: 创建 `src/lib/db/index.ts` 统一导出
  - [ ] SubTask 20.2: 创建 `src/lib/db/students.ts` 封装学生查询
  - [ ] SubTask 20.3: 创建 `src/lib/db/teachers.ts` 封装教师查询
  - [ ] SubTask 20.4: 创建 `src/lib/db/classes.ts` 封装班级查询
  - [ ] SubTask 20.5: 创建 `src/lib/db/feedbacks.ts` 封装反馈查询
  - [ ] SubTask 20.6: 创建 `src/lib/db/tags.ts` 封装标签查询
  - [ ] SubTask 20.7: 创建 `src/lib/db/course-stages.ts` 封装课程阶段查询
  - [ ] SubTask 20.8: 创建 `src/lib/db/stats.ts` 封装统计查询

- [ ] Task 21: 逐步迁移到 Drizzle ORM
  - [ ] SubTask 21.1: 配置 Drizzle ORM 连接（`drizzle.config.ts`）
  - [ ] SubTask 21.2: 创建 `src/lib/db/drizzle-client.ts` Drizzle 客户端
  - [ ] SubTask 21.3: 在数据访问层中逐步用 Drizzle 查询替代 Supabase Client
  - [ ] SubTask 21.4: 利用 Drizzle relational queries 简化关联查询

- [ ] Task 22: 引入缓存层
  - [ ] SubTask 22.1: 评估 Redis vs 数据库缓存表方案
  - [ ] SubTask 22.2: 创建 `src/lib/cache.ts` 缓存抽象层
  - [ ] SubTask 22.3: `/api/stats` 使用新缓存层替代内存 `Map`
  - [ ] SubTask 22.4: 为标签、课程阶段等配置数据添加缓存

- [ ] Task 23: 统一分页与错误处理
  - [ ] SubTask 23.1: 确保所有列表 API 支持分页参数
  - [ ] SubTask 23.2: 统一错误响应格式 `{ error, code?, details? }`
  - [ ] SubTask 23.3: 添加全局错误处理中间件

## Phase 4: 前端架构优化

- [ ] Task 24: 拆分超大页面组件
  - [ ] SubTask 24.1: 拆分 `src/app/feedback/new/page.tsx`（2628行）为多个组件
  - [ ] SubTask 24.2: 拆分 `src/app/settings/page.tsx`（2376行）为多个组件
  - [ ] SubTask 24.3: 拆分 `src/app/student/[id]/page.tsx` 为多个组件
  - [ ] SubTask 24.4: 每个组件文件不超过 300 行

- [ ] Task 25: 引入 SWR 数据缓存
  - [ ] SubTask 25.1: 安装 `swr` 依赖
  - [ ] SubTask 25.2: 创建 `src/lib/swr-config.ts` 全局配置
  - [ ] SubTask 25.3: 改造 `useHomeData` 使用 SWR
  - [ ] SubTask 25.4: 改造 `useFeedbackData` 使用 SWR
  - [ ] SubTask 25.5: 改造 `useSettingsData` 使用 SWR
  - [ ] SubTask 25.6: 添加乐观更新支持

- [ ] Task 26: 优化服务端组件使用
  - [ ] SubTask 26.1: 将首页 `page.tsx` 改为服务端组件 + 客户端子组件
  - [ ] SubTask 26.2: 利用 Next.js `loading.tsx` 和 `error.tsx`
  - [ ] SubTask 26.3: 优化 `dynamic()` 导入策略

- [ ] Task 27: 重构 RouteGuard 与 Middleware
  - [ ] SubTask 27.1: 明确 Middleware 负责服务端拦截，RouteGuard 负责客户端 UX
  - [ ] SubTask 27.2: 移除 RouteGuard 中重复的权限判断
  - [ ] SubTask 27.3: 优化 RSC 导航处理逻辑

## Phase 5: 性能优化

- [ ] Task 28: 消除 N+1 查询
  - [ ] SubTask 28.1: `/api/students` 使用批量查询替代逐条关联
  - [ ] SubTask 28.2: `/api/home-data` 使用 JOIN 或批量查询优化
  - [ ] SubTask 28.3: `/api/classes` 使用 JOIN 查询教师信息

- [ ] Task 29: 图片/照片优化
  - [ ] SubTask 29.1: 为学员照片启用 S3 预签名 URL
  - [ ] SubTask 29.2: 创建 `src/lib/s3-presign.ts` 预签名工具
  - [ ] SubTask 29.3: 前端直接上传到 S3，不经过应用服务器
  - [ ] SubTask 29.4: 添加图片缩略图生成

- [ ] Task 30: 构建产物优化
  - [ ] SubTask 30.1: 分析构建产物大小（`@next/bundle-analyzer`）
  - [ ] SubTask 30.2: 优化第三方依赖按需加载
  - [ ] SubTask 30.3: 配置 `next.config.ts` 的 `experimental.optimizePackageImports`

- [ ] Task 31: Nginx 配置优化
  - [ ] SubTask 31.1: 为 `/api/generate` 配置 `proxy_read_timeout 300s`
  - [ ] SubTask 31.2: 为 `/api/generate/review` 配置 `proxy_buffering off`
  - [ ] SubTask 31.3: 配置 gzip 压缩
  - [ ] SubTask 31.4: 配置静态资源缓存头

## Phase 6: 可维护性提升

- [ ] Task 32: 代码规范强化
  - [ ] SubTask 32.1: 强化 ESLint 规则（`no-console`、`no-explicit-any` 等）
  - [ ] SubTask 32.2: 添加 `eslint-plugin-import` 检查导入顺序
  - [ ] SubTask 32.3: 配置 Prettier 统一格式化
  - [ ] SubTask 32.4: 添加 `lint-staged` + `husky` pre-commit 钩子

- [ ] Task 33: 关键路径测试覆盖
  - [ ] SubTask 33.1: 配置 Vitest 测试框架
  - [ ] SubTask 33.2: 为认证流程编写测试
  - [ ] SubTask 33.3: 为数据访问层编写测试
  - [ ] SubTask 33.4: 为关键 API 路由编写集成测试

- [ ] Task 34: API 文档生成
  - [ ] SubTask 34.1: 为所有 API 路由添加 JSDoc 注释
  - [ ] SubTask 34.2: 生成 OpenAPI/Swagger 文档
  - [ ] SubTask 34.3: 挂载文档页面（仅开发环境）

- [ ] Task 35: 监控与告警
  - [ ] SubTask 35.1: 添加 API 响应时间监控
  - [ ] SubTask 35.2: 添加数据库查询慢日志
  - [ ] SubTask 35.3: 添加错误率告警
  - [ ] SubTask 35.4: 添加健康检查端点增强

# Task Dependencies

## 数据库优化内部依赖
- [Task 2, 3] 依赖 [Task 1]（外键约束需先建立）
- [Task 11] 依赖 [Task 2, 3]（统计查询依赖新表）
- [Task 13] 依赖 [Task 2, 3, 5, 12]（API 适配依赖新 Schema 和迁移）
- [Task 12] 依赖 [Task 2, 3, 5]（数据迁移依赖新表创建）

## 跨 Phase 依赖
- [Task 20] 依赖 [Task 13]（数据访问层依赖新 Schema）
- [Task 22] 依赖 [Task 20]（缓存层依赖数据访问层）
- [Task 28] 依赖 [Task 20]（N+1 消除依赖数据访问层）
- [Task 25] 依赖 [Task 13]（SWR 依赖新 API 响应格式）

## 可并行任务
- [Task 1-10] 数据库 Schema 与索引可并行设计
- [Task 14-19] 安全加固可并行执行
- [Task 24-27] 前端优化可并行执行
- [Task 32-35] 可维护性提升可并行执行

## 建议执行顺序
1. Phase 1（Task 1-13）— 数据库优化，最高优先级
2. Phase 2（Task 14-19）— 安全加固
3. Phase 3（Task 20-23）— API 层优化
4. Phase 4（Task 24-27）— 前端架构
5. Phase 5（Task 28-31）— 性能优化
6. Phase 6（Task 32-35）— 可维护性
