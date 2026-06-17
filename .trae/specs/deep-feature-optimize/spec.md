# 深度功能优化 Spec

## Why
基于对项目 AI 集成、业务实体关系、系统设置与预设管理的深度分析，发现 AI 接口不一致、转班流程缺陷、数据冗余同步风险、预设数据重复定义等问题，需要系统性修复以提升系统可靠性和可维护性。

## What Changes
- 修复转班流程：更新 current_teacher_id，填写 class_transfers 的 from/to_teacher_id
- 统一 AI 接口：review/parse 支持第三方 AI，提取共享常量和公共 SSE Hook
- 修复 ai_report 字段职责混乱：拆分元数据为独立 JSONB 字段
- 统一预设数据源：课程阶段预设从单一数据源加载
- 补充数据库约束：标签 (category,name) 联合唯一索引
- 修复初始化数据不完整：纳入课程阶段预设
- API 密钥脱敏：GET 接口返回掩码版本
- 提取模型名常量：消除 5 处硬编码

## Impact
- Affected specs: AI 集成、学员管理、转班流程、反馈报告、系统设置
- Affected code: src/app/api/generate/*, src/app/api/parse/*, src/app/api/students/[id]/transfer, src/app/api/feedbacks/*, src/app/api/course-stages/*, src/app/api/ai-settings/*, src/hooks/use-report-generation.ts, src/storage/database/shared/schema.ts

## ADDED Requirements

### Requirement: 转班流程完整性
系统 SHALL 在学员转班时同时更新 current_teacher_id 为目标班级的授课教师，并在 class_transfers 记录中填写 from_teacher_id 和 to_teacher_id。

#### Scenario: 学员转班
- **WHEN** 学员从 A 班转到 B 班
- **THEN** student.current_teacher_id 更新为 B 班的 teacher_id，class_transfers 记录包含 from_teacher_id 和 to_teacher_id

### Requirement: AI 接口统一支持第三方 AI
系统 SHALL 在 generate、review、parse 三个 AI 接口中统一支持扣子 AI 和第三方 AI 两种模式，根据 ai_settings 中的 use_custom_ai 配置自动切换。

#### Scenario: 配置第三方 AI 后使用审阅功能
- **WHEN** 用户配置了第三方 AI 并调用 /api/generate/review
- **THEN** 系统使用第三方 AI 执行审阅，而非扣子 AI

### Requirement: API 密钥脱敏
系统 SHALL 在 GET /api/ai-settings 响应中对 api_key 字段返回掩码版本（仅显示前4位和后4位），完整密钥仅在服务端使用。

#### Scenario: 前端获取 AI 设置
- **WHEN** 前端请求 AI 设置
- **THEN** api_key 返回格式为 "sk-****abcd"，不暴露完整密钥

### Requirement: 标签联合唯一约束
系统 SHALL 对 tags 表添加 (category, name) 联合唯一索引，防止同一分类下创建同名标签。

#### Scenario: 创建重复标签
- **WHEN** 尝试在 strength 分类下创建已存在的"代码能力"标签
- **THEN** 返回 409 冲突错误

### Requirement: 课程阶段预设单一数据源
系统 SHALL 将课程阶段预设数据统一定义在 src/lib/constants/course-stages.ts 中，所有引用处从此文件导入。

#### Scenario: 修改预设数据
- **WHEN** 需要修改课程阶段预设
- **THEN** 只需修改一个文件，所有引用自动同步

## MODIFIED Requirements

### Requirement: 反馈报告元数据存储
反馈报告的元数据（student_name、teacher_name、theme、tag_ratings 等）SHALL 存储在独立的 metadata JSONB 字段中，ai_report 字段仅存储 AI 生成的纯文本报告。

### Requirement: 初始化数据完整性
系统初始化 SHALL 同时创建标签、教学主题和课程阶段预设数据，确保首次使用即可正常操作。

## REMOVED Requirements

### Requirement: 默认 prompt 重复定义
**Reason**: 统一为单一数据源
**Migration**: 所有引用处改为从 src/lib/constants/ 导入
