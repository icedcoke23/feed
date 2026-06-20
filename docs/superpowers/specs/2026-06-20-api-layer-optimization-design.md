# API 层优化设计文档

> 状态：待审查  
> 目标：统一 API 层架构，移除 Supabase 残留，提升可维护性、性能与安全性。

---

## 1. 目标与范围

### 1.1 目标
- **统一数据访问**：所有 API 路由通过 Drizzle ORM 访问 PostgreSQL，彻底移除 `getServerSupabaseClient`。
- **分层架构**：引入 `Repository` + `Service` + `Route Handler` 三层，职责边界清晰。
- **统一校验**：所有路由入口使用 Zod 校验 query / body / params。
- **统一响应与错误**：复用 `api-response` / `api-error`，路由 handler 不再手动拼 `NextResponse.json`。
- **缓存加速**：对读取频繁、变更较少的配置/枚举数据引入服务端内存缓存。
- **流式大数据**：数据导出、AI 生成等接口使用 `ReadableStream`，避免内存峰值。
- **事务保护**：批量导入、数据重置等关键写操作使用 `db.transaction()`。

### 1.2 范围
- 修改/新增 `src/lib/repositories/*`、`src/lib/services/*`、`src/lib/route-handlers/*`、`src/lib/cache/*`。
- 重写/迁移以下仍依赖 Supabase 的核心文件：
  - `src/lib/route-auth.ts`
  - `src/lib/api-error.ts`
  - `src/app/api/home-data/route.ts`
- 逐步重构/瘦身所有 `src/app/api/**/route.ts`，使其仅负责：鉴权 → 校验 → 调 service → 返回响应。
- 不改动前端页面组件，只调整 API 契约（尽量保持向后兼容）。

---

## 2. 架构设计

### 2.1 分层职责

| 层级 | 职责 | 禁止做的事 |
|------|------|-----------|
| **Route Handler** | 解析请求、调用校验、调用 Service、返回响应 | 直接写 SQL / Drizzle 查询 |
| **Service** | 业务逻辑、权限检查、缓存失效、组装数据 | 直接写 SQL / Drizzle 查询 |
| **Repository** | 封装 Drizzle CRUD、查询构建、事务内的原始操作 | 处理 HTTP 请求、业务规则、权限判断 |

### 2.2 目录结构

```
src/
  lib/
    repositories/              # 数据库访问层
      index.ts                 # 统一导出
      teacher-repository.ts
      student-repository.ts
      class-repository.ts
      feedback-repository.ts
      user-repository.ts
      ai-setting-repository.ts
      tag-repository.ts
      theme-repository.ts
      course-stage-repository.ts
      course-prompt-repository.ts
      data-repository.ts       # 导入/导出专用聚合查询
    services/                  # 业务逻辑层
      index.ts
      auth-service.ts          # 鉴权相关 + token 续签
      teacher-service.ts
      student-service.ts
      class-service.ts
      feedback-service.ts
      user-service.ts
      ai-setting-service.ts
      lookup-service.ts        # tags/themes/courseStages 等缓存读取
      data-service.ts          # 导入/导出业务编排
    route-handlers/            # 路由高阶包装器
      with-auth.ts
      with-validation.ts
      with-db-error.ts
      with-logging.ts
      types.ts
    cache/                     # 缓存策略封装
      cache.ts                 # LRU 内存缓存 + 标签失效
    api-response.ts            # 已有，保持不变
    api-error.ts               # 清理 Supabase 提示，映射 Drizzle/PG 错误
    pagination.ts              # 已有，保持不变
  app/api/**/route.ts          # 仅保留薄路由
```

---

## 3. 路由包装器

### 3.1 组合方式

```ts
// app/api/students/route.ts
import { withDbError } from "@/lib/route-handlers/with-db-error";
import { withAuth } from "@/lib/route-handlers/with-auth";
import { withValidation } from "@/lib/route-handlers/with-validation";
import { listStudentsSchema } from "@/lib/validations";
import { studentService } from "@/lib/services";

export const GET = withDbError(
  withAuth(
    withValidation({ query: listStudentsSchema }, async (req, { authUser, query }) => {
      const result = await studentService.list({ user: authUser, ...query });
      return paginatedResponse(result.data, result.pagination);
    })
  )
);
```

