# 长期优化与 API 层收尾实现计划

> **面向 AI 代理的工作者：** 必需子技能：superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 完成剩余 API 路由的 Repository + Service 迁移、数据导入导出事务保护与安全加固，并为后续数据库/前端优化打下基础。

**架构：** 所有 API 路由统一走 `withDbError` / `withAuth` / `withValidation` 包装器；业务逻辑下沉到 Service；数据访问下沉到 Repository；导入导出使用 Drizzle 事务保护；默认教务老师账号改为环境变量配置 + 引导页兜底。

**技术栈：** Next.js App Router、TypeScript、Drizzle ORM、PostgreSQL、Zod、pnpm。

---

## 文件清单

- `src/lib/services/data-service.ts`：数据导出、清空、导入、全量导入业务逻辑。
- `src/lib/repositories/data-repository.ts`：导入导出涉及的多表批量写入封装（事务内）。
- `src/app/api/data/import/route.ts`：数据导入薄路由。
- `src/app/api/data/full-import/route.ts`：全量覆盖导入薄路由。
- `src/lib/config/default-admins.ts`：读取环境变量中的默认教务老师账号配置。
- `.env.example`：补充默认管理员相关环境变量示例。
- `src/lib/services/batch-import-service.ts`：班级/学员批量导入业务逻辑。
- `src/app/api/batch-import/classes/route.ts` / `src/app/api/batch-import/students/route.ts`：批量导入薄路由。
- `src/lib/services/generate-service.ts`、`src/lib/services/parse-service.ts`：生成与解析业务逻辑。
- `src/app/api/generate/route.ts`、`src/app/api/parse/route.ts`：对应薄路由。
- `src/app/api/init-data/route.ts`：初始化数据薄路由。

---

## 任务 1：数据导入/全量导入事务保护

**文件：**
- 创建：`src/lib/repositories/data-repository.ts`
- 修改：`src/lib/services/data-service.ts`
- 修改：`src/app/api/data/import/route.ts`
- 修改：`src/app/api/data/full-import/route.ts`
- 创建：`src/lib/config/default-admins.ts`
- 修改：`.env.example`

- [ ] **步骤 1：创建 default-admins 配置读取**
  新建 `src/lib/config/default-admins.ts`，读取环境变量 `DEFAULT_ADMIN_TEACHERS`，格式示例：
  ```ts
  export interface DefaultAdminConfig {
    username: string;
    name: string;
    password?: string;
  }

  export function getDefaultAdminTeachers(): DefaultAdminConfig[] {
    const raw = process.env.DEFAULT_ADMIN_TEACHERS || "";
    if (!raw) return [];
    return raw.split(",").map((part) => {
      const [username, name] = part.trim().split(":");
      return { username: username.trim(), name: (name || username).trim() };
    });
  }
  ```
  同时导出 `getDefaultAdminPassword(): string` 读取 `DEFAULT_ADMIN_PASSWORD` 或生成占位符。

- [ ] **步骤 2：创建 data-repository 批量导入事务**
  在 `src/lib/repositories/data-repository.ts` 中实现：
  ```ts
  export async function importData(data: ImportData, options: { clearFirst?: boolean }) {
    return db.transaction(async (tx) => {
      if (options.clearFirst) {
        await tx.delete(classTransfers);
        await tx.delete(feedbacks);
        await tx.delete(studentClasses);
        await tx.delete(students);
        await tx.delete(classes);
      }
      // 按依赖顺序写入 classes、students、feedbacks、classTransfers 等
      // ...
    });
  }
  ```
  处理 adminTeacher、class、teacher 的 ID 映射，使用 default-admins 配置替代硬编码。

- [ ] **步骤 3：迁移 import 路由**
  修改 `src/app/api/data/import/route.ts`，使用 `withAuth` + `withValidation` + `dataService.importData`。

- [ ] **步骤 4：迁移 full-import 路由**
  修改 `src/app/api/data/full-import/route.ts`，先清空再导入，使用同一事务保护。

- [ ] **步骤 5：更新 .env.example**
  添加：
  ```
  DEFAULT_ADMIN_TEACHERS=xinxin:心心,yanzi:燕子
  DEFAULT_ADMIN_PASSWORD=change-me
  ```

- [ ] **步骤 6：运行 lint 与 ts-check**
  命令：`pnpm ts-check && pnpm lint`
  预期：0 errors。

