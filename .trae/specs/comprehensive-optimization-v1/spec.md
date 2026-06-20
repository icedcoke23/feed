# 全面开放优化计划 Spec

## Why
基于对教学反馈系统的深度分析，项目在数据库设计、安全、API、前端架构、性能、可维护性等多个维度存在系统性技术债。数据库设计是最大的技术债：JSONB 过度使用导致统计查询被迫在应用层遍历、关系冗余存储导致一致性难以维护、缺少外键约束使数据完整性依赖代码自觉、索引设计偏保守无法支撑数据量增长。本计划以数据库优化为优先，系统性解决全项目的技术债，提升系统的稳定性、性能和可维护性。

## What Changes

### 数据库优化（Phase 1，最高优先级）
- 添加外键约束，保证引用完整性
- 抽离 feedbacks 表的 JSONB 标签数据到独立表 `feedback_items`
- 规范化能力评分为独立表 `feedback_ability_scores`
- 简化学生班级关系，以 `student_classes` 为唯一事实来源
- 添加关键复合索引和部分索引
- 对保留的 JSONB 字段添加 GIN 索引
- 重构 `ai_settings` 为结构化表
- 添加 `updated_at` 自动更新触发器
- 用数据库聚合替代应用层统计
- 合并/重构 users 与 teachers 表关系
- 将 `student_classes` 纳入 Drizzle Schema 管理

### 安全加固（Phase 2）
- 移除硬编码默认教务老师账号逻辑
- 数据导出分块流式输出
- 数据导入事务保护
- API 输入校验全覆盖
- 敏感信息脱敏审计
- 环境变量命名统一

### API 层优化（Phase 3）
- 创建统一数据访问层
- 逐步迁移 Supabase Client 到 Drizzle ORM
- 引入 Redis 或数据库缓存表替代内存缓存
- 统一分页参数
- 完善错误处理与响应格式

### 前端架构优化（Phase 4）
- 拆分超大页面组件（feedback/new、settings）
- 引入 SWR 做数据缓存
- 优化服务端组件使用
- 重构 RouteGuard 与 Middleware 职责

### 性能优化（Phase 5）
- 数据库查询优化（N+1 消除）
- 图片/照片 CDN 与预签名 URL
- 构建产物优化
- Nginx SSE 超时配置

### 可维护性提升（Phase 6）
- 代码规范与 ESLint 规则强化
- 关键路径测试覆盖
- API 文档生成
- 监控与告警

## Impact
- Affected specs: 数据库、安全、API、前端、性能、可维护性
- Affected code: 数据库 Schema（全表）、API 路由（40+ 文件）、前端页面（10+ 文件）、工具函数、部署配置
- **BREAKING**: feedbacks 表结构变更（JSONB 标签迁移到独立表）、ai_settings 表结构变更、students 表字段废弃

## ADDED Requirements

### Requirement: 外键约束
系统 SHALL 为所有关联字段添加外键约束，保证引用完整性。

#### Scenario: 删除有反馈的学员
- **WHEN** 管理员删除一个学员
- **THEN** 该学员的所有反馈记录和转班记录被级联删除

#### Scenario: 删除有反馈的教师
- **WHEN** 管理员尝试删除一个有反馈记录的教师
- **THEN** 操作被拒绝，返回错误提示

### Requirement: 反馈标签数据表化
系统 SHALL 将 feedbacks 表中的 strengths/improvements/weaknesses JSONB 数据迁移到独立的 `feedback_items` 表。

#### Scenario: 统计标签使用
- **WHEN** 统计 API 查询标签使用情况
- **THEN** 通过 SQL 聚合查询直接获取结果，无需应用层遍历 JSONB

#### Scenario: 创建反馈
- **WHEN** 用户创建包含标签评分的反馈
- **THEN** 标签数据写入 `feedback_items` 表，关联 `tags` 表保证引用完整性

### Requirement: 能力评分规范化
系统 SHALL 将 feedbacks 表的 ability_scores JSONB 迁移到独立的 `feedback_ability_scores` 表。

#### Scenario: 查询学员能力趋势
- **WHEN** 查询某学员历次反馈的某项能力评分变化
- **THEN** 通过 SQL 直接查询 `feedback_ability_scores` 表获取结果

### Requirement: 学生班级关系统一
系统 SHALL 以 `student_classes` 关联表作为学生班级关系的唯一事实来源，废弃 `students.class_id` 和 `students.current_class` 冗余字段。

#### Scenario: 查询学生班级
- **WHEN** 查询某学生的班级信息
- **THEN** 通过 `student_classes` 表查询，无需回退到 `students.class_id`

#### Scenario: 主班级唯一性
- **WHEN** 一个学生被标记多个主班级
- **THEN** 数据库约束拒绝该操作

### Requirement: 关键复合索引
系统 SHALL 为高频查询路径添加复合索引。

#### Scenario: 查询学员反馈历史
- **WHEN** 查询某学员的反馈列表按时间倒序
- **THEN** 使用 `(student_id, created_at DESC)` 复合索引加速

#### Scenario: 教师工作台
- **WHEN** 教师查询自己创建的反馈
- **THEN** 使用 `(teacher_id, created_at DESC)` 复合索引加速

### Requirement: 部分索引过滤软删除
系统 SHALL 为软删除字段添加部分索引，仅索引活跃记录。

#### Scenario: 查询活跃学生
- **WHEN** 查询 `is_active = true` 的学生
- **THEN** 使用部分索引加速，跳过已删除记录

### Requirement: JSONB GIN 索引
系统 SHALL 对保留的 JSONB 字段（metadata、work_info）添加 GIN 索引。