### 3.2 包装器签名

```ts
// withAuth
export function withAuth<T>(
  handler: (req: NextRequest, ctx: { authUser: AuthUserResult }) => T | Promise<T>
): (req: NextRequest) => Promise<NextResponse>;

// withValidation
export function withValidation<T>(
  schemas: { params?: ZodSchema; query?: ZodSchema; body?: ZodSchema },
  handler: (req: NextRequest, ctx: { authUser?: AuthUserResult; params?: unknown; query?: unknown; body?: unknown }) => T | Promise<T>
): (req: NextRequest, ctx: { params?: unknown }) => Promise<T>;

// withDbError
export function withDbError<T>(
  handler: (req: NextRequest, ctx?: unknown) => Promise<T>
): (req: NextRequest, ctx?: unknown) => Promise<NextResponse>;
```

### 3.3 行为约定
- `withAuth`：未登录返回 401；token 续签时通过 `attachRenewedToken` 设置 Cookie。
- `withValidation`：校验失败返回 400，错误体包含 `error` 与 `details`（字段级）。
- `withDbError`：捕获异常，根据错误类型映射状态码与脱敏消息；生产环境不暴露内部错误。
- `withLogging`（可选）：记录请求方法、路径、耗时、错误。

---

## 4. Repository 设计

### 4.1 通用约定
- 每个 repository 导出纯函数或对象，参数使用 options 对象。
- 列表查询统一返回 `{ data, count }`，便于 Service 构造分页。
- 多表关联使用 Drizzle `with` / `relations` 或显式 `leftJoin`。
- 对敏感字段默认不返回（如 `api_key`、`password`），由 Service 按需脱敏。

### 4.2 示例：Student Repository

```ts
// src/lib/repositories/student-repository.ts
import { db } from "@/storage/database/drizzle-client";
import { students, studentClasses, classes, teachers } from "@/storage/database/shared/schema";
import { eq, inArray, and, isNull, or, desc, count } from "drizzle-orm";

export interface ListStudentsOptions {
  page: number;
  limit: number;
  isActive?: boolean;
  adminTeacherId?: string;
  classIds?: string[];
}

export async function listStudents(options: ListStudentsOptions) {
  const { page, limit, isActive, adminTeacherId, classIds } = options;
  const offset = (page - 1) * limit;

  const where = and(
    isActive !== undefined ? eq(students.isActive, isActive) : undefined,
    adminTeacherId ? eq(students.adminTeacherId, adminTeacherId) : undefined,
    classIds?.length ? inArray(students.classId, classIds) : undefined,
    or(eq(students.isActive, true), isNull(students.isActive))
  );

  const [data, totalRes] = await Promise.all([
    db.select().from(students).where(where).orderBy(desc(students.createdAt)).limit(limit).offset(offset),
    db.select({ value: count() }).from(students).where(where),
  ]);

  return { data, count: totalRes[0]?.value ?? 0 };
}

export async function findStudentById(id: string) {
  const rows = await db.select().from(students).where(eq(students.id, id)).limit(1);
  return rows[0] ?? null;
}
```

### 4.3 事务支持

```ts
export async function importDataWithTransaction(payload: ImportPayload) {
  return db.transaction(async (tx) => {
    // 使用 tx 替代 db
    await tx.insert(teachers).values(payload.teachers);
    await tx.insert(students).values(payload.students);
    // ...
  });
}
```

---

## 5. Service 设计

### 5.1 职责
- 接收 `authUser` 与业务参数。
- 校验业务权限（如教师只能看自己班级学生）。
- 调用 Repository。
- 管理缓存：读取时先查缓存，写入后失效缓存。
- 敏感数据脱敏（如 AI 配置的 `apiKey` 返回掩码）。

### 5.2 示例：Student Service

