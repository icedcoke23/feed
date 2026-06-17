# 全项目深度审计与优化 Spec

## Why
项目存在严重安全漏洞（登录绕过、SSRF、认证头可伪造）、关键功能缺陷（ErrorBoundary 未使用、路由守卫不匹配、内存泄漏）和大量代码质量问题，需要系统性修复。

## What Changes
- 修复登录路由密码绕过漏洞和 hashPassword 未导入
- API 路由中从 JWT cookie 直接验证身份，不信任请求头
- AI 路由添加 base_url SSRF 防护
- 数据导入路由添加字段白名单
- 全局包裹 ErrorBoundary 防止白屏
- 修复路由守卫配置与实际路由匹配
- 修复 PDF 页面裁剪事件监听器内存泄漏
- 补全缺失的输入校验（Zod schema）
- 修复 students/feedbacks 路由使用 validatedData 替代 body
- Middleware 补全 ADMIN_ONLY 路由
- Dashboard 内嵌组件提取到外部
- 清理硬编码凭据
- 补充分页查询

## Impact
- Affected code: 几乎所有 API 路由、middleware、前端页面、hooks

## ADDED Requirements

### Requirement: 登录路由安全
系统 SHALL 在登录时正确验证密码，不允许绕过。

#### Scenario: 非标准 cost factor 的 bcrypt 哈希
- **WHEN** 数据库中存储的密码哈希 cost factor 不是 10
- **AND** 用户输入了错误密码
- **THEN** 登录应失败，不应自动信任用户输入

### Requirement: API 路由认证安全
系统 SHALL 在每个需要认证的 API 路由中从 JWT cookie 直接验证用户身份，而非信任可伪造的请求头。

#### Scenario: 攻击者伪造 x-user-id 请求头
- **WHEN** 攻击者发送带有伪造 x-user-id 的请求
- **THEN** 路由应从 JWT cookie 验证身份，忽略伪造的请求头

### Requirement: SSRF 防护
系统 SHALL 校验 AI 配置中的 base_url，禁止内网和本地地址。

#### Scenario: 攻击者设置内网 base_url
- **WHEN** 管理员设置 base_url 为 http://169.254.169.254 或 http://localhost:xxxx
- **THEN** 系统应拒绝保存或使用该 URL

### Requirement: 全局错误边界
系统 SHALL 在 layout.tsx 中包裹 ErrorBoundary，防止未捕获异常导致白屏。

#### Scenario: 组件抛出未捕获异常
- **WHEN** 任何页面组件抛出运行时错误
- **THEN** 用户应看到友好的错误提示页面，而非白屏

### Requirement: 路由守卫一致性
系统 SHALL 确保前端路由守卫配置与实际路由路径一致。

#### Scenario: 教师访问 /settings
- **WHEN** 教师角色用户访问 /settings
- **THEN** 应允许访问教师可用的设置 Tab（标签管理、课程阶段等），而非完全阻止

### Requirement: PDF 页面内存泄漏修复
系统 SHALL 在组件卸载时清理所有全局事件监听器和定时器。

### Requirement: 输入校验完整性
系统 SHALL 对所有 POST/PUT 路由使用 Zod schema 校验，且使用 validatedData 而非原始 body 构建数据库操作。

### Requirement: 管理员路由保护完整
系统 SHALL 将所有敏感管理操作路由纳入 ADMIN_ONLY 保护。

## MODIFIED Requirements

### Requirement: 登录路由密码验证
移除 cost factor 检查逻辑和自动重哈希逻辑，仅使用 bcrypt compare 验证密码。如果验证失败则登录失败，不信任用户输入。

### Requirement: API 路由身份获取方式
从 `request.headers.get("x-user-id")` 改为 `verifyToken(request.cookies.get(COOKIE_NAME)?.value)` 直接从 JWT 验证身份。

## REMOVED Requirements

### Requirement: 密码 cost factor 兼容逻辑
**Reason**: 该逻辑存在安全漏洞（密码验证失败时直接信任用户输入），且实际场景中所有密码均使用 bcryptjs 哈希（cost=10），无需兼容。
**Migration**: 移除 cost factor 检查，统一使用 bcrypt compare。
