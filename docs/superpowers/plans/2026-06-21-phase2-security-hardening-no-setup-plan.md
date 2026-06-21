# Phase 2 安全加固（不含 /setup）实现计划

> **面向 AI 代理的工作者：** 使用 superpowers:executing-plans 或 superpowers:subagent-driven-development 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 移除硬编码教务老师映射、补齐管理接口的 Zod 输入校验、统一敏感信息脱敏、修复全部 lint warning，最终 `ts-check`、`lint`、`build` 全部通过。

**架构：** 在 `src/lib/config/default-admins.ts` 已有环境变量映射的基础上，删除路由中的硬编码常量；新建 `src/lib/validations/data-import.ts` 提供共享 schema；扩展 `src/lib/sensitive-mask.ts` 并接入 `src/lib/api-error.ts` 与所有错误日志；按 warning 类型批量清理 lint。

**技术栈：** Next.js 16 + TypeScript + Drizzle ORM + Zod + ESLint

---

## 文件清单

| 文件 | 职责 |
|------|------|
| `src/app/api/batch-import/update-admin-teacher/route.ts` | 删除硬编码映射，改用环境变量 |
| `src/lib/services/batch-import-service.ts` | 调整 `updateAdminTeachers` 签名，接收映射表 |
| `src/lib/validations/data-import.ts` | 新建：batch-import / init-data / reset-admin 的 Zod schema |
| `src/app/api/batch-import/classes/route.ts` | 接入 Zod 校验 |
| `src/app/api/batch-import/update-admin-teacher/route.ts` | 接入 Zod 校验 |
| `src/app/api/init-data/route.ts` | 接入 Zod 校验 |
| `src/app/api/data/reset-admin/route.ts` | 接入 Zod 校验 |
| `src/lib/sensitive-mask.ts` | 新增 `sanitizeError` 通用脱敏函数 |
| `src/lib/api-error.ts` | `handleDbError` 日志与响应均脱敏 |
| 多个路由/组件/hooks | 删除未使用变量、修复 hook 依赖、处理 `<img>` warning |

---

## 任务 1：移除硬编码教务老师映射

**文件：**
- 修改：`src/app/api/batch-import/update-admin-teacher/route.ts`
- 修改：`src/lib/services/batch-import-service.ts`
- 修改：`src/lib/config/default-admins.ts`（如需要补充错误提示）

- [ ] **步骤 1：读取 `batch-import-service.ts` 中 `updateAdminTeachers` 的实现**

确认当前签名为：

```ts
export async function updateAdminTeachers(
  students: StudentWithAdmin[],
  adminTeacherUsernames: Record<string, string>
): Promise<...>
```

- [ ] **步骤 2：修改路由，删除硬编码常量并改用环境变量映射**

```ts
import { getAdminTeacherMappings } from "@/lib/config/default-admins";

export async function POST(request: NextRequest) {
  // ... 鉴权 ...

  const adminTeacherMappings = getAdminTeacherMappings();
  if (Object.keys(adminTeacherMappings).length === 0) {
    return badRequestError("未配置 ADMIN_TEACHER_MAPPINGS 环境变量");
  }

  const body = await request.json();
  const parsed = updateAdminTeacherSchema.safeParse(body);
  if (!parsed.success) {
    return badRequestError("请求参数错误", parsed.error.flatten());
  }

  const result = await batchImportService.updateAdminTeachers(
    parsed.data.students,
    adminTeacherMappings
  );

  return successResponse({ success: true, ...result });
}
```

- [ ] **步骤 3：运行类型检查**

```bash
pnpm run ts-check
```

预期：无新增错误。

- [ ] **步骤 4：Commit**

```bash
git add src/app/api/batch-import/update-admin-teacher/route.ts
git commit -m "refactor: remove hardcoded admin teacher mappings"
```

---

## 任务 2：API 输入校验全覆盖

**文件：**
- 创建：`src/lib/validations/data-import.ts`
- 修改：`src/app/api/batch-import/classes/route.ts`
- 修改：`src/app/api/batch-import/update-admin-teacher/route.ts`
- 修改：`src/app/api/init-data/route.ts`
- 修改：`src/app/api/data/reset-admin/route.ts`