- [ ] **步骤 7：Commit**
  ```bash
  git add -A
  git commit -m "refactor(api): transaction-protect data import with configurable default admins"
  ```

---

## 任务 2：批量导入路由迁移

**文件：**
- 创建：`src/lib/services/batch-import-service.ts`
- 创建：`src/lib/repositories/batch-import-repository.ts`（可选，若逻辑简单可直接在 service 中调用已有 repo）
- 修改：`src/app/api/batch-import/classes/route.ts`
- 修改：`src/app/api/batch-import/students/route.ts`

- [ ] **步骤 1：创建 batch-import-service**
  实现 `importClasses` 与 `importStudents`，使用事务批量插入，返回成功/失败明细。

- [ ] **步骤 2：迁移 batch-import/classes 路由**
  使用 `withAuth` + `withValidation` + `batchImportService.importClasses`。

- [ ] **步骤 3：迁移 batch-import/students 路由**
  同上。

- [ ] **步骤 4：运行 lint 与 ts-check**
  预期：0 errors。

- [ ] **步骤 5：Commit**
  消息：`refactor(api): migrate batch-import routes to service layer`

---

## 任务 3：generate / parse / init-data 路由迁移

**文件：**
- 创建：`src/lib/services/generate-service.ts`、`src/lib/services/parse-service.ts`
- 修改：`src/app/api/generate/route.ts`、`src/app/api/parse/route.ts`
- 修改：`src/app/api/init-data/route.ts`

- [ ] **步骤 1：迁移 generate 路由**
  将 AI 生成逻辑封装到 service，路由仅做校验与响应。

- [ ] **步骤 2：迁移 parse 路由**
  将 Excel/文本解析逻辑封装到 service。

- [ ] **步骤 3：迁移 init-data 路由**
  使用 service 初始化默认 course-stages / tags / themes。

- [ ] **步骤 4：运行 lint 与 ts-check**
  预期：0 errors。

- [ ] **步骤 5：Commit**
  消息：`refactor(api): migrate generate, parse and init-data routes`

---

## 任务 4：API 层安全加固

**文件：**
- 修改：`src/lib/services/ai-setting-service.ts`（已完成 api_key 掩码）
- 修改：所有 Service 层，统一对手机号/邮箱/API Key/URL 脱敏
- 创建：`src/lib/sensitive-mask.ts`
- 修改：`src/lib/route-handlers/with-validation.ts` 若需增强

- [ ] **步骤 1：创建 sensitive-mask 工具**
  实现 `maskPhone`、`maskEmail`、`maskApiKey`、`maskUrl`。

- [ ] **步骤 2：统一敏感字段脱敏**
  在 user/student/teacher/class 等 service 的输出中应用脱敏。

- [ ] **步骤 3：运行 lint 与 ts-check**
  预期：0 errors。

- [ ] **步骤 4：Commit**
  消息：`refactor(api): add centralized sensitive data masking`

---

## 任务 5：数据库层优化（本地 PostgreSQL + 索引）

**文件：**
- 修改：`src/storage/database/shared/schema.ts`
- 新增：Drizzle 迁移文件
- 修改：`package.json`（可选脚本）
- 修改：`drizzle.config.ts`

- [ ] **步骤 1：添加表级索引**
  为 `students.class_id`、`students.admin_teacher_id`、`classes.teacher_id`、`feedbacks.student_id`、`feedbacks.teacher_id` 等添加索引。

- [ ] **步骤 2：添加 updated_at 自动更新触发器**
  在 Drizzle 迁移中创建 PostgreSQL 触发器。

- [ ] **步骤 3：生成并提交迁移文件**
  使用 `pnpm db:generate` 或手写 SQL 迁移。

- [ ] **步骤 4：Commit**
  消息：`perf(db): add indexes and updated_at triggers`

---

## 任务 6：验证与收尾

- [ ] **步骤 1：全量 lint 与 ts-check**
  命令：`pnpm ts-check && pnpm lint`
  预期：0 errors。

- [ ] **步骤 2：最终 Commit 或汇总**
  根据当前分支状态决定是否继续提交。

---

## 执行选项

**1. 子代理驱动（推荐）** - 每个任务调度子代理并行/串行执行，快速推进。

**2. 内联执行** - 在当前会话中按检查点批量执行。

当前选择：子代理驱动，持续全面推进。
