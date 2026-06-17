# Tasks

- [x] Task 1: 修复 P0 安全问题 - JWT Secret 强制检查 + 密码哈希 + 硬编码密码移除
  - [x] SubTask 1.1: 修改 src/lib/auth.ts - 生产环境 JWT_SECRET 缺失时抛出异常拒绝启动
  - [x] SubTask 1.2: 修改 src/app/api/teachers/route.ts - 创建教师时调用 hashPassword() 哈希密码
  - [x] SubTask 1.3: 修改 src/app/api/users/route.ts - 创建用户时调用 hashPassword() 哈希密码
  - [x] SubTask 1.4: 修改 src/app/api/users/[id]/route.ts - 更新密码时调用 hashPassword() 哈希
  - [x] SubTask 1.5: 修改 src/app/api/data/import/route.ts - 移除硬编码明文密码和手机号，改用环境变量
  - [x] SubTask 1.6: 修改 src/app/api/data/full-import/route.ts - 移除硬编码明文密码
  - [x] SubTask 1.7: 修改 src/app/api/batch-import/update-admin-teacher/route.ts - 移除硬编码 UUID

- [x] Task 2: 修复 P0 安全问题 - Middleware 扩展 + 角色权限校验
  - [x] SubTask 2.1: 修改 src/middleware.ts - 扩展 matcher 保护前端路由 + 添加角色权限校验逻辑
  - [x] SubTask 2.2: 修改 src/app/api/auth/login/route.ts - 移除明文密码比对兼容逻辑，仅支持 bcrypt

- [x] Task 3: 修复 P0 问题 - page.tsx 缺少 useRouter 导入 + docker-compose 环境变量
  - [x] SubTask 3.1: 修复 src/app/page.tsx - 添加缺失的 useRouter 导入
  - [x] SubTask 3.2: 修改 docker-compose.yml - 添加 JWT_SECRET 环境变量

- [x] Task 4: 补充 PUT 路由输入校验
  - [x] SubTask 4.1: 修改 src/app/api/students/[id]/route.ts - PUT 添加 Zod 校验
  - [x] SubTask 4.2: 修改 src/app/api/feedbacks/[id]/route.ts - PUT 添加 Zod 校验
  - [x] SubTask 4.3: 修改 src/app/api/teachers/[id]/route.ts - PUT 添加 Zod 校验
  - [x] SubTask 4.4: 修改 src/app/api/tags/[id]/route.ts - PUT 添加 Zod 校验
  - [x] SubTask 4.5: 修改 src/app/api/themes/[id]/route.ts - PUT 添加 Zod 校验
  - [x] SubTask 4.6: 修改 src/app/api/course-stages/[id]/route.ts - PUT 添加 Zod 校验
  - [x] SubTask 4.7: 修改 src/app/api/users/[id]/route.ts - PUT 添加 Zod 校验
  - [x] SubTask 4.8: 修改 src/app/api/classes/[id]/route.ts - PUT 添加 Zod 校验
  - [x] SubTask 4.9: 修改 src/app/api/ai-settings/route.ts - PUT 收窄校验 schema

- [x] Task 5: 统一 API 错误响应格式
  - [x] SubTask 5.1: 创建 src/lib/api-error.ts - 统一错误响应工具函数
  - [x] SubTask 5.2: 修改所有 API 路由 - 使用统一错误响应，生产环境不暴露内部错误

- [x] Task 6: 数据库索引补充
  - [x] SubTask 6.1: 修改 src/storage/database/shared/schema.ts - 为 students.classId 和 students.adminTeacherId 添加索引

- [x] Task 7: 验证构建
  - [x] SubTask 7.1: 运行 tsc 类型检查
  - [x] SubTask 7.2: 运行 ESLint 检查
  - [x] SubTask 7.3: 运行 next build 构建测试

# Task Dependencies
- [Task 2] depends on [Task 1] (移除明文密码兼容后再扩展 middleware)
- [Task 4] depends on [Task 5] (先统一错误格式再添加校验)
- [Task 7] depends on [Task 1-6] (所有修改完成后验证)