#### Scenario: 按 metadata key 查询
- **WHEN** 按 metadata 中的某个 key 查询反馈
- **THEN** 使用 GIN 索引加速

### Requirement: ai_settings 结构化
系统 SHALL 将 ai_settings 从 key-value 模式重构为结构化表。

#### Scenario: 读取 AI 配置
- **WHEN** 读取 AI 配置
- **THEN** 通过单行查询获取所有配置字段，类型安全

### Requirement: updated_at 自动触发
系统 SHALL 通过触发器自动更新所有表的 `updated_at` 字段。

#### Scenario: 更新教师信息
- **WHEN** 更新教师记录
- **THEN** `updated_at` 字段自动更新为当前时间

### Requirement: 数据库聚合统计
系统 SHALL 使用 SQL 聚合查询替代应用层遍历 JSONB 的统计逻辑。

#### Scenario: 标签使用统计
- **WHEN** 统计 API 查询标签使用排名
- **THEN** 通过 `GROUP BY` + `COUNT(*) FILTER` 在数据库完成聚合

### Requirement: users/teachers 关系明确
系统 SHALL 通过外键约束明确 users 与 teachers 表的一对一关系。

#### Scenario: 删除用户
- **WHEN** 删除 users 表记录
- **THEN** 关联的 teachers 表记录被级联删除

### Requirement: student_classes 纳入 Schema
系统 SHALL 将 `student_classes` 表纳入 Drizzle Schema 管理，与 TypeScript 类型保持同步。

#### Scenario: 类型安全查询
- **WHEN** 在 API 路由中查询学生班级关系
- **THEN** 使用 Drizzle ORM 类型安全查询，无需手写 SQL

### Requirement: 移除硬编码默认账号
系统 SHALL 移除数据导入逻辑中硬编码的默认教务老师账号，改为环境变量配置或首次安装引导。

#### Scenario: 首次部署
- **WHEN** 管理员首次部署系统
- **THEN** 通过环境变量 `DEFAULT_ADMIN_TEACHERS` 配置教务老师，或通过安装引导页面创建

### Requirement: 数据导出分块流式
系统 SHALL 将数据导出改为分块流式输出，避免一次性加载全表到内存。

#### Scenario: 导出大数据量
- **WHEN** 导出包含 10000+ 条反馈的数据
- **THEN** 以流式 JSON 输出，内存占用稳定

### Requirement: 数据导入事务保护
系统 SHALL 将数据导入逻辑包装在数据库事务中，失败时整体回滚。

#### Scenario: 导入中途失败
- **WHEN** 导入过程中某条记录失败
- **THEN** 整个导入事务回滚，数据库状态恢复到导入前

### Requirement: API 输入校验全覆盖
系统 SHALL 为所有 POST/PUT API 路由添加 Zod 输入校验。

#### Scenario: 非法输入
- **WHEN** API 收到不符合 schema 的请求体
- **THEN** 返回 400 错误和具体字段错误信息

### Requirement: 统一数据访问层
系统 SHALL 创建统一的数据访问层，封装所有数据库操作。

#### Scenario: 查询学生
- **WHEN** API 路由需要查询学生
- **THEN** 调用 `src/lib/db/students.ts` 中的封装函数，不直接操作 Supabase Client

### Requirement: 拆分超大页面组件
系统 SHALL 将超过 500 行的页面组件拆分为多个业务组件和自定义 Hook。

#### Scenario: 反馈创建页面
- **WHEN** 开发者维护反馈创建流程
- **THEN** 每个组件文件不超过 300 行，职责单一

### Requirement: 引入 SWR 数据缓存
系统 SHALL 使用 SWR 管理前端数据获取与缓存。

#### Scenario: 页面切换返回
- **WHEN** 用户从详情页返回列表页
- **THEN** 列表数据从 SWR 缓存秒级显示，后台静默刷新

### Requirement: N+1 查询消除
系统 SHALL 消除 API 中的 N+1 查询模式。

#### Scenario: 学生列表带班级信息
- **WHEN** 查询学生列表并附加班级信息
- **THEN** 通过单次 JOIN 或批量查询完成，不逐条查询

### Requirement: 图片 CDN 与预签名 URL
系统 SHALL 为学员照片启用 CDN 或对象存储预签名 URL。

#### Scenario: 访问照片
- **WHEN** 前端展示学员照片
- **THEN** 通过预签名 URL 直接访问 S3，不经过应用服务器

### Requirement: Nginx SSE 超时配置
系统 SHALL 为 AI 生成接口配置足够的 Nginx 超时时间。

#### Scenario: AI 生成耗时较长
- **WHEN** AI 生成报告耗时超过 60 秒
- **THEN** Nginx 不中断连接，SSE 正常完成

## MODIFIED Requirements

### Requirement: Supabase Client 使用
所有 API 路由 SHALL 通过统一数据访问层访问数据库，不直接调用 `getServerSupabaseClient()`。

### Requirement: 统计 API 缓存
统计 API SHALL 使用 Redis 或数据库缓存表替代内存 `Map` 缓存，支持多实例部署。

### Requirement: 环境变量命名
系统 SHALL 统一使用 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 命名，移除 `COZE_` 前缀的回退逻辑。

## REMOVED Requirements

### Requirement: students.class_id 和 students.current_class 冗余字段
**Reason**: 与 `student_classes` 关联表重复存储，导致数据不一致
**Migration**: 数据迁移到 `student_classes` 后，字段保留但不再读写，后续版本删除

### Requirement: ai_settings key-value 模式
**Reason**: 类型不安全，无法利用数据库约束
**Migration**: 数据迁移到结构化表后，删除旧表
