# 备份/恢复与 Docker 部署方案设计

## 1. 备份/恢复功能

### 1.1 目标

在管理员后台提供一键备份全量数据，并支持从备份文件中选择性恢复部分数据的能力。

### 1.2 备份数据范围

备份文件 `teaching-feedback-backup-<日期>.json` 包含：

- 业务数据：students、classes、feedbacks、class_transfers、teaching_themes、tags、course_stages
- 账号数据：users、teachers
- 配置数据：ai_settings、course_prompts
- 元信息：backupAt、version、counts

### 1.3 API 设计

#### POST /api/data/backup

导出全量数据，返回 JSON 文件下载。

响应：
- Content-Type: application/json
- Content-Disposition: attachment; filename="teaching-feedback-backup-YYYY-MM-DD.json"

#### POST /api/data/restore

接收备份文件内容，按选择的数据分类恢复。

请求体：
```json
{
  "data": { /* 备份文件完整内容 */ },
  "selections": ["students", "classes", "feedbacks", "teachers", "aiSettings", "coursePrompts", "themes", "tags", "courseStages"]
}
```

恢复策略：
- 同 ID 数据覆盖
- 未选择的数据分类不写入
- 所有写入在同一个数据库事务中执行，失败整体回滚

### 1.4 前端设计

在 `data-management.tsx` 中新增：

1. **一键备份** 区块
   - 按钮：创建完整备份
   - 下载 JSON 文件
   - 显示备份统计弹窗（可选）

2. **选择性恢复** 区块
   - 文件选择器（仅 .json）
   - 上传后解析并展示分类清单：
     - 学员与班级（students + classes）
     - 反馈记录（feedbacks）
     - 转班记录（class_transfers）
     - 主题/标签/课程阶段
     - 教师账号
     - AI 配置与提示词
   - 每个分类显示数量
   - 用户勾选后确认恢复

### 1.5 后端实现

在 `data-service.ts` 中新增：

- `backupAll()`：查询所有表并组装备份结构
- `restoreData(data, selections)`：在事务中按依赖顺序写入选择的数据

数据写入顺序（避免外键冲突）：
1. users / teachers
2. classes
3. students
4. class_transfers
5. feedbacks
6. teaching_themes / tags / course_stages / ai_settings / course_prompts

### 1.6 安全与权限

- 仅 admin 角色可访问备份/恢复接口
- 恢复操作需二次确认
- 大文件限制：50MB

## 2. Docker 部署方案

### 2.1 目标

提供一键本地/生产 Docker 部署方案，包含 Next.js 应用和 PostgreSQL 数据库。

### 2.2 文件清单

- `Dockerfile`：多阶段构建 Next.js standalone
- `docker-compose.yml`：编排 app + postgres
- `.dockerignore`：减小构建上下文
- `scripts/docker-entrypoint.sh`：启动前执行数据库迁移和初始化
- `docs/docker-deploy.md`：部署文档

### 2.3 Dockerfile

阶段1（builder）：
- 基础镜像：node:24-alpine
- 安装 pnpm
- 复制 package.json / pnpm-lock.yaml
- 安装依赖
- 复制源码
- 运行 `pnpm build`

阶段2（runner）：
- 基础镜像：node:24-alpine
- 从 builder 复制 `.next/standalone`、`.next/static`、`public`
- 暴露 3000 端口
- 运行 `server.js`

### 2.4 docker-compose.yml

服务：
- `postgres`：PostgreSQL 16，使用命名卷持久化
- `app`：基于 Dockerfile 构建，依赖 postgres
- 环境变量通过 `.env` 或 compose 文件注入
- 健康检查确保 postgres 就绪后 app 才启动

### 2.5 启动流程

1. Docker Compose 启动 postgres
2. app 容器通过 `docker-entrypoint.sh` 执行：
   - 等待 postgres 可用
   - 运行 `drizzle-kit migrate`
   - 如 users 表为空，调用初始化脚本创建 admin
3. 启动 Next.js standalone

### 2.6 环境变量

```env
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/feedback_db
JWT_SECRET=change-me-in-production
ADMIN_DEFAULT_PASSWORD=your-strong-password
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 3. 非目标

- 不提供自动定时备份（本次仅支持手动）
- 不提供云端存储（备份文件下载到本地）
- 不修改现有数据导入/导出 API 的行为
