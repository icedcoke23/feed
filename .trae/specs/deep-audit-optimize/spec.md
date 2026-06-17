# 深度审计与优化 Spec

## Why
项目经过一轮大规模重构后，仍存在 7 个致命安全问题（JWT Secret 硬编码回退、密码未哈希存储、API 缺角色权限校验等）、18 个严重问题（输入校验缺失、错误处理不统一、N+1 查询等）和 20 个优化项，需要系统性修复。

## What Changes
- 修复 JWT Secret 硬编码回退值，生产环境强制检查
- 修复创建/更新用户时密码未哈希存储
- 移除源码中硬编码的明文密码和手机号
- 扩展 Middleware 保护前端路由 + 增加角色权限校验
- 为 PUT 路由补充 Zod 输入校验
- 统一 API 错误响应格式
- 补充数据库索引
- 优化 stats 接口查询性能
- 修复 page.tsx 缺少 useRouter 导入
- 补充 docker-compose.yml 关键环境变量

## Impact
- Affected specs: 安全认证、API 校验、数据库层、部署配置
- Affected code: src/lib/auth.ts, src/middleware.ts, src/app/api/ 下多个路由, src/storage/database/shared/schema.ts, docker-compose.yml

## ADDED Requirements

### Requirement: JWT Secret 生产环境强制检查
系统 SHALL 在生产环境启动时检查 JWT_SECRET 环境变量是否已设置，未设置时 SHALL 拒绝启动并输出明确错误信息。

#### Scenario: 生产环境未设置 JWT_SECRET
- **WHEN** NODE_ENV=production 且 JWT_SECRET 未设置
- **THEN** 应用启动失败，输出 "FATAL: JWT_SECRET must be set in production"

### Requirement: 密码哈希存储
系统 SHALL 在创建和更新用户密码时使用 bcrypt 哈希存储，SHALL NOT 存储明文密码。

#### Scenario: 创建教师用户
- **WHEN** 管理员创建教师用户并设置密码
- **THEN** 密码在存入数据库前 SHALL 被 bcrypt 哈希处理

### Requirement: API 角色权限校验
系统 SHALL 对危险 API 操作（数据清空、重置管理员、用户管理等）限制为仅管理员可访问。

#### Scenario: 教师尝试调用数据清空接口
- **WHEN** 角色为 teacher 的用户调用 /api/data/clear
- **THEN** 返回 403 Forbidden

### Requirement: PUT 路由输入校验
系统 SHALL 对所有 PUT 路由的请求体使用 Zod schema 进行校验。

#### Scenario: 更新学员信息时提交非法数据
- **WHEN** PUT /api/students/[id] 请求体包含非法字段
- **THEN** 返回 400 和具体校验错误信息

### Requirement: 统一错误响应格式
系统 SHALL 对所有 API 错误返回统一格式 `{ error: string }`，SHALL NOT 在生产环境暴露内部错误详情。

#### Scenario: 数据库查询失败
- **WHEN** API 路由中数据库操作失败
- **THEN** 返回 500 和通用错误消息，不暴露 Supabase 错误详情

### Requirement: 数据库索引补充
系统 SHALL 为 students 表的 class_id 和 admin_teacher_id 字段添加数据库索引。

#### Scenario: 按班级查询学生
- **WHEN** 使用 class_id 字段查询学生列表
- **THEN** 查询 SHALL 使用索引提高性能

## MODIFIED Requirements

### Requirement: Middleware 保护范围
Middleware SHALL 保护所有 /api/* 路由（除登录/登出）和前端受保护路由，SHALL 根据 x-user-role 限制危险操作。

### Requirement: 硬编码密码移除
源码中 SHALL NOT 包含任何明文密码或真实手机号。默认教师数据 SHALL 通过环境变量或首次启动引导配置。

## REMOVED Requirements

### Requirement: 明文密码兼容
**Reason**: 安全风险过高，不再支持明文密码比对
**Migration**: 现有明文密码需通过迁移脚本转为 bcrypt 哈希，无法自动迁移的账户需重置密码
