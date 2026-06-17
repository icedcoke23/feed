# 全面深度审计优化 Spec

## Why
项目经过首轮安全修复后仍存在严重问题：Supabase 无 RLS 保护导致数据全面暴露、教师可越权操作任意数据、反馈创建流程未持久化、SSRF 防护可被绕过、PDF 页面 1550 行不可维护、XSS 漏洞、API 设计不统一等，需要系统性修复和架构优化。

## What Changes
- 为所有 Supabase 表启用 RLS 并配置策略，或改用 service_role key + 服务端专用路由
- 为所有 API 路由添加 `getAuthUser()` 认证检查
- 为教师角色添加资源级权限隔离（仅操作自己班级的数据）
- 增强 SSRF 防护（DNS 解析后二次校验、禁止非标准 IP 表示）
- 修复反馈创建流程：6 步向导完成后保存到数据库
- 修复 AI 流式对话框 XSS 漏洞（使用 DOMPurify 消毒）
- 移除前端残留的 x-user-id/x-user-role 请求头设置
- 移除硬编码默认密码（data-management.tsx 中的 admin/a2485204216.）
- 为登录接口添加速率限制
- 为批量操作添加数组长度限制
- 修复反馈版本号竞态条件（使用原子更新）
- 修复"本月新增"统计逻辑（比较年月而非仅月份）
- 统一 API 响应格式为 `{ data: T, message?: string }`
- 为所有列表接口添加分页支持
- 拆分 PDF 页面为独立子组件
- 统一类型定义到 `src/types/` 目录
- 替换所有 `confirm()` 为 AlertDialog 组件
- 统一错误处理（所有路由使用 handleDbError）
- 添加缺失的数据库事务保护
- 移除硬编码校区名称和品牌信息

## Impact
- Affected code: 几乎所有 API 路由、前端页面、组件、hooks、数据库 schema
- **BREAKING**: API 响应格式统一将影响所有前端数据获取代码
- **BREAKING**: 分页支持将改变列表 API 的请求/响应结构
- **BREAKING**: 教师数据隔离将限制教师可访问的数据范围

## ADDED Requirements

### Requirement: Supabase RLS 保护
系统 SHALL 为所有 Supabase 表启用 Row Level Security 并配置策略，或改用 service_role key 仅在服务端使用，确保前端无法通过 anon key 直接读写数据。

#### Scenario: 攻击者使用 anon key 直接调用 Supabase API
- **WHEN** 攻击者获取 anon key 后直接调用 Supabase REST API
- **THEN** 应被 RLS 策略拒绝，或 anon key 不具备读写权限

### Requirement: API 路由统一认证
系统 SHALL 在所有需要认证的 API 路由中调用 `getAuthUser(request)` 验证用户身份，拒绝未认证请求。

#### Scenario: 未认证用户访问受保护 API
- **WHEN** 未携带有效 JWT Cookie 的请求访问受保护 API
- **THEN** 返回 401 Unauthorized

### Requirement: 教师资源级权限隔离
系统 SHALL 限制教师仅能访问和操作自己班级的学员和反馈数据，不能操作其他教师的数据。

#### Scenario: 教师尝试访问其他教师的学员
- **WHEN** 教师 A 请求 GET /api/students
- **THEN** 仅返回教师 A 班级中的学员

#### Scenario: 教师尝试修改其他教师的学员
- **WHEN** 教师 A 请求 PUT /api/students/{id}，该学员属于教师 B 的班级
- **THEN** 返回 403 Forbidden

### Requirement: SSRF 防护增强
系统 SHALL 在 DNS 解析后二次校验目标 IP，禁止非标准 IP 表示（十六进制、十进制、IPv6 映射地址），防止 DNS 重绑定攻击。

#### Scenario: 攻击者使用 DNS 重绑定绕过 SSRF 检查
- **WHEN** 攻击者配置域名首次解析为公网 IP，随后解析为 127.0.0.1
- **THEN** 系统在发起请求前再次校验解析后的 IP 地址，拒绝内网地址

### Requirement: 反馈持久化
系统 SHALL 在反馈创建向导完成后将反馈数据保存到数据库，包括标签评分、AI 报告内容、照片引用等。

#### Scenario: 用户完成 6 步反馈创建向导
- **WHEN** 用户完成所有步骤并确认提交
- **THEN** 反馈数据应保存到 feedbacks 表，用户可在历史记录中查看

### Requirement: XSS 防护
系统 SHALL 对所有使用 `dangerouslySetInnerHTML` 渲染的内容进行 HTML 消毒处理，使用 DOMPurify 或等效库。

#### Scenario: AI 返回包含恶意脚本的内容
- **WHEN** AI 模型返回包含 `<script>` 标签的内容
- **THEN** 渲染前应移除所有危险标签，仅保留安全的 HTML

