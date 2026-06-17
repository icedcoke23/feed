# AI 功能深度优化 Spec

## Why
AI 功能存在多个严重问题：复检时扣子AI缺少 system Prompt 导致输出不可控、自定义标签分类丢失、SSE 流式传输存在跨包拆分 bug、API 密钥可能被掩码值覆盖、Prompt 注入风险等。同时领域化 Prompt 需要结合少儿乐高/机器人/编程教育特点进一步深化。

## What Changes
- 修复 P0 致命 bug：复检缺 system Prompt、自定义标签分类丢失、PUT schema 字段名不一致、重置 Prompt 逻辑错误
- 抽取公共 AI 模块：`getAISettings()`、`streamThirdPartyAI()` 统一到 `src/lib/ai-client.ts`
- 修复 SSE 跨包拆分 bug：前后端均实现 buffer 机制
- 添加 AI 调用超时控制
- 修复 API 密钥掩码值覆盖问题
- 领域 Prompt 补充【总结】部分 + 优化匹配逻辑
- 领域 Prompt 与自定义 Prompt 合并策略（补充而非覆盖）
- AI 流式对话框添加 Markdown 渲染和取消按钮
- 添加输入校验防止 Prompt 注入
- **BREAKING**: `ai-settings` PUT 接口字段名统一

## Impact
- Affected specs: AI 生成、AI 复检、AI 解析、AI 设置
- Affected code: generate/route.ts, review/route.ts, parse/route.ts, ai-settings/route.ts, ai.ts, use-sse-stream.ts, use-report-generation.ts, ai-stream-dialog.tsx

## ADDED Requirements

### Requirement: AI 公共模块
系统 SHALL 将 `getAISettings()`、`streamThirdPartyAI()` 抽取到 `src/lib/ai-client.ts`，所有 AI 路由统一引用。

#### Scenario: 公共模块抽取
- **WHEN** AI 路由需要获取设置或调用第三方 AI
- **THEN** 从 `@/lib/ai-client` 导入，不再各自定义

### Requirement: SSE 跨包拆分修复
系统 SHALL 在前后端实现 SSE buffer 机制，按 `\n\n` 分割完整事件，避免跨 TCP 包拆分导致内容丢失。

#### Scenario: 跨包数据正确解析
- **WHEN** AI 返回的 SSE 事件被 TCP 拆分到多个 chunk
- **THEN** 前端 buffer 机制正确拼接并解析完整事件

### Requirement: AI 调用超时控制
系统 SHALL 为所有 AI 调用添加超时控制（流式 120s、非流式 30s），超时后返回错误信息。

### Requirement: 输入校验防 Prompt 注入
系统 SHALL 为 `/api/generate`、`/api/generate/review`、`/api/parse` 添加 Zod 输入校验，对用户输入进行转义。

### Requirement: AI 流式对话框增强
系统 SHALL 在 AI 流式对话框中添加 Markdown 渲染和取消按钮。

## MODIFIED Requirements

### Requirement: 复检功能
复检时扣子AI SHALL 传入 system Prompt（复检专家角色设定），确保输出质量可控。

### Requirement: 自定义标签分类
自定义标签 SHALL 保留用户选择的实际分类（strength/improvement/weakness），不再硬编码为 strength。

### Requirement: 领域 Prompt
领域 Prompt SHALL 包含【总结】部分（与默认 Prompt 的5段结构一致），且当用户自定义 Prompt 时，领域 Prompt 作为补充而非完全覆盖。

### Requirement: AI 设置 PUT 接口
PUT 接口 SHALL 检测掩码值并跳过更新，字段名与前端保持一致。

### Requirement: 重置 Prompt
重置 Prompt SHALL 调用 `getDefaultPrompt()` 而非从 API 获取当前值。
