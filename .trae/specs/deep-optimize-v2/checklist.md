# Checklist

## Phase 1: P0 安全修复
- [x] `/api/data/clear` 路由内有管理员角色校验，非管理员返回 403
- [x] `/api/users` GET 和 POST 方法有管理员角色校验
- [x] `/api/ai-settings` GET 和 PUT 方法有管理员角色校验
- [x] `/api/ai-settings` PUT 使用 `isSafeUrlAsync()` 而非 `isSafeUrl()`
- [x] 数据清空逻辑提取为共享 `clearAllData()` 函数
- [x] `/api/data/clear` 和 `/api/data/import` 使用同一个 `clearAllData()`
- [x] `/api/feedbacks/[id]` GET 方法有教师权限检查
- [x] `/api/stats` 对教师角色只返回其班级学生的统计数据

## Phase 2: P1 功能开发
- [x] `/api/auth/change-password` 接口可正常修改密码
- [x] `/api/users/[id]/reset-password` 管理员可重置用户密码
- [x] 设置页面有"修改密码"对话框
- [x] 用户管理页面有"重置密码"按钮
- [x] 反馈详情页有"编辑"按钮
- [x] 编辑模式预填已有数据并可修改保存
- [x] 创建反馈流程自动保存草稿到 sessionStorage
- [x] 刷新页面后草稿可恢复
- [x] 保存成功后草稿被清除
- [x] 照片上传前自动压缩（最大宽度 1200px）
- [x] AI 生成时有连接状态指示
- [x] AI 连接等待时提交按钮被禁用
- [x] JWT Token 过半有效期时自动续签
- [x] 前端自动更新存储的 Token

## Phase 3: P1 性能优化
- [x] `/api/home-data` 聚合 API 正常工作
- [x] `useHomeData` 使用聚合 API，减少请求数
- [x] 统计 API 查询次数减少 50%+
- [x] 统计 API 有 5 分钟缓存
- [x] 所有 API 路由使用统一错误响应格式
- [x] `isLegacyAiReport()` 工具函数提取完成，3 处重复代码消除
- [x] PDF 页面不再使用 URL 参数传递报告数据

## Phase 4: P1 代码质量
- [x] API 请求日志中间件正常记录路径、耗时、状态码
- [x] 前端类型定义与 Drizzle schema 保持一致