- [ ] **步骤 1：新建共享 schema 文件**

```ts
// src/lib/validations/data-import.ts
import { z } from "zod";

export const batchImportClassSchema = z.object({
  classes: z.array(
    z.object({
      teacherName: z.string().min(1, "教师姓名不能为空"),
      classTime: z.string().min(1, "上课时间不能为空"),
      courseName: z.string().min(1, "课程名称不能为空"),
      students: z.array(z.string().min(1, "学生姓名不能为空")),
    })
  ).min(1, "至少提供一个班级"),
});

export const updateAdminTeacherSchema = z.object({
  students: z.array(
    z.object({
      name: z.string().min(1, "学生姓名不能为空"),
      adminType: z.string().min(1, "教务类型不能为空"),
    })
  ).min(1, "至少提供一个学生"),
});

export const initDataSchema = z.object({}).optional();

export const resetAdminSchema = z.object({}).optional();
```

- [ ] **步骤 2：在 `batch-import/classes/route.ts` 接入校验**

```ts
import { batchImportClassSchema } from "@/lib/validations/data-import";
import { badRequestError } from "@/lib/api-error";

export async function POST(request: NextRequest) {
  // ... 鉴权 ...

  const body = await request.json();
  const parsed = batchImportClassSchema.safeParse(body);
  if (!parsed.success) {
    return badRequestError("请求参数错误", parsed.error.flatten());
  }

  const result = await batchImportService.importClasses(parsed.data.classes);
  return successResponse(result);
}
```

- [ ] **步骤 3：在 `init-data/route.ts` 接入校验**

```ts
import { initDataSchema } from "@/lib/validations/data-import";

export async function POST(request: NextRequest) {
  // ... 鉴权 ...

  const body = await request.json().catch(() => ({}));
  const parsed = initDataSchema.safeParse(body);
  if (!parsed.success) {
    return badRequestError("请求参数错误", parsed.error.flatten());
  }

  const result = await initDataService.initializeDefaults();
  // ...
}
```

- [ ] **步骤 4：在 `data/reset-admin/route.ts` 接入校验**

```ts
import { resetAdminSchema } from "@/lib/validations/data-import";

export async function POST(request: NextRequest) {
  // ... 鉴权 ...

  const body = await request.json().catch(() => ({}));
  const parsed = resetAdminSchema.safeParse(body);
  if (!parsed.success) {
    return badRequestError("请求参数错误", parsed.error.flatten());
  }

  const result = await dataService.resetAdmin();
  // ...
}
```

- [ ] **步骤 5：运行类型检查**

```bash
pnpm run ts-check
```

预期：无新增错误。

- [ ] **步骤 6：Commit**

```bash
git add src/lib/validations/data-import.ts \
  src/app/api/batch-import/classes/route.ts \
  src/app/api/batch-import/update-admin-teacher/route.ts \
  src/app/api/init-data/route.ts \
  src/app/api/data/reset-admin/route.ts
git commit -m "feat: add Zod validation for admin data management routes"
```

---

## 任务 3：敏感信息脱敏

**文件：**
- 修改：`src/lib/sensitive-mask.ts`
- 修改：`src/lib/api-error.ts`
- 修改：`src/app/api/data/reset-admin/route.ts`
- 修改：所有含 `console.error(error)` 的路由（可选，先改 `api-error` 即可覆盖大部分）

- [ ] **步骤 1：扩展 `sensitive-mask.ts`，新增通用脱敏函数**

```ts
export function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    return sanitizeErrorMessage(error.message);
  }
  if (typeof error === "string") {
    return sanitizeErrorMessage(error);
  }
  if (error && typeof error === "object") {
    try {
      return sanitizeErrorMessage(JSON.stringify(error));
    } catch {
      return "[无法序列化的错误对象]";
    }
  }
  return "[未知错误]";
}
```

- [ ] **步骤 2：更新 `api-error.ts` 的 `handleDbError`**

