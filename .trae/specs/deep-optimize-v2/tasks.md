# Tasks

## Phase 1: P0 安全修复

- [x] Task 1: 管理员 API 角色校验 — 为 `/api/data/clear`、`/api/users`、`/api/ai-settings` 添加路由内 `authUser.userRole !== 'admin'` 检查
  - [x] SubTask 1.1: `/api/data/clear/route.ts` 添加管理员角色校验
  - [x] SubTask 1.2: `/api/users/route.ts` GET 和 POST 方法添加管理员角色校验
  - [x] SubTask 1.3: `/api/ai-settings/route.ts` GET 和 PUT 方法添加管理员角色校验

- [x] Task 2: SSRF 防护升级 — 将 `/api/ai-settings/route.ts` 中的 `isSafeUrl()` 改为 `isSafeUrlAsync()`

- [x] Task 3: 数据清空逻辑统一 — 提取共享 `clearAllData()` 函数，`/api/data/clear` 和 `/api/data/import` 统一使用

- [x] Task 4: 反馈详情页教师权限隔离 — `/api/feedbacks/[id]/route.ts` GET 方法添加教师权限检查

- [x] Task 5: 统计 API 教师权限隔离 — `/api/stats/route.ts` 对教师角色过滤只统计其班级学生

## Phase 2: P1 功能开发

- [x] Task 6: 密码修改功能
  - [x] SubTask 6.1: 创建 `/api/auth/change-password` 接口（验证旧密码 + 更新新密码）
  - [x] SubTask 6.2: 创建 `/api/users/[id]/reset-password` 管理员重置密码接口
  - [x] SubTask 6.3: 设置页面添加"修改密码"对话框
  - [x] SubTask 6.4: 用户管理页面添加"重置密码"按钮

- [x] Task 7: 反馈编辑功能
  - [x] SubTask 7.1: 反馈详情页添加"编辑"按钮
  - [x] SubTask 7.2: 创建反馈流程支持 `editMode`，预填已有数据
  - [x] SubTask 7.3: 编辑模式保存时调用 PUT 接口而非 POST

- [x] Task 8: 反馈创建草稿保存
  - [x] SubTask 8.1: 创建 `useDraftSave` hook，自动保存表单数据到 sessionStorage
  - [x] SubTask 8.2: 进入创建流程时检测并恢复草稿
  - [x] SubTask 8.3: 保存成功后清除草稿

- [x] Task 9: 图片上传压缩
  - [x] SubTask 9.1: 创建 `compressImage()` 工具函数（最大宽度 1200px，JPEG 0.8）
  - [x] SubTask 9.2: 在照片上传流程中集成压缩

- [x] Task 10: AI 生成进度指示
  - [x] SubTask 10.1: AI 流式对话框添加连接状态指示
  - [x] SubTask 10.2: 等待连接时禁用提交按钮

- [x] Task 11: JWT Token 自动刷新
  - [x] SubTask 11.1: API 中间件检测 Token 剩余有效期，过半时签发新 Token
  - [x] SubTask 11.2: 前端拦截 API 响应，自动更新存储的 Token

## Phase 3: P1 性能优化

- [x] Task 12: 首页聚合 API — 创建 `/api/home-data` 一次返回学生、班级、教师数据
  - [x] SubTask 12.1: 创建聚合 API 路由
  - [x] SubTask 12.2: 修改 `useHomeData` hook 使用聚合 API

- [x] Task 13: 统计查询优化 — 合并统计 API 的 8+ 次查询，添加 5 分钟缓存

- [x] Task 14: 统一 API 错误响应格式 — 所有路由使用 `api-error.ts` 工具函数

- [x] Task 15: AI 报告格式兼容提取 — 提取 `isLegacyAiReport()` 工具函数，消除 3 处重复

- [x] Task 16: 移除 URL 参数传递报告数据 — PDF 页面仅使用 sessionStorage

## Phase 4: P1 代码质量

- [x] Task 17: 请求日志中间件 — 创建 API 请求日志工具，记录路径、耗时、状态码

- [x] Task 18: 类型定义统一 — 以 Drizzle schema 为单一数据源，前端类型显式映射

# Task Dependencies
- [Task 6] depends on [Task 1] (密码修改需要管理员权限校验)
- [Task 7] depends on [Task 4] (反馈编辑需要权限隔离)
- [Task 12] depends on [Task 5] (聚合 API 需要统计权限隔离)
- [Task 13] depends on [Task 5] (统计优化需要权限隔离)
- [Task 1-5] 可并行执行
- [Task 6-11] 可并行执行
- [Task 12-16] 可并行执行
