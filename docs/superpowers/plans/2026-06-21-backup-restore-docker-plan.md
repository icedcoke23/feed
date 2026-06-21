# 备份/恢复与 Docker 部署实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在管理员后台新增一键备份全量数据与选择性恢复功能，并提供完整的 Docker 部署方案。

**架构：** 后端在 `data-service.ts` 中新增 `backupAll()` 与 `restoreData()`；前端扩展 `data-management.tsx` 增加备份/恢复 UI；Docker 使用多阶段构建的 Next.js standalone 镜像，配合 PostgreSQL 容器和启动脚本。

**技术栈：** Next.js 16 + Drizzle ORM + PostgreSQL + Docker Compose

---

## 文件清单

| 文件 | 职责 |
|------|------|
| `src/lib/services/data-service.ts` | 新增 `backupAll()`、`restoreData()` 业务逻辑 |
| `src/lib/repositories/data-repository.ts` | 如有需要，新增批量查询/插入辅助函数 |
| `src/app/api/data/backup/route.ts` | 备份接口，返回 JSON 文件下载 |
| `src/app/api/data/restore/route.ts` | 恢复接口，接收备份数据和选择项 |
| `src/components/business/data-management.tsx` | 扩展 UI：一键备份、选择性恢复 |
| `src/components/business/backup-restore-dialog.tsx` | 新建：恢复前选择分类的对话框 |
| `Dockerfile` | 多阶段构建镜像 |
| `.dockerignore` | 排除不需要的文件 |
| `docker-compose.yml` | 编排 app 与 postgres |
| `scripts/docker-entrypoint.sh` | 启动前迁移+初始化 |
| `docs/docker-deploy.md` | Docker 部署说明 |

---

## 任务 1：后端备份服务

**文件：**
- 修改：`src/lib/services/data-service.ts`
- 创建：`src/app/api/data/backup/route.ts`

- [ ] **步骤 1：在 `data-service.ts` 中新增 `backupAll()`**

查询所有表，返回统一备份结构：

```typescript
export interface BackupData {
  version: string;
  backupAt: string;
  counts: Record<string, number>;
  users: typeof users.$inferSelect[];
  teachers: typeof teachers.$inferSelect[];
  students: typeof students.$inferSelect[];
  classes: typeof classes.$inferSelect[];
  feedbacks: typeof feedbacks.$inferSelect[];
  classTransfers: typeof classTransfers.$inferSelect[];
  themes: typeof teachingThemes.$inferSelect[];
  tags: typeof tags.$inferSelect[];
  courseStages: typeof courseStages.$inferSelect[];
  aiSettings: typeof aiSettings.$inferSelect[];
  coursePrompts: typeof coursePrompts.$inferSelect[];
}

export async function backupAll(): Promise<BackupData> {
  // 并行查询所有表
}
```

- [ ] **步骤 2：创建备份 API 路由**

```typescript
// src/app/api/data/backup/route.ts
export async function POST(request: NextRequest): Promise<NextResponse> {
  // 鉴权 admin
  // 调用 dataService.backupAll()
  // 返回 JSON 下载响应
}
```

- [ ] **步骤 3：Commit**

```bash
git add src/lib/services/data-service.ts src/app/api/data/backup/route.ts
git commit -m "feat: add full data backup service and API"
```

---

## 任务 2：后端恢复服务

**文件：**
- 修改：`src/lib/services/data-service.ts`
- 创建：`src/app/api/data/restore/route.ts`

- [ ] **步骤 1：在 `data-service.ts` 中新增 `restoreData()`**

```typescript
export type RestoreSelection =
  | "users"
  | "teachers"
  | "classes"
  | "students"
  | "classTransfers"
  | "feedbacks"
  | "themes"
  | "tags"
  | "courseStages"
  | "aiSettings"
  | "coursePrompts";

export async function restoreData(
  backup: BackupData,
  selections: RestoreSelection[]
): Promise<{ results: Record<string, { success: number; failed: number }>; logs: string[] }> {
  // 在 withTransaction 中按依赖顺序写入
}
```

写入顺序：
1. users / teachers
2. classes
3. students
4. class_transfers
5. feedbacks
6. themes / tags / course_stages / ai_settings / course_prompts

- [ ] **步骤 2：创建恢复 API 路由**