```ts
// src/lib/services/student-service.ts
import * as studentRepo from "@/lib/repositories/student-repository";
import { buildPaginationMeta } from "@/lib/pagination";
import { forbiddenError } from "@/lib/api-error";
import type { AuthUserResult } from "@/lib/route-auth";

export async function list(options: { user: AuthUserResult; page: number; limit: number }) {
  const { user, page, limit } = options;

  if (user.userRole === "admin") {
    const result = await studentRepo.listStudents({ page, limit });
    return { data: result.data, pagination: buildPaginationMeta(page, limit, result.count) };
  }

  if (user.teacherRole === "admin") {
    const result = await studentRepo.listStudents({ page, limit, adminTeacherId: user.userId });
    return { data: result.data, pagination: buildPaginationMeta(page, limit, result.count) };
  }

  // 授课老师
  const classIds = await authService.getTeacherClassIds(user.userId);
  const result = await studentRepo.listStudents({ page, limit, classIds });
  return { data: result.data, pagination: buildPaginationMeta(page, limit, result.count) };
}
```

### 5.3 缓存策略

```ts
// src/lib/cache/cache.ts
import { LRUCache } from "lru-cache";

const cache = new LRUCache<string, unknown>({ max: 500, ttl: 1000 * 60 * 5 });

export function get<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined;
}

export function set<T>(key: string, value: T, ttlMs?: number): void {
  cache.set(key, value, { ttl: ttlMs });
}

export function invalidate(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}
```

缓存范围：
- `lookup:tags`、`lookup:themes`、`lookup:course-stages`、`lookup:teachers`（轻量列表）。
- 写入对应实体后调用 `invalidate("lookup:tags")`。
- 学生/班级/反馈等高频业务数据**默认不缓存**，避免脏读；如后续需要可单独加 Redis。

---

## 6. 错误处理

### 6.1 清理 api-error.ts

- 删除所有 `Supabase`、`PostgREST`、`metadata 列`、`pgrst reload` 相关提示。
- 新增 Drizzle/PostgreSQL 常见错误映射：
  - `23505` unique violation → 409
  - `23503` foreign key violation → 400
  - `23514` check violation → 400
  - 其他 → 500（生产环境脱敏）

### 6.2 统一错误体

```json
{ "error": "错误描述", "code": "ERROR_CODE" }
```

---

## 7. 流式响应

### 7.1 数据导出

`app/api/data/export/route.ts` 使用 `ReadableStream` 分块输出 JSON：

```ts
const stream = new ReadableStream({
  async start(controller) {
    const encoder = new TextEncoder();
    controller.enqueue(encoder.encode("{\"tables\":{"));
    // 分表写入
    controller.enqueue(encoder.encode("}}"));
    controller.close();
  },
});

return new Response(stream, { headers: { "Content-Type": "application/json" } });
```

### 7.2 AI 生成

保持现有 `ReadableStream` 结构，统一封装到 `ai-client.ts`。

---

## 8. 迁移顺序

按以下顺序实施，降低风险：

1. **基础设施**：创建 `route-handlers/*`、`cache/*`、`repositories/index.ts`、清理 `api-error.ts`。
2. **核心依赖迁移**：`route-auth.ts` → Drizzle；`home-data/route.ts` → Drizzle + Service。
3. **实体 repository**：按 `teachers → classes → students → feedbacks → users → ai-settings → tags/themes/course-stages` 顺序创建。
4. **实体 service**：同上顺序，将路由中的业务逻辑下沉。
5. **路由瘦身**：逐个替换 `app/api/**/route.ts` 为薄路由 + 包装器。
6. **导入导出**：`data/import`、`data/export`、`data/full-import` 使用 transaction + stream。
7. **验证与提交**：每 1-2 个实体完成后运行 `pnpm lint` 与 `pnpm ts-check` 并提交。

---

## 9. 规格自检

- **占位符扫描**：无 TODO/待定，所有模块均有明确职责与示例。
- **内部一致性**：Repository 只访问数据库，Service 处理业务与缓存，Route Handler 只负责请求/响应，边界清晰。
- **范围检查**：本设计覆盖 API 层优化全部目标；前端页面不在范围内。
- **模糊性检查**：缓存策略明确限定为配置/枚举数据；业务数据默认不缓存。