```ts
import { sanitizeError, sanitizeErrorMessage } from "@/lib/sensitive-mask";

export function handleDbError(error: unknown, context: string = "操作"): NextResponse {
  console.error(`[${context}] DB error:`, sanitizeError(error));

  if (process.env.NODE_ENV === "production") {
    return apiError(`${context}失败，请稍后重试`, 500);
  }

  const message = sanitizeError(error);

  if (message.includes("Could not find the 'metadata' column") || message.includes("in the schema cache")) {
    return apiError(
      `${context}失败: 数据库表缺少 metadata 列或 PostgREST 缓存未刷新。请在 PostgreSQL 中执行 schema 迁移。`,
      500
    );
  }

  return apiError(`${context}失败: ${message}`, 500);
}
```

- [ ] **步骤 3：在 `data/reset-admin/route.ts` 避免日志打印密码**

```ts
} catch (error) {
  console.error("Reset admin error:", sanitizeError(error));
  return handleDbError(error, "重置数据");
}
```

- [ ] **步骤 4：运行类型检查**

```bash
pnpm run ts-check
```

预期：无新增错误。

- [ ] **步骤 5：Commit**

```bash
git add src/lib/sensitive-mask.ts src/lib/api-error.ts src/app/api/data/reset-admin/route.ts
git commit -m "feat: sanitize sensitive info in errors and logs"
```

---

## 任务 4：全量 lint 修复

**文件：** 20+ 个文件（详见 lint 输出）

- [ ] **步骤 1：运行 lint 并分类**

```bash
pnpm lint
```

当前主要类型：
- `@typescript-eslint/no-unused-vars`：未使用 import / 变量 / 函数
- `react-hooks/exhaustive-deps`：Hook 依赖缺失
- `@next/next/no-img-element`：建议使用 Next.js Image

- [ ] **步骤 2：修复 `no-unused-vars`**

对每个文件，删除未使用的 import 和变量。例如：

```ts
// 删除未使用的导入
import { DialogDescription, Download, UserPlus } from "lucide-react";
// => 仅保留实际使用的图标
```

对 `use-pdf-pagination.ts` 中大量未使用的常量/函数，若确认业务未使用则删除。

- [ ] **步骤 3：修复 `react-hooks/exhaustive-deps`**

对简单场景补充依赖：

```ts
useEffect(() => {
  fetchFeedback();
}, [fetchFeedback]);
```

对 `use-settings-data.ts` 等复杂 Hook，若补充依赖会导致死循环，则使用 `useRef` 或 `eslint-disable-next-line react-hooks/exhaustive-deps` 并注明原因。

- [ ] **步骤 4：修复 `no-img-element`**

若图片为 base64 / object URL，保留 `<img>` 并在上一行加：

```ts
// eslint-disable-next-line @next/next/no-img-element
<img ... />
```

否则迁移到 Next.js `<Image />`。

- [ ] **步骤 5：运行 lint 确认 0 warning**

```bash
pnpm lint
```

预期：✖ 0 problems (0 errors, 0 warnings)

- [ ] **步骤 6：Commit**

```bash
git add -A
git commit -m "style: fix all lint warnings"
```

---

## 任务 5：最终验证

**文件：** 全局

- [ ] **步骤 1：类型检查**

```bash
pnpm run ts-check
```

预期：通过。

- [ ] **步骤 2：Lint 检查**

```bash
pnpm lint
```

预期：0 errors、0 warnings。

- [ ] **步骤 3：构建检查**

```bash
pnpm run build
```

预期：构建成功。

- [ ] **步骤 4：最终 Commit**

```bash
git add -A
git commit -m "chore: final verification for Phase 2 security hardening"
```

---

## 自检

- **规格覆盖度：** 硬编码映射、输入校验、脱敏、lint 修复均有对应任务。
- **占位符扫描：** 无 TODO/待定，schema 字段与现有路由一致。
- **类型一致性：** `adminTeacherMappings` 类型为 `Record<string, string>`，与 `getAdminTeacherMappings()` 返回类型一致。