```typescript
// src/app/api/data/restore/route.ts
export async function POST(request: NextRequest): Promise<NextResponse> {
  // 鉴权 admin
  // 解析 { data, selections }
  // 调用 dataService.restoreData()
  // 返回结果
}
```

- [ ] **步骤 3：Commit**

```bash
git add src/lib/services/data-service.ts src/app/api/data/restore/route.ts
git commit -m "feat: add selective data restore service and API"
```

---

## 任务 3：前端备份/恢复 UI

**文件：**
- 修改：`src/components/business/data-management.tsx`
- 创建：`src/components/business/backup-restore-dialog.tsx`

- [ ] **步骤 1：创建恢复选择对话框组件**

展示备份文件解析后的分类清单和数量，提供复选框供用户选择。

- [ ] **步骤 2：扩展 `data-management.tsx`**

新增两个区块：
- **一键备份**：按钮调用 `/api/data/backup` 并下载文件
- **选择性恢复**：选择文件 → 解析 → 打开选择对话框 → 调用 `/api/data/restore`

- [ ] **步骤 3：Commit**

```bash
git add src/components/business/data-management.tsx src/components/business/backup-restore-dialog.tsx
git commit -m "feat: add backup/restore UI in admin data management"
```

---

## 任务 4：Docker 部署文件

**文件：**
- 创建：`Dockerfile`
- 创建：`.dockerignore`
- 创建：`docker-compose.yml`
- 创建：`scripts/docker-entrypoint.sh`
- 创建：`docs/docker-deploy.md`

- [ ] **步骤 1：编写 Dockerfile**

```dockerfile
# syntax=docker/dockerfile:1
FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

FROM base AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh
COPY --from=builder /app/drizzle.config.ts ./
COPY --from=builder /app/src/storage/database/migrations ./src/storage/database/migrations
RUN chmod +x ./scripts/docker-entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["./scripts/docker-entrypoint.sh"]
```

- [ ] **步骤 2：编写 .dockerignore**

```
node_modules
.next
.git
.env
.env.local
.env.*.local
coverage
*.log
```

- [ ] **步骤 3：编写 docker-compose.yml**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: feedback_db
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/feedback_db
      JWT_SECRET: ${JWT_SECRET:-change-me-in-production}
      ADMIN_DEFAULT_PASSWORD: ${ADMIN_DEFAULT_PASSWORD:-}
      NEXT_PUBLIC_APP_URL: ${NEXT_PUBLIC_APP_URL:-http://localhost:3000}
    depends_on:
      postgres:
        condition: service_healthy

volumes:
  postgres_data:
```

- [ ] **步骤 4：编写 docker-entrypoint.sh**

```bash
#!/bin/sh
set -e

# 等待数据库可用
echo "Waiting for postgres..."
until pg_isready -d "$DATABASE_URL" > /dev/null 2>&1; do
  sleep 1
done

# 执行数据库迁移
echo "Running database migrations..."
pnpm drizzle-kit migrate

# 启动应用
echo "Starting application..."
exec node server.js
```

- [ ] **步骤 5：编写部署文档 `docs/docker-deploy.md`**

包含：环境准备、构建启动、环境变量说明、生产建议。

- [ ] **步骤 6：Commit**

```bash
git add Dockerfile .dockerignore docker-compose.yml scripts/docker-entrypoint.sh docs/docker-deploy.md
git commit -m "feat: add Docker deployment support"
```

---

## 任务 5：验证

- [ ] **步骤 1：类型检查**

```bash
pnpm run ts-check
```

预期：通过，无错误。

- [ ] **步骤 2：Lint 检查**

```bash
pnpm run lint
```

预期：通过，无新增 error。

- [ ] **步骤 3：构建检查**

```bash
pnpm run build
```

预期：构建成功。

- [ ] **步骤 4：本地 Docker 验证（可选但推荐）**

```bash
docker compose up --build -d
```

预期：postgres 与 app 均启动，访问 http://localhost:3000 正常。

- [ ] **步骤 5：最终 Commit**

```bash
git commit -m "feat: complete backup/restore and Docker deployment"
```

---

## 自检

- [x] 规格覆盖度：备份、恢复、Docker 三个模块都有对应任务
- [x] 占位符扫描：无 TODO/待定
- [x] 类型一致性：RestoreSelection、BackupData 在后端与 API 中命名一致