### Requirement: 登录速率限制
系统 SHALL 对登录接口实施基于 IP 的速率限制（如 5 次/分钟），防止暴力破解。

#### Scenario: 攻击者短时间内多次尝试登录
- **WHEN** 同一 IP 在 1 分钟内第 6 次尝试登录
- **THEN** 返回 429 Too Many Requests

### Requirement: 反馈版本号原子更新
系统 SHALL 使用原子操作更新反馈版本号，防止并发更新导致版本号冲突。

#### Scenario: 两个并发请求同时更新同一反馈
- **WHEN** 两个请求同时读取版本号 3 并尝试更新为 4
- **THEN** 最终版本号应为 5，而非两个请求都写入 4

### Requirement: 统一 API 响应格式
系统 SHALL 所有 API 返回统一格式 `{ data: T, message?: string }`，错误响应为 `{ error: string, code?: string }`。

#### Scenario: 前端处理 API 响应
- **WHEN** 前端调用任何 API 接口
- **THEN** 响应体结构一致，数据在 `data` 字段中

### Requirement: 列表接口分页支持
系统 SHALL 为所有列表接口支持 `page` 和 `limit` 查询参数，返回 `{ data: [...], pagination: { page, limit, total, totalPages } }`。

#### Scenario: 前端请求第 2 页数据
- **WHEN** 前端请求 GET /api/students?page=2&limit=20
- **THEN** 返回第 21-40 条学员数据和分页元信息

### Requirement: 批量操作数组长度限制
系统 SHALL 对所有批量操作接口的数组参数设置最大长度限制（如 100），拒绝超长数组。

#### Scenario: 攻击者提交超大批量操作
- **WHEN** 请求体包含超过 100 条记录的数组
- **THEN** 返回 400 Bad Request，提示数组长度超限

### Requirement: 统一错误处理
系统 SHALL 所有 API 路由使用 `handleDbError` 处理数据库错误，不直接暴露 `error.message`。

#### Scenario: 数据库查询失败
- **WHEN** Supabase 查询返回错误
- **THEN** 生产环境返回通用错误消息，不暴露数据库结构信息

### Requirement: 数据库事务保护
系统 SHALL 对涉及多表操作的业务逻辑使用数据库事务（Supabase RPC 或存储过程），保证原子性。

#### Scenario: 创建教师时 users 表插入成功但 teachers 表失败
- **WHEN** 第二步插入失败
- **THEN** 第一步的插入应自动回滚，不留孤立记录

### Requirement: 移除硬编码凭据和品牌信息
系统 SHALL 移除前端代码中所有硬编码的默认密码、校区名称、品牌信息，改为从环境变量或系统设置读取。

#### Scenario: 不同校区部署系统
- **WHEN** 新校区部署系统
- **THEN** 通过环境变量配置校区名称，无需修改源代码

### Requirement: PDF 页面组件拆分
系统 SHALL 将 PDF 页面（1550+ 行）拆分为独立子组件，每个组件不超过 300 行。

#### Scenario: 开发者修改照片编辑器功能
- **WHEN** 开发者需要修改照片编辑器
- **THEN** 只需修改 FreeLayoutPhotoEditor 组件文件，不影响其他部分

### Requirement: 统一类型定义
系统 SHALL 将所有分散的类型定义合并到 `src/types/` 目录，消除重复定义。

#### Scenario: 修改 Student 接口
- **WHEN** 需要给 Student 添加新字段
- **THEN** 只需修改 `src/types/student.ts` 一处

### Requirement: 替换 confirm() 为 AlertDialog
系统 SHALL 将所有浏览器原生 `confirm()` 弹窗替换为 shadcn/ui AlertDialog 组件，保持 UI 一致性。

#### Scenario: 用户执行危险操作
- **WHEN** 用户点击删除按钮
- **THEN** 显示样式一致的确认对话框，而非浏览器原生弹窗

### Requirement: 统计逻辑修正
系统 SHALL 修复"本月新增"统计逻辑，同时比较年份和月份。

#### Scenario: 跨年统计
- **WHEN** 当前是 2026 年 6 月，数据库中有 2025 年 6 月创建的学员
- **THEN** 该学员不应被统计为"本月新增"

## MODIFIED Requirements

### Requirement: SSRF 防护
从仅检查 URL hostname 改为 DNS 解析后二次校验 IP 地址，并禁止非标准 IP 表示（十六进制、十进制、IPv6 映射）。

### Requirement: API 路由认证
从仅 classes 路由使用 `getAuthUser()` 扩展为所有受保护路由使用，并增加教师资源级权限检查。

## REMOVED Requirements

### Requirement: 前端手动设置认证头
**Reason**: 前端不应手动设置 x-user-id/x-user-role 请求头，认证应完全基于 JWT Cookie。
**Migration**: 移除 use-home-data.ts 和 use-class-actions.ts 中的请求头设置代码。
