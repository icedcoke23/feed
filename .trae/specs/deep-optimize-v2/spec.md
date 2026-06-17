# 深度优化与功能完善 Spec

## Why
项目存在多个严重安全漏洞（管理员 API 缺少角色校验、SSRF 防护不完整）、核心功能缺失（密码修改、反馈编辑、草稿保存）、性能瓶颈（N+1 查询、无缓存、图片未压缩）和代码质量问题（重复逻辑、类型不一致、无测试），需要系统性修复和完善。

## What Changes
- 修复 5 个 P0 安全漏洞：管理员 API 角色校验、SSRF 异步检查、数据清空逻辑统一
- 实现 8 个 P1 功能缺失：密码修改、反馈编辑、草稿保存、图片压缩、AI 进度指示、统计权限隔离、反馈详情权限隔离、JWT 刷新
- 优化 6 个 P1 性能/代码问题：首页聚合 API、统计查询优化、API 错误格式统一、AI 报告格式兼容提取、类型定义统一、请求日志
- **BREAKING**: 统一 API 错误响应格式（前端需适配）

## Impact
- Affected specs: 安全、性能、用户体验、数据管理
- Affected code: API 路由（20+ 文件）、前端页面（10+ 文件）、类型定义、工具函数

## ADDED Requirements

### Requirement: 管理员 API 角色校验
系统 SHALL 在所有管理员专属 API 路由内部验证用户角色为 admin，不依赖 middleware 作为唯一防线。

#### Scenario: 非管理员访问管理员 API
- **WHEN** 教师角色用户访问 `/api/data/clear`、`/api/users`、`/api/ai-settings`
- **THEN** 返回 403 Forbidden

### Requirement: 密码修改功能
系统 SHALL 提供密码修改功能，用户可以修改自己的密码，管理员可以重置任何用户的密码。

#### Scenario: 用户修改自己的密码
- **WHEN** 用户在设置页面输入旧密码和新密码并提交
- **THEN** 验证旧密码正确后更新为新密码

#### Scenario: 管理员重置用户密码
- **WHEN** 管理员在用户管理页面点击"重置密码"
- **THEN** 将该用户密码重置为指定密码

### Requirement: 反馈编辑功能
系统 SHALL 支持对已保存的反馈进行编辑，复用创建反馈的步骤流程。

#### Scenario: 编辑已保存的反馈
- **WHEN** 用户在反馈详情页点击"编辑"按钮
- **THEN** 跳转到创建反馈流程，预填已有数据，允许修改后重新保存

### Requirement: 反馈创建草稿保存
系统 SHALL 在反馈创建流程中自动保存草稿到 sessionStorage，支持断点续填。

#### Scenario: 中途刷新页面
- **WHEN** 用户在创建反馈的第 2 步刷新页面
- **THEN** 重新进入时自动恢复到第 2 步，已填数据保留

### Requirement: 图片上传压缩
系统 SHALL 在上传学员照片前自动压缩图片，最大宽度 1200px，JPEG 质量 0.8。

#### Scenario: 上传大图片
- **WHEN** 用户上传 4000x3000 的照片
- **THEN** 自动压缩为 1200x900 后上传，文件大小减少 80%+

### Requirement: AI 生成进度指示
系统 SHALL 在 AI 生成报告时显示连接状态和进度指示。

#### Scenario: AI 连接等待中
- **WHEN** AI 服务连接建立中（超过 2 秒）
- **THEN** 显示"正在连接 AI 服务..."，禁用提交按钮

### Requirement: 统计 API 教师权限隔离
系统 SHALL 对教师角色过滤只统计其班级学生的数据。

#### Scenario: 教师查看统计
- **WHEN** 教师角色访问 `/api/stats`
- **THEN** 只返回其负责班级的统计数据

### Requirement: 反馈详情页教师权限隔离
系统 SHALL 在反馈详情 API 中检查教师是否有权查看该反馈。

#### Scenario: 教师查看其他班级反馈
- **WHEN** 教师访问不属于自己班级学生的反馈
- **THEN** 返回 403 Forbidden

### Requirement: JWT Token 自动刷新
系统 SHALL 在 JWT Token 过半有效期时自动续签，避免用户操作中突然登出。

#### Scenario: Token 即将过期
- **WHEN** 用户请求 API 时 Token 有效期剩余不足 50%
- **THEN** 在响应中附带新 Token，前端自动更新

### Requirement: 首页聚合 API
系统 SHALL 提供聚合 API `/api/home-data` 一次返回首页所需的所有数据。

#### Scenario: 首页加载
- **WHEN** 用户访问首页
- **THEN** 通过单一 API 请求获取学生、班级、教师和统计数据

### Requirement: 统一 API 错误响应格式
系统 SHALL 所有 API 路由使用统一的错误响应格式 `{ error: string, code?: string }`。

#### Scenario: API 返回错误
- **WHEN** 任何 API 请求失败
- **THEN** 返回 `{ error: "错误描述", code: "ERROR_CODE" }` 格式的 JSON

## MODIFIED Requirements

### Requirement: SSRF 防护
AI 设置保存时 SHALL 使用异步 `isSafeUrlAsync()` 替代同步 `isSafeUrl()`，防止 DNS 重绑定攻击。

### Requirement: 数据清空逻辑
数据清空逻辑 SHALL 提取为共享的 `clearAllData()` 函数，`/api/data/clear` 和 `/api/data/import` 统一使用。

### Requirement: AI 报告格式兼容
AI 报告旧格式判断逻辑 SHALL 提取为 `isLegacyAiReport()` 工具函数，消除 3 处重复代码。

## REMOVED Requirements

### Requirement: URL 参数传递报告数据
**Reason**: URL 参数有长度限制，大数据量时会丢失数据
**Migration**: 仅使用 sessionStorage 传递报告数据到 PDF 页面
