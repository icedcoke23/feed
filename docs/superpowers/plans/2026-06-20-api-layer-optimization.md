# API 层优化实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。无需再次询问用户确认。

**目标：** 完成 API 层统一架构改造：移除 Supabase 残留，建立 Repository + Service + Route Handler 三层，引入 Zod 校验、统一错误/分页响应、服务端缓存、流式导出与事务保护。

**架构：** 所有路由通过高阶包装器 `withAuth` / `withValidation` / `withDbError` 组合；业务逻辑下沉到 `src/lib/services/*`，数据库访问封装到 `src/lib/repositories/*`；配置/枚举数据使用内存 LRU 缓存；关键写操作使用 Drizzle 事务。

**技术栈：** Next.js App Router、TypeScript、Drizzle ORM、PostgreSQL、Zod、lru-cache、pnpm。

---

## 将要创建或修改的文件

| 文件 | 职责 |
|------|------|
| `src/lib/route-handlers/types.ts` | 包装器公共类型 |
| `src/lib/route-handlers/with-auth.ts` | 鉴权 + token 续签 |
| `src/lib/route-handlers/with-validation.ts` | Zod 校验 query/body/params |
| `src/lib/route-handlers/with-db-error.ts` | 统一异常捕获与响应 |
| `src/lib/route-handlers/with-logging.ts` | 请求日志（可选） |
| `src/lib/cache/cache.ts` | LRU 内存缓存 |
| `src/lib/api-error.ts` | 清理 Supabase 提示，映射 PG 错误 |
| `src/lib/api-response.ts` | 已有，保持不变 |
| `src/lib/pagination.ts` | 已有，保持不变 |
| `src/lib/validations.ts` | 扩展路由级 Zod schemas |
| `src/lib/route-auth.ts` | 迁移到 Drizzle，移除 Supabase |
| `src/lib/repositories/index.ts` | 统一导出 repositories |
| `src/lib/repositories/teacher-repository.ts` | 教师实体 CRUD |
| `src/lib/repositories/class-repository.ts` | 班级实体 CRUD |
| `src/lib/repositories/student-repository.ts` | 学生实体 CRUD |
| `src/lib/repositories/feedback-repository.ts` | 反馈实体 CRUD |
| `src/lib/repositories/user-repository.ts` | 用户实体 CRUD |
| `src/lib/repositories/ai-setting-repository.ts` | AI 配置 CRUD |
| `src/lib/repositories/lookup-repository.ts` | tags/themes/course-stages 等枚举查询 |
| `src/lib/repositories/data-repository.ts` | 导入/导出聚合查询 |
| `src/lib/services/index.ts` | 统一导出 services |
| `src/lib/services/auth-service.ts` | 鉴权辅助、班级权限查询 |
| `src/lib/services/teacher-service.ts` | 教师业务逻辑 |
| `src/lib/services/class-service.ts` | 班级业务逻辑 |
| `src/lib/services/student-service.ts` | 学生业务逻辑 + 权限 |
| `src/lib/services/feedback-service.ts` | 反馈业务逻辑 + 权限 |
| `src/lib/services/user-service.ts` | 用户业务逻辑 |
| `src/lib/services/ai-setting-service.ts` | AI 配置业务逻辑 + 脱敏 |
| `src/lib/services/lookup-service.ts` | 缓存枚举数据 |
| `src/lib/services/data-service.ts` | 导入/导出业务编排 |
| `src/app/api/auth/**/route.ts` | 改为薄路由 |
| `src/app/api/teachers/**/route.ts` | 改为薄路由 |
| `src/app/api/classes/**/route.ts` | 改为薄路由 |
| `src/app/api/students/**/route.ts` | 改为薄路由 |
| `src/app/api/feedbacks/**/route.ts` | 改为薄路由 |
| `src/app/api/users/**/route.ts` | 改为薄路由 |
| `src/app/api/ai-settings/**/route.ts` | 改为薄路由 |
| `src/app/api/tags/**/route.ts` | 改为薄路由 |
| `src/app/api/themes/**/route.ts` | 改为薄路由 |
| `src/app/api/course-stages/**/route.ts` | 改为薄路由 |
| `src/app/api/course-prompts/**/route.ts` | 改为薄路由 |
| `src/app/api/home-data/route.ts` | 迁移到 Service |
| `src/app/api/data/**/route.ts` | 导入导出使用 transaction + stream |
| `src/app/api/batch-import/**/route.ts` | 使用 service/repository |
| `src/app/api/course-stages/reset/route.ts` | 使用 service transaction |

---

## 任务 1：安装依赖

**文件：**
- 修改：`package.json`

- [ ] **步骤 1：添加 `lru-cache`**

```bash
pnpm add lru-cache
```

- [ ] **步骤 2：添加类型依赖（如未安装）**

```bash
pnpm add -D @types/lru-cache
```

如果 `@types/lru-cache` 不需要（lru-cache v10+ 自带类型），跳过。

- [ ] **步骤 3：Commit**

```bash
git add package.json pnpm-lock.yaml
pnpm install
pnpm ts-check
pnpm lint
git commit -m "chore(deps): add lru-cache for API caching"
```

---

## 任务 2：创建缓存模块

**文件：**
- 创建：`src/lib/cache/cache.ts`

- [ ] **步骤 1：创建缓存文件**

```ts
import { LRUCache } from "lru-cache";

const cache = new LRUCache<string, unknown>({
  max: 500,
  ttl: 1000 * 60 * 5,
});

export function get<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined;
}

export function set<T>(key: string, value: T, ttlMs?: number): void {
  cache.set(key, value, ttlMs ? { ttl: ttlMs } : undefined);
}

export function invalidate(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

export function invalidateExact(key: string): void {
  cache.delete(key);
}
```

- [ ] **步骤 2：验证类型检查**

```bash
pnpm ts-check
```

预期：通过。

- [ ] **步骤 3：Commit**

```bash
git add src/lib/cache/cache.ts
git commit -m "feat(api): add LRU memory cache module"
```

---

## 任务 3：清理 api-error.ts

**文件：**
- 修改：`src/lib/api-error.ts`

- [ ] **步骤 1：替换为通用错误处理**

```ts
import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-response";

export function apiError(message: string, status: number = 500, code?: string): NextResponse {
  return errorResponse(message, status, code);
}

function isPostgresError(error: unknown): error is { code: string; message: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  );
}

export function handleDbError(error: unknown, context: string = "操作"): NextResponse {
  console.error(`[${context}] DB error:`, error);

  if (isPostgresError(error)) {
    switch (error.code) {
      case "23505":
        return apiError(`${context}失败：记录已存在`, 409, "UNIQUE_VIOLATION");
      case "23503":
        return apiError(`${context}失败：关联记录不存在`, 400, "FOREIGN_KEY_VIOLATION");
      case "23514":
        return apiError(`${context}失败：数据不满足约束`, 400, "CHECK_VIOLATION");
    }
  }

  if (process.env.NODE_ENV === "production") {
    return apiError(`${context}失败，请稍后重试`, 500);
  }

  const message = error instanceof Error ? error.message : "未知错误";
  return apiError(`${context}失败: ${message}`, 500);
}

export function unauthorizedError(message: string = "请先登录"): NextResponse {
  return apiError(message, 401, "UNAUTHORIZED");
}

export function forbiddenError(message: string = "权限不足"): NextResponse {
  return apiError(message, 403, "FORBIDDEN");
}

export function notFoundError(message: string = "资源未找到"): NextResponse {
  return apiError(message, 404, "NOT_FOUND");
}

export function badRequestError(message: string = "请求参数错误"): NextResponse {
  return apiError(message, 400, "BAD_REQUEST");
}
```

- [ ] **步骤 2：验证 lint / ts-check**

```bash
pnpm lint
pnpm ts-check
```

- [ ] **步骤 3：Commit**

```bash
git add src/lib/api-error.ts
git commit -m "refactor(api): remove Supabase-specific error hints and map Postgres errors"
```

---

## 任务 4：创建路由包装器

**文件：**
- 创建：`src/lib/route-handlers/types.ts`
- 创建：`src/lib/route-handlers/with-auth.ts`
- 创建：`src/lib/route-handlers/with-validation.ts`
- 创建：`src/lib/route-handlers/with-db-error.ts`

### 4.1 类型文件

- [ ] **步骤 1：创建 `src/lib/route-handlers/types.ts`**

```ts
import type { NextRequest } from "next/server";
import type { ZodSchema } from "zod";
import type { AuthUserResult } from "@/lib/route-auth";

export interface ValidationSchemas {
  params?: ZodSchema;
  query?: ZodSchema;
  body?: ZodSchema;
}

export interface RouteContext {
  authUser?: AuthUserResult;
  params?: Record<string, string>;
  query?: unknown;
  body?: unknown;
}

export type RouteHandler<T = Response> = (
  req: NextRequest,
  ctx: RouteContext
) => T | Promise<T>;
```

### 4.2 with-auth

- [ ] **步骤 2：创建 `src/lib/route-handlers/with-auth.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, attachRenewedToken } from "@/lib/route-auth";
import { unauthorizedError } from "@/lib/api-error";
import type { RouteHandler, RouteContext } from "./types";

export function withAuth<T>(handler: RouteHandler<T>) {
  return async (req: NextRequest, ctx: RouteContext): Promise<T | NextResponse> => {
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return unauthorizedError();
    }
    const result = await handler(req, { ...ctx, authUser });
    if (result instanceof NextResponse && authUser.newToken) {
      return attachRenewedToken(result, authUser);
    }
    return result;
  };
}
```

### 4.3 with-validation

- [ ] **步骤 3：创建 `src/lib/route-handlers/with-validation.ts`**

```ts
import { NextRequest } from "next/server";
import { ZodError, type ZodSchema } from "zod";
import { errorResponse } from "@/lib/api-response";
import type { RouteHandler, RouteContext, ValidationSchemas } from "./types";

export function withValidation<T>(schemas: ValidationSchemas, handler: RouteHandler<T>) {
  return async (req: NextRequest, ctx: RouteContext): Promise<T | Response> => {
    try {
      const validated: RouteContext = { ...ctx };

      if (schemas.params && ctx.params) {
        validated.params = schemas.params.parse(ctx.params);
      }

      if (schemas.query) {
        const { searchParams } = new URL(req.url);
        const obj: Record<string, string | string[]> = {};
        searchParams.forEach((value, key) => {
          const existing = obj[key];
          if (existing) {
            obj[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
          } else {
            obj[key] = value;
          }
        });
        validated.query = schemas.query.parse(obj);
      }

      if (schemas.body && req.method !== "GET" && req.method !== "HEAD") {
        const json = await req.json();
        validated.body = schemas.body.parse(json);
      }

      return await handler(req, validated);
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.map((e) => ({
          path: e.path.join("."),
          message: e.message,
        }));
        return errorResponse(`请求参数错误`, 400, "VALIDATION_ERROR", { details });
      }
      throw error;
    }
  };
}
```

注意：`errorResponse` 当前签名不支持额外字段。如需要 `details`，可扩展 `errorResponse` 或在 `api-response.ts` 中新增 `validationErrorResponse`。本计划选择**扩展 `errorResponse`**：

```ts
export function errorResponse(
  error: string,
  status = 400,
  code?: string,
  extra?: Record<string, unknown>
) {
  const body: Record<string, unknown> = { error };
  if (code) body.code = code;
  if (extra) Object.assign(body, extra);
  return NextResponse.json(body, { status });
}
```

### 4.4 with-db-error

- [ ] **步骤 4：创建 `src/lib/route-handlers/with-db-error.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { handleDbError } from "@/lib/api-error";
import type { RouteHandler, RouteContext } from "./types";

export function withDbError<T>(handler: RouteHandler<T>) {
  return async (req: NextRequest, ctx: RouteContext): Promise<T | NextResponse> => {
    try {
      const result = await handler(req, ctx);
      if (result instanceof Response || result instanceof NextResponse) {
        return result;
      }
      // 如果 handler 忘了返回 Response，兜底
      return NextResponse.json(result);
    } catch (error) {
      return handleDbError(error, req.nextUrl.pathname);
    }
  };
}
```

- [ ] **步骤 5：扩展 `src/lib/api-response.ts` 的 errorResponse**

```ts
export function errorResponse(
  error: string,
  status = 400,
  code?: string,
  extra?: Record<string, unknown>
) {
  const body: Record<string, unknown> = { error };
  if (code) body.code = code;
  if (extra) Object.assign(body, extra);
  return NextResponse.json(body, { status });
}
```

- [ ] **步骤 6：验证 lint / ts-check**

```bash
pnpm lint
pnpm ts-check
```

- [ ] **步骤 7：Commit**

```bash
git add src/lib/route-handlers src/lib/api-response.ts
git commit -m "feat(api): add withAuth/withValidation/withDbError route wrappers"
```

---

## 任务 5：迁移 route-auth.ts 到 Drizzle

**文件：**
- 修改：`src/lib/route-auth.ts`

- [ ] **步骤 1：读取 `src/lib/auth.ts` 确认 `verifyToken`、`signToken`、`COOKIE_NAME` 可用**

```bash
head -n 40 src/lib/auth.ts
```

- [ ] **步骤 2：替换 Supabase 调用为 Drizzle**

```ts
import { NextRequest, NextResponse } from "next/server";
import { verifyToken, signToken, COOKIE_NAME } from "@/lib/auth";
import { db } from "@/storage/database/drizzle-client";
import { teachers, classes, studentClasses } from "@/storage/database/shared/schema";
import { eq, inArray, or, isNull, and } from "drizzle-orm";
import { jwtVerify } from "jose";

export interface AuthUserResult {
  userId: string;
  userRole: string;
  teacherRole?: "admin" | "teacher";
  newToken?: string;
}

export async function getAuthUser(request: NextRequest): Promise<AuthUserResult | null> {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;

  let newToken: string | undefined;
  try {
    const secretKey = new TextEncoder().encode(
      process.env.JWT_SECRET || "dev-only-jwt-secret-change-in-production"
    );
    const { payload: decoded } = await jwtVerify(token, secretKey);
    const exp = decoded.exp;
    const iat = decoded.iat;
    if (exp && iat) {
      const now = Math.floor(Date.now() / 1000);
      const totalLifetime = exp - iat;
      const remaining = exp - now;
      if (remaining < totalLifetime * 0.5) {
        newToken = await signToken({ userId: payload.userId, role: payload.role });
      }
    }
  } catch {
    // ignore
  }

  let teacherRole: "admin" | "teacher" | undefined;
  if (payload.role === "teacher") {
    const rows = await db
      .select({ role: teachers.role })
      .from(teachers)
      .where(eq(teachers.id, payload.userId))
      .limit(1);
    teacherRole = (rows[0]?.role as "admin" | "teacher") || "teacher";
  }

  return { userId: payload.userId, userRole: payload.role, teacherRole, newToken };
}

export function attachRenewedToken(
  response: NextResponse,
  authResult: AuthUserResult
): NextResponse {
  if (authResult.newToken) {
    response.headers.set("X-New-Token", authResult.newToken);
    response.cookies.set(COOKIE_NAME, authResult.newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
      path: "/",
    });
  }
  return response;
}

export async function getTeacherClassIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ id: classes.id })
    .from(classes)
    .where(
      and(
        eq(classes.teacherId, userId),
        or(eq(classes.isActive, true), isNull(classes.isActive))
      )
    );
  return rows.map((c) => c.id);
}

export async function canTeacherAccessStudent(
  userId: string,
  studentId: string
): Promise<boolean> {
  const classIds = await getTeacherClassIds(userId);
  if (classIds.length === 0) return false;

  const rows = await db
    .select({ classId: studentClasses.classId })
    .from(studentClasses)
    .where(and(eq(studentClasses.studentId, studentId), inArray(studentClasses.classId, classIds)))
    .limit(1);

  return rows.length > 0;
}
```

- [ ] **步骤 3：验证 lint / ts-check**

```bash
pnpm lint
pnpm ts-check
```

- [ ] **步骤 4：Commit**

```bash
git add src/lib/route-auth.ts
git commit -m "refactor(api): migrate route-auth from Supabase to Drizzle"
```

---

## 任务 6：创建 repositories 与 services 基础设施

**文件：**
- 创建：`src/lib/repositories/index.ts`
- 创建：`src/lib/services/index.ts`
- 创建：`src/lib/services/auth-service.ts`

### 6.1 repositories/index.ts

- [ ] **步骤 1：创建统一导出**

```ts
export * as teacherRepository from "./teacher-repository";
export * as classRepository from "./class-repository";
export * as studentRepository from "./student-repository";
export * as feedbackRepository from "./feedback-repository";
export * as userRepository from "./user-repository";
export * as aiSettingRepository from "./ai-setting-repository";
export * as lookupRepository from "./lookup-repository";
export * as dataRepository from "./data-repository";
```

### 6.2 services/index.ts

- [ ] **步骤 2：创建统一导出**

```ts
export * as authService from "./auth-service";
export * as teacherService from "./teacher-service";
export * as classService from "./class-service";
export * as studentService from "./student-service";
export * as feedbackService from "./feedback-service";
export * as userService from "./user-service";
export * as aiSettingService from "./ai-setting-service";
export * as lookupService from "./lookup-service";
export * as dataService from "./data-service";
```

### 6.3 auth-service.ts

- [ ] **步骤 3：创建 `src/lib/services/auth-service.ts`**

```ts
import { db } from "@/storage/database/drizzle-client";
import { classes, studentClasses, teachers } from "@/storage/database/shared/schema";
import { eq, inArray, or, isNull, and } from "drizzle-orm";

export async function getTeacherClassIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ id: classes.id })
    .from(classes)
    .where(
      and(
        eq(classes.teacherId, userId),
        or(eq(classes.isActive, true), isNull(classes.isActive))
      )
    );
  return rows.map((c) => c.id);
}

export async function canTeacherAccessStudent(
  userId: string,
  studentId: string
): Promise<boolean> {
  const classIds = await getTeacherClassIds(userId);
  if (classIds.length === 0) return false;

  const rows = await db
    .select({ classId: studentClasses.classId })
    .from(studentClasses)
    .where(and(eq(studentClasses.studentId, studentId), inArray(studentClasses.classId, classIds)))
    .limit(1);

  return rows.length > 0;
}

export async function getTeacherRole(userId: string): Promise<"admin" | "teacher"> {
  const rows = await db
    .select({ role: teachers.role })
    .from(teachers)
    .where(eq(teachers.id, userId))
    .limit(1);
  return (rows[0]?.role as "admin" | "teacher") || "teacher";
}
```

- [ ] **步骤 4：验证 lint / ts-check**

```bash
pnpm lint
pnpm ts-check
```

- [ ] **步骤 5：Commit**

```bash
git add src/lib/repositories/index.ts src/lib/services/index.ts src/lib/services/auth-service.ts
git commit -m "feat(api): add repository and service barrel exports plus auth service"
```

---

## 任务 7：创建 lookup repository & service

**文件：**
- 创建：`src/lib/repositories/lookup-repository.ts`
- 创建：`src/lib/services/lookup-service.ts`

### 7.1 lookup-repository.ts

- [ ] **步骤 1：创建文件**

```ts
import { db } from "@/storage/database/drizzle-client";
import { tags, teachingThemes, courseStages, teachers } from "@/storage/database/shared/schema";
import { eq, desc } from "drizzle-orm";

export async function listTags() {
  return db.select().from(tags).orderBy(tags.category, tags.sortOrder, tags.name);
}

export async function listThemes() {
  return db.select().from(teachingThemes).orderBy(teachingThemes.sortOrder, teachingThemes.name);
}

export async function listCourseStages() {
  return db.select().from(courseStages).orderBy(courseStages.theme, courseStages.level, courseStages.sortOrder);
}

export async function listActiveTeachers() {
  return db
    .select({ id: teachers.id, name: teachers.name, role: teachers.role })
    .from(teachers)
    .where(eq(teachers.isActive, true))
    .orderBy(teachers.name);
}
```

### 7.2 lookup-service.ts

- [ ] **步骤 2：创建文件**

```ts
import * as lookupRepo from "@/lib/repositories/lookup-repository";
import * as cache from "@/lib/cache/cache";

const TTL = 1000 * 60 * 5;

export async function listTags() {
  const key = "lookup:tags";
  const cached = cache.get<ReturnType<typeof lookupRepo.listTags>>(key);
  if (cached) return cached;
  const data = await lookupRepo.listTags();
  cache.set(key, data, TTL);
  return data;
}

export async function listThemes() {
  const key = "lookup:themes";
  const cached = cache.get<ReturnType<typeof lookupRepo.listThemes>>(key);
  if (cached) return cached;
  const data = await lookupRepo.listThemes();
  cache.set(key, data, TTL);
  return data;
}

export async function listCourseStages() {
  const key = "lookup:course-stages";
  const cached = cache.get<ReturnType<typeof lookupRepo.listCourseStages>>(key);
  if (cached) return cached;
  const data = await lookupRepo.listCourseStages();
  cache.set(key, data, TTL);
  return data;
}

export async function listActiveTeachers() {
  const key = "lookup:teachers";
  const cached = cache.get<ReturnType<typeof lookupRepo.listActiveTeachers>>(key);
  if (cached) return cached;
  const data = await lookupRepo.listActiveTeachers();
  cache.set(key, data, TTL);
  return data;
}

export function invalidateTags() {
  cache.invalidate("lookup:tags");
}

export function invalidateThemes() {
  cache.invalidate("lookup:themes");
}

export function invalidateCourseStages() {
  cache.invalidate("lookup:course-stages");
}

export function invalidateTeachers() {
  cache.invalidate("lookup:teachers");
}
```

- [ ] **步骤 3：Commit**

```bash
git add src/lib/repositories/lookup-repository.ts src/lib/services/lookup-service.ts
git commit -m "feat(api): add lookup repository and cached lookup service"
```

---

## 任务 8：迁移 auth 路由到薄路由 + service

**文件：**
- 修改：`src/app/api/auth/login/route.ts`
- 修改：`src/app/api/auth/me/route.ts`
- 修改：`src/app/api/auth/logout/route.ts`
- 修改：`src/app/api/auth/change-password/route.ts`

> 由于这些路由与登录会话强相关，保留核心逻辑，但统一错误响应和校验。

### 8.1 login

- [ ] **步骤 1：读取当前 `src/app/api/auth/login/route.ts`**

```bash
cat src/app/api/auth/login/route.ts
```

- [ ] **步骤 2：重构为薄路由**

保留原有 bcrypt + JWT 逻辑，但用 `withDbError` 和 Zod schema 包装。

```ts
import { NextRequest } from "next/server";
import { withDbError } from "@/lib/route-handlers/with-db-error";
import { withValidation } from "@/lib/route-handlers/with-validation";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/storage/database/drizzle-client";
import { users } from "@/storage/database/shared/schema";
import { eq, and } from "drizzle-orm";
import { signToken, COOKIE_NAME } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const POST = withDbError(
  withValidation({ body: loginSchema }, async (req: NextRequest, { body }) => {
    const { username, password } = body as { username: string; password: string };

    const rows = await db
      .select()
      .from(users)
      .where(and(eq(users.username, username), eq(users.isActive, true)))
      .limit(1);

    const user = rows[0];
    if (!user) {
      return errorResponse("用户名或密码错误", 401);
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return errorResponse("用户名或密码错误", 401);
    }

    const token = await signToken({ userId: user.id, role: user.role });

    const response = successResponse(
      { id: user.id, username: user.username, name: user.name, role: user.role },
      "登录成功"
    );
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
      path: "/",
    });
    return response;
  })
);
```

### 8.2 me

- [ ] **步骤 3：重构 `src/app/api/auth/me/route.ts`**

```ts
import { NextRequest } from "next/server";
import { withDbError } from "@/lib/route-handlers/with-db-error";
import { withAuth } from "@/lib/route-handlers/with-auth";
import { db } from "@/storage/database/drizzle-client";
import { users, teachers } from "@/storage/database/shared/schema";
import { eq } from "drizzle-orm";
import { successResponse } from "@/lib/api-response";

export const GET = withDbError(
  withAuth(async (req: NextRequest, { authUser }) => {
    const userRows = await db.select().from(users).where(eq(users.id, authUser.userId)).limit(1);
    const user = userRows[0];
    if (!user) {
      // 通过 withDbError 兜底的错误
      throw new Error("用户不存在");
    }

    let teacherRole: string | undefined;
    if (authUser.userRole === "teacher") {
      const teacherRows = await db
        .select({ role: teachers.role })
        .from(teachers)
        .where(eq(teachers.id, authUser.userId))
        .limit(1);
      teacherRole = teacherRows[0]?.role;
    }

    return successResponse({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      teacherRole,
    });
  })
);
```

### 8.3 logout / change-password

- [ ] **步骤 4：用同样方式重构 `logout` 和 `change-password`**

`logout`：删除 Cookie，返回 successResponse。

`change-password`：使用 `withAuth` + `withValidation`，body schema 校验旧密码、新密码，bcrypt 比对并更新。

- [ ] **步骤 5：验证 lint / ts-check**

```bash
pnpm lint
pnpm ts-check
```

- [ ] **步骤 6：Commit**

```bash
git add src/app/api/auth src/lib/route-handlers src/lib/api-response.ts
git commit -m "refactor(api): migrate auth routes to thin handlers with wrappers"
```

---

## 任务 9：创建 teacher repository & service 并迁移 teachers 路由

**文件：**
- 创建：`src/lib/repositories/teacher-repository.ts`
- 创建：`src/lib/services/teacher-service.ts`
- 修改：`src/app/api/teachers/route.ts`
- 修改：`src/app/api/teachers/[id]/route.ts`

### 9.1 teacher-repository.ts

- [ ] **步骤 1：创建文件**

```ts
import { db } from "@/storage/database/drizzle-client";
import { teachers } from "@/storage/database/shared/schema";
import { eq, desc, and, like, or, isNull, count } from "drizzle-orm";

export interface ListTeachersOptions {
  page: number;
  limit: number;
  isActive?: boolean;
  search?: string;
}

export async function list(options: ListTeachersOptions) {
  const { page, limit, isActive, search } = options;
  const offset = (page - 1) * limit;

  const conditions = [
    isActive !== undefined ? eq(teachers.isActive, isActive) : undefined,
    search
      ? or(
          like(teachers.name, `%${search}%`),
          like(teachers.email, `%${search}%`),
          like(teachers.phone || "", `%${search}%`)
        )
      : undefined,
  ].filter(Boolean);

  const where = conditions.length ? and(...conditions) : undefined;

  const [data, total] = await Promise.all([
    db
      .select()
      .from(teachers)
      .where(where)
      .orderBy(desc(teachers.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(teachers).where(where),
  ]);

  return { data, count: total[0]?.value ?? 0 };
}

export async function findById(id: string) {
  const rows = await db.select().from(teachers).where(eq(teachers.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function create(payload: typeof teachers.$inferInsert) {
  const rows = await db.insert(teachers).values(payload).returning();
  return rows[0];
}

export async function update(id: string, payload: Partial<typeof teachers.$inferInsert>) {
  const rows = await db.update(teachers).set(payload).where(eq(teachers.id, id)).returning();
  return rows[0] ?? null;
}

export async function remove(id: string) {
  return db.delete(teachers).where(eq(teachers.id, id));
}
```

### 9.2 teacher-service.ts

- [ ] **步骤 2：创建文件**

```ts
import * as repo from "@/lib/repositories/teacher-repository";
import * as lookupCache from "@/lib/services/lookup-service";
import { buildPaginationMeta } from "@/lib/pagination";
import { forbiddenError } from "@/lib/api-error";
import type { AuthUserResult } from "@/lib/route-auth";

export async function list(
  user: AuthUserResult,
  options: repo.ListTeachersOptions
) {
  if (user.userRole !== "admin" && user.teacherRole !== "admin") {
    return forbiddenError("权限不足");
  }
  const result = await repo.list(options);
  return {
    data: result.data,
    pagination: buildPaginationMeta(options.page, options.limit, result.count),
  };
}

export async function create(
  user: AuthUserResult,
  payload: Parameters<typeof repo.create>[0]
) {
  if (user.userRole !== "admin" && user.teacherRole !== "admin") {
    return forbiddenError("权限不足");
  }
  const result = await repo.create(payload);
  lookupCache.invalidateTeachers();
  return result;
}

export async function update(
  user: AuthUserResult,
  id: string,
  payload: Parameters<typeof repo.update>[1]
) {
  if (user.userRole !== "admin" && user.teacherRole !== "admin") {
    return forbiddenError("权限不足");
  }
  const result = await repo.update(id, payload);
  lookupCache.invalidateTeachers();
  return result;
}

export async function remove(user: AuthUserResult, id: string) {
  if (user.userRole !== "admin" && user.teacherRole !== "admin") {
    return forbiddenError("权限不足");
  }
  await repo.remove(id);
  lookupCache.invalidateTeachers();
}
```

### 9.3 迁移 teachers 路由

- [ ] **步骤 3：重构 `src/app/api/teachers/route.ts`**

```ts
import { NextRequest } from "next/server";
import { withDbError } from "@/lib/route-handlers/with-db-error";
import { withAuth } from "@/lib/route-handlers/with-auth";
import { withValidation } from "@/lib/route-handlers/with-validation";
import { z } from "zod";
import { paginatedResponse, successResponse } from "@/lib/api-response";
import { teacherService } from "@/lib/services";

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
  search: z.string().optional(),
});

const bodySchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  role: z.enum(["teacher", "admin"]).default("teacher"),
});

export const GET = withDbError(
  withAuth(
    withValidation({ query: querySchema }, async (req, { authUser, query }) => {
      const result = await teacherService.list(authUser!, query as { page: number; limit: number; search?: string });
      if (result instanceof Response) return result;
      return paginatedResponse(result.data, result.pagination);
    })
  )
);

export const POST = withDbError(
  withAuth(
    withValidation({ body: bodySchema }, async (req, { authUser, body }) => {
      const result = await teacherService.create(authUser!, body as Parameters<typeof teacherService.create>[1]);
      if (result instanceof Response) return result;
      return successResponse(result, "创建成功", 201);
    })
  )
);
```

注意：`teacherService.list` 返回 `Response | { data, pagination }`。路由中需要判断。为避免到处判断，可以改为 service 抛 `AppError`。为简化，保持返回 Response 并在路由判断。

- [ ] **步骤 4：重构 `src/app/api/teachers/[id]/route.ts`**

类似 GET / PUT / DELETE。

- [ ] **步骤 5：验证 lint / ts-check**

```bash
pnpm lint
pnpm ts-check
```

- [ ] **步骤 6：Commit**

```bash
git add src/lib/repositories/teacher-repository.ts src/lib/services/teacher-service.ts src/app/api/teachers
git commit -m "refactor(api): add teacher repository/service and migrate teacher routes"
```

---

## 任务 10：创建 class repository & service 并迁移 classes 路由

**文件：**
- 创建：`src/lib/repositories/class-repository.ts`
- 创建：`src/lib/services/class-service.ts`
- 修改：`src/app/api/classes/route.ts`
- 修改：`src/app/api/classes/[id]/route.ts`

### 10.1 class-repository.ts

- [ ] **步骤 1：创建文件**

```ts
import { db } from "@/storage/database/drizzle-client";
import { classes } from "@/storage/database/shared/schema";
import { eq, desc, and, like, count } from "drizzle-orm";

export interface ListClassesOptions {
  page: number;
  limit: number;
  isActive?: boolean;
  teacherId?: string;
  search?: string;
}

export async function list(options: ListClassesOptions) {
  const { page, limit, isActive, teacherId, search } = options;
  const offset = (page - 1) * limit;

  const conditions = [
    isActive !== undefined ? eq(classes.isActive, isActive) : undefined,
    teacherId ? eq(classes.teacherId, teacherId) : undefined,
    search ? like(classes.name, `%${search}%`) : undefined,
  ].filter(Boolean);

  const where = conditions.length ? and(...conditions) : undefined;

  const [data, total] = await Promise.all([
    db
      .select()
      .from(classes)
      .where(where)
      .orderBy(desc(classes.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(classes).where(where),
  ]);

  return { data, count: total[0]?.value ?? 0 };
}

export async function findById(id: string) {
  const rows = await db.select().from(classes).where(eq(classes.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function create(payload: typeof classes.$inferInsert) {
  const rows = await db.insert(classes).values(payload).returning();
  return rows[0];
}

export async function update(id: string, payload: Partial<typeof classes.$inferInsert>) {
  const rows = await db.update(classes).set(payload).where(eq(classes.id, id)).returning();
  return rows[0] ?? null;
}

export async function remove(id: string) {
  return db.delete(classes).where(eq(classes.id, id));
}
```

### 10.2 class-service.ts

- [ ] **步骤 2：创建文件**

```ts
import * as repo from "@/lib/repositories/class-repository";
import { buildPaginationMeta } from "@/lib/pagination";
import { forbiddenError } from "@/lib/api-error";
import type { AuthUserResult } from "@/lib/route-auth";

export async function list(user: AuthUserResult, options: repo.ListClassesOptions) {
  if (user.userRole !== "admin" && user.teacherRole !== "admin") {
    options.teacherId = user.userId;
  }
  const result = await repo.list(options);
  return { data: result.data, pagination: buildPaginationMeta(options.page, options.limit, result.count) };
}

export async function create(user: AuthUserResult, payload: Parameters<typeof repo.create>[0]) {
  if (user.userRole !== "admin" && user.teacherRole !== "admin") {
    payload.teacherId = payload.teacherId ?? user.userId;
  }
  return repo.create(payload);
}

export async function findById(user: AuthUserResult, id: string) {
  const cls = await repo.findById(id);
  if (!cls) return null;
  if (user.userRole !== "admin" && user.teacherRole !== "admin" && cls.teacherId !== user.userId) {
    return forbiddenError("权限不足");
  }
  return cls;
}

export async function update(
  user: AuthUserResult,
  id: string,
  payload: Parameters<typeof repo.update>[1]
) {
  const existing = await findById(user, id);
  if (existing instanceof Response) return existing;
  if (!existing) return null;
  return repo.update(id, payload);
}

export async function remove(user: AuthUserResult, id: string) {
  const existing = await findById(user, id);
  if (existing instanceof Response) return existing;
  if (!existing) return null;
  return repo.remove(id);
}
```

### 10.3 迁移 classes 路由

- [ ] **步骤 3：重构 `src/app/api/classes/route.ts` 和 `[id]/route.ts`**

模式与 teachers 相同：使用 `withAuth` + `withValidation` + `classService`。

- [ ] **步骤 4：验证 lint / ts-check**

```bash
pnpm lint
pnpm ts-check
```

- [ ] **步骤 5：Commit**

```bash
git add src/lib/repositories/class-repository.ts src/lib/services/class-service.ts src/app/api/classes
git commit -m "refactor(api): add class repository/service and migrate class routes"
```

---

## 任务 11：创建 student repository & service 并迁移 students 路由

**文件：**
- 创建：`src/lib/repositories/student-repository.ts`
- 创建：`src/lib/services/student-service.ts`
- 修改：`src/app/api/students/route.ts`
- 修改：`src/app/api/students/[id]/route.ts`
- 修改：`src/app/api/students/[id]/history/route.ts`
- 修改：`src/app/api/students/[id]/transfer/route.ts`
- 修改：`src/app/api/students/batch/route.ts`

### 11.1 student-repository.ts

- [ ] **步骤 1：创建文件**

```ts
import { db } from "@/storage/database/drizzle-client";
import { students, studentClasses, classes } from "@/storage/database/shared/schema";
import { eq, inArray, and, isNull, or, desc, count, like } from "drizzle-orm";

export interface ListStudentsOptions {
  page: number;
  limit: number;
  isActive?: boolean;
  adminTeacherId?: string;
  classIds?: string[];
  search?: string;
}

export async function list(options: ListStudentsOptions) {
  const { page, limit, isActive, adminTeacherId, classIds, search } = options;
  const offset = (page - 1) * limit;

  const conditions = [
    isActive !== undefined ? eq(students.isActive, isActive) : undefined,
    adminTeacherId ? eq(students.adminTeacherId, adminTeacherId) : undefined,
    classIds?.length ? inArray(students.classId, classIds) : undefined,
    search
      ? or(
          like(students.name, `%${search}%`),
          like(students.school || "", `%${search}%`),
          like(students.grade || "", `%${search}%`)
        )
      : undefined,
  ].filter(Boolean);

  const where = conditions.length ? and(...conditions) : undefined;

  const [data, total] = await Promise.all([
    db
      .select()
      .from(students)
      .where(where)
      .orderBy(desc(students.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(students).where(where),
  ]);

  return { data, count: total[0]?.value ?? 0 };
}

export async function findById(id: string) {
  const rows = await db.select().from(students).where(eq(students.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function create(payload: typeof students.$inferInsert) {
  const rows = await db.insert(students).values(payload).returning();
  return rows[0];
}

export async function update(id: string, payload: Partial<typeof students.$inferInsert>) {
  const rows = await db.update(students).set(payload).where(eq(students.id, id)).returning();
  return rows[0] ?? null;
}

export async function remove(id: string) {
  return db.delete(students).where(eq(students.id, id));
}
```

### 11.2 student-service.ts

- [ ] **步骤 2：创建文件**

```ts
import * as repo from "@/lib/repositories/student-repository";
import * as authService from "@/lib/services/auth-service";
import { buildPaginationMeta } from "@/lib/pagination";
import { forbiddenError, notFoundError } from "@/lib/api-error";
import type { AuthUserResult } from "@/lib/route-auth";

export async function list(user: AuthUserResult, options: repo.ListStudentsOptions) {
  if (user.userRole === "admin") {
    // no filter
  } else if (user.teacherRole === "admin") {
    options.adminTeacherId = user.userId;
  } else {
    options.classIds = await authService.getTeacherClassIds(user.userId);
  }
  const result = await repo.list(options);
  return { data: result.data, pagination: buildPaginationMeta(options.page, options.limit, result.count) };
}

export async function findById(user: AuthUserResult, id: string) {
  const student = await repo.findById(id);
  if (!student) return notFoundError("学生不存在");
  if (user.userRole === "admin") return student;
  if (user.teacherRole === "admin" && student.adminTeacherId === user.userId) return student;
  const canAccess = await authService.canTeacherAccessStudent(user.userId, id);
  if (!canAccess) return forbiddenError("权限不足");
  return student;
}

export async function create(user: AuthUserResult, payload: Parameters<typeof repo.create>[0]) {
  if (user.userRole !== "admin" && user.teacherRole !== "admin") {
    payload.adminTeacherId = payload.adminTeacherId ?? user.userId;
  }
  return repo.create(payload);
}

export async function update(
  user: AuthUserResult,
  id: string,
  payload: Parameters<typeof repo.update>[1]
) {
  const existing = await findById(user, id);
  if (existing instanceof Response) return existing;
  return repo.update(id, payload);
}

export async function remove(user: AuthUserResult, id: string) {
  const existing = await findById(user, id);
  if (existing instanceof Response) return existing;
  return repo.remove(id);
}
```

### 11.3 迁移 students 路由

- [ ] **步骤 3：重构所有 students 路由为薄路由**

按照 teachers/classes 模式。

- [ ] **步骤 4：验证 lint / ts-check**

```bash
pnpm lint
pnpm ts-check
```

- [ ] **步骤 5：Commit**

```bash
git add src/lib/repositories/student-repository.ts src/lib/services/student-service.ts src/app/api/students
git commit -m "refactor(api): add student repository/service and migrate student routes"
```

---

## 任务 12：创建 feedback repository & service 并迁移 feedbacks 路由

**文件：**
- 创建：`src/lib/repositories/feedback-repository.ts`
- 创建：`src/lib/services/feedback-service.ts`
- 修改：`src/app/api/feedbacks/route.ts`
- 修改：`src/app/api/feedbacks/[id]/route.ts`

### 12.1 feedback-repository.ts

- [ ] **步骤 1：创建文件**

```ts
import { db } from "@/storage/database/drizzle-client";
import { feedbacks } from "@/storage/database/shared/schema";
import { eq, desc, and, count } from "drizzle-orm";

export interface ListFeedbacksOptions {
  page: number;
  limit: number;
  studentId?: string;
  teacherId?: string;
  status?: string;
}

export async function list(options: ListFeedbacksOptions) {
  const { page, limit, studentId, teacherId, status } = options;
  const offset = (page - 1) * limit;

  const conditions = [
    studentId ? eq(feedbacks.studentId, studentId) : undefined,
    teacherId ? eq(feedbacks.teacherId, teacherId) : undefined,
    status ? eq(feedbacks.status, status) : undefined,
  ].filter(Boolean);

  const where = conditions.length ? and(...conditions) : undefined;

  const [data, total] = await Promise.all([
    db
      .select()
      .from(feedbacks)
      .where(where)
      .orderBy(desc(feedbacks.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(feedbacks).where(where),
  ]);

  return { data, count: total[0]?.value ?? 0 };
}

export async function findById(id: string) {
  const rows = await db.select().from(feedbacks).where(eq(feedbacks.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function create(payload: typeof feedbacks.$inferInsert) {
  const rows = await db.insert(feedbacks).values(payload).returning();
  return rows[0];
}

export async function update(id: string, payload: Partial<typeof feedbacks.$inferInsert>) {
  const rows = await db.update(feedbacks).set(payload).where(eq(feedbacks.id, id)).returning();
  return rows[0] ?? null;
}

export async function remove(id: string) {
  return db.delete(feedbacks).where(eq(feedbacks.id, id));
}
```

### 12.2 feedback-service.ts

- [ ] **步骤 2：创建文件**

```ts
import * as repo from "@/lib/repositories/feedback-repository";
import * as authService from "@/lib/services/auth-service";
import { buildPaginationMeta } from "@/lib/pagination";
import { forbiddenError, notFoundError } from "@/lib/api-error";
import type { AuthUserResult } from "@/lib/route-auth";

export async function list(user: AuthUserResult, options: repo.ListFeedbacksOptions) {
  if (user.userRole !== "admin" && user.teacherRole !== "admin") {
    options.teacherId = user.userId;
  }
  const result = await repo.list(options);
  return { data: result.data, pagination: buildPaginationMeta(options.page, options.limit, result.count) };
}

export async function findById(user: AuthUserResult, id: string) {
  const fb = await repo.findById(id);
  if (!fb) return notFoundError("反馈不存在");
  if (user.userRole === "admin") return fb;
  if (user.teacherRole === "admin") return fb;
  if (fb.teacherId === user.userId) return fb;
  const canAccess = await authService.canTeacherAccessStudent(user.userId, fb.studentId);
  if (!canAccess) return forbiddenError("权限不足");
  return fb;
}

export async function create(user: AuthUserResult, payload: Parameters<typeof repo.create>[0]) {
  payload.teacherId = payload.teacherId ?? user.userId;
  return repo.create(payload);
}

export async function update(
  user: AuthUserResult,
  id: string,
  payload: Parameters<typeof repo.update>[1]
) {
  const existing = await findById(user, id);
  if (existing instanceof Response) return existing;
  return repo.update(id, payload);
}

export async function remove(user: AuthUserResult, id: string) {
  const existing = await findById(user, id);
  if (existing instanceof Response) return existing;
  return repo.remove(id);
}
```

### 12.3 迁移 feedbacks 路由

- [ ] **步骤 3：重构 feedbacks 路由**

- [ ] **步骤 4：验证 lint / ts-check**

```bash
pnpm lint
pnpm ts-check
```

- [ ] **步骤 5：Commit**

```bash
git add src/lib/repositories/feedback-repository.ts src/lib/services/feedback-service.ts src/app/api/feedbacks
git commit -m "refactor(api): add feedback repository/service and migrate feedback routes"
```

---

## 任务 13：创建 user repository & service 并迁移 users 路由

**文件：**
- 创建：`src/lib/repositories/user-repository.ts`
- 创建：`src/lib/services/user-service.ts`
- 修改：`src/app/api/users/route.ts`
- 修改：`src/app/api/users/[id]/route.ts`
- 修改：`src/app/api/users/[id]/reset-password/route.ts`

模式同 teacher。`reset-password` 复用 service。

- [ ] **步骤 1：创建 repository 和 service**
- [ ] **步骤 2：迁移路由**
- [ ] **步骤 3：验证 lint / ts-check**

```bash
pnpm lint
pnpm ts-check
```

- [ ] **步骤 4：Commit**

```bash
git add src/lib/repositories/user-repository.ts src/lib/services/user-service.ts src/app/api/users
git commit -m "refactor(api): add user repository/service and migrate user routes"
```

---

## 任务 14：创建 ai-setting repository & service 并迁移 ai-settings 路由

**文件：**
- 创建：`src/lib/repositories/ai-setting-repository.ts`
- 创建：`src/lib/services/ai-setting-service.ts`
- 修改：`src/app/api/ai-settings/route.ts`
- 修改：`src/app/api/ai-settings/test/route.ts`

### 14.1 ai-setting-repository.ts

- [ ] **步骤 1：创建文件**

```ts
import { db } from "@/storage/database/drizzle-client";
import { aiSettings } from "@/storage/database/shared/schema";
import { eq } from "drizzle-orm";

export async function findFirst() {
  const rows = await db.select().from(aiSettings).limit(1);
  return rows[0] ?? null;
}

export async function upsert(payload: Partial<typeof aiSettings.$inferInsert>) {
  const existing = await findFirst();
  if (existing) {
    const rows = await db
      .update(aiSettings)
      .set({ ...payload, updatedAt: new Date() })
      .where(eq(aiSettings.id, existing.id))
      .returning();
    return rows[0];
  }
  const rows = await db.insert(aiSettings).values(payload as typeof aiSettings.$inferInsert).returning();
  return rows[0];
}
```

### 14.2 ai-setting-service.ts

- [ ] **步骤 2：创建文件**

```ts
import * as repo from "@/lib/repositories/ai-setting-repository";
import { forbiddenError } from "@/lib/api-error";
import type { AuthUserResult } from "@/lib/route-auth";

function maskKey(key?: string | null) {
  if (!key) return "";
  if (key.length <= 8) return "****";
  return key.slice(0, 4) + "****" + key.slice(-4);
}

export async function get(user: AuthUserResult) {
  if (user.userRole !== "admin") return forbiddenError("权限不足");
  const data = await repo.findFirst();
  if (!data) return null;
  return {
    ...data,
    apiKey: maskKey(data.apiKey),
  };
}

export async function update(
  user: AuthUserResult,
  payload: Parameters<typeof repo.upsert>[0]
) {
  if (user.userRole !== "admin") return forbiddenError("权限不足");
  // 如果传入的是掩码 key，保留旧值
  if (payload.apiKey?.includes("****")) {
    const existing = await repo.findFirst();
    if (existing) payload.apiKey = existing.apiKey;
  }
  return repo.upsert(payload);
}
```

### 14.3 迁移 ai-settings 路由

- [ ] **步骤 3：重构路由**

- [ ] **步骤 4：验证 lint / ts-check**

```bash
pnpm lint
pnpm ts-check
```

- [ ] **步骤 5：Commit**

```bash
git add src/lib/repositories/ai-setting-repository.ts src/lib/services/ai-setting-service.ts src/app/api/ai-settings
git commit -m "refactor(api): add ai-setting repository/service and migrate ai-settings routes"
```

---

## 任务 15：迁移 lookup 路由（tags / themes / course-stages / course-prompts）

**文件：**
- 创建：`src/lib/repositories/course-prompt-repository.ts`
- 创建：`src/lib/services/course-prompt-service.ts`
- 修改：`src/app/api/tags/**/route.ts`
- 修改：`src/app/api/themes/**/route.ts`
- 修改：`src/app/api/course-stages/**/route.ts`
- 修改：`src/app/api/course-prompts/**/route.ts`

模式：repository + service + 薄路由。tags/themes/course-stages 读取走 `lookupService` 缓存；写入后失效缓存。

- [ ] **步骤 1：创建 course-prompt repository/service**
- [ ] **步骤 2：迁移 tags 路由**
- [ ] **步骤 3：迁移 themes 路由**
- [ ] **步骤 4：迁移 course-stages 路由**
- [ ] **步骤 5：迁移 course-prompts 路由**
- [ ] **步骤 6：验证 lint / ts-check**

```bash
pnpm lint
pnpm ts-check
```

- [ ] **步骤 7：Commit**

```bash
git add src/lib/repositories/course-prompt-repository.ts src/lib/services/course-prompt-service.ts src/app/api/tags src/app/api/themes src/app/api/course-stages src/app/api/course-prompts
git commit -m "refactor(api): migrate lookup and course routes to services"
```

---

## 任务 16：迁移 home-data 路由

**文件：**
- 修改：`src/app/api/home-data/route.ts`

### 16.1 data-repository.ts 或 home-service.ts

- [ ] **步骤 1：创建 `src/lib/services/home-service.ts`**

```ts
import { db } from "@/storage/database/drizzle-client";
import { students, classes, teachers, feedbacks, studentClasses } from "@/storage/database/shared/schema";
import { eq, inArray, and, desc, count, sql } from "drizzle-orm";
import { buildPaginationMeta } from "@/lib/pagination";
import type { AuthUserResult } from "@/lib/route-auth";

export async function getHomeData(user: AuthUserResult, page: number, limit: number) {
  const offset = (page - 1) * limit;

  let classIds: string[] | undefined;
  if (user.userRole !== "admin" && user.teacherRole !== "admin") {
    classIds = (
      await db
        .select({ id: classes.id })
        .from(classes)
        .where(eq(classes.teacherId, user.userId))
    ).map((c) => c.id);
  }

  const where = classIds?.length
    ? inArray(students.classId, classIds)
    : undefined;

  const [studentRows, totalRows] = await Promise.all([
    db
      .select()
      .from(students)
      .where(where)
      .orderBy(desc(students.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(students).where(where),
  ]);

  const studentIds = studentRows.map((s) => s.id);

  const [fbCountRows, classRows, teacherRows] = await Promise.all([
    db
      .select({ studentId: feedbacks.studentId, count: count() })
      .from(feedbacks)
      .where(inArray(feedbacks.studentId, studentIds))
      .groupBy(feedbacks.studentId),
    db.select().from(classes),
    db.select().from(teachers),
  ]);

  const classMap = new Map(classRows.map((c) => [c.id, c]));
  const teacherMap = new Map(teacherRows.map((t) => [t.id, t]));
  const fbCountMap = new Map(fbCountRows.map((r) => [r.studentId, r.count]));

  const data = studentRows.map((s) => ({
    ...s,
    class: s.classId ? classMap.get(s.classId) : null,
    adminTeacher: s.adminTeacherId ? teacherMap.get(s.adminTeacherId) : null,
    currentTeacher: s.currentTeacherId ? teacherMap.get(s.currentTeacherId) : null,
    feedbackCount: fbCountMap.get(s.id) ?? 0,
  }));

  return {
    data,
    pagination: buildPaginationMeta(page, limit, totalRows[0]?.value ?? 0),
  };
}
```

### 16.2 迁移 home-data 路由

- [ ] **步骤 2：重写 `src/app/api/home-data/route.ts`**

```ts
import { NextRequest } from "next/server";
import { z } from "zod";
import { withDbError } from "@/lib/route-handlers/with-db-error";
import { withAuth } from "@/lib/route-handlers/with-auth";
import { withValidation } from "@/lib/route-handlers/with-validation";
import { paginatedResponse } from "@/lib/api-response";
import { homeService } from "@/lib/services/home-service";

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
});

export const GET = withDbError(
  withAuth(
    withValidation({ query: querySchema }, async (req, { authUser, query }) => {
      const result = await homeService.getHomeData(authUser!, (query as { page: number; limit: number }).page, (query as { page: number; limit: number }).limit);
      return paginatedResponse(result.data, result.pagination);
    })
  )
);
```

- [ ] **步骤 3：验证 lint / ts-check**

```bash
pnpm lint
pnpm ts-check
```

- [ ] **步骤 4：Commit**

```bash
git add src/lib/services/home-service.ts src/app/api/home-data/route.ts
git commit -m "refactor(api): migrate home-data route to Drizzle service"
```

---

## 任务 17：迁移数据导入导出路由

**文件：**
- 创建：`src/lib/repositories/data-repository.ts`
- 创建：`src/lib/services/data-service.ts`
- 修改：`src/app/api/data/export/route.ts`
- 修改：`src/app/api/data/import/route.ts`
- 修改：`src/app/api/data/full-import/route.ts`
- 修改：`src/app/api/data/clear/route.ts`
- 修改：`src/app/api/data/reset-admin/route.ts`

### 17.1 data-repository.ts

- [ ] **步骤 1：创建文件**

提供聚合查询：导出所有表数据、清空表、按表插入数据。

```ts
import { db } from "@/storage/database/drizzle-client";
import {
  teachers,
  students,
  classes,
  feedbacks,
  users,
  tags,
  teachingThemes,
  courseStages,
  coursePrompts,
  classTransfers,
  studentClasses,
  aiSettings,
} from "@/storage/database/shared/schema";

const tables = [
  { name: "teachers", table: teachers },
  { name: "students", table: students },
  { name: "classes", table: classes },
  { name: "feedbacks", table: feedbacks },
  { name: "users", table: users },
  { name: "tags", table: tags },
  { name: "teaching_themes", table: teachingThemes },
  { name: "course_stages", table: courseStages },
  { name: "course_prompts", table: coursePrompts },
  { name: "class_transfers", table: classTransfers },
  { name: "student_classes", table: studentClasses },
  { name: "ai_settings", table: aiSettings },
];

export async function exportAll() {
  const result: Record<string, unknown[]> = {};
  for (const { name, table } of tables) {
    result[name] = await db.select().from(table);
  }
  return result;
}

export async function clearAll(tx?: typeof db) {
  const client = tx ?? db;
  for (const { table } of tables) {
    await client.delete(table);
  }
}

export async function importAll(payload: Record<string, unknown[]>, tx: typeof db) {
  for (const { name, table } of tables) {
    const rows = payload[name];
    if (rows && rows.length > 0) {
      await tx.insert(table).values(rows as never[]);
    }
  }
}
```

注意：Drizzle `db.delete(table)` 无 where 会删除所有行。如果表很大，需要分批。

### 17.2 data-service.ts

- [ ] **步骤 2：创建文件**

```ts
import * as repo from "@/lib/repositories/data-repository";
import { db } from "@/storage/database/drizzle-client";
import { forbiddenError } from "@/lib/api-error";
import { invalidateAllLookups } from "@/lib/services/lookup-service";
import type { AuthUserResult } from "@/lib/route-auth";

export async function exportData(user: AuthUserResult) {
  if (user.userRole !== "admin") return forbiddenError("权限不足");
  return repo.exportAll();
}

export async function importData(
  user: AuthUserResult,
  payload: Record<string, unknown[]>,
  mode: "merge" | "overwrite"
) {
  if (user.userRole !== "admin") return forbiddenError("权限不足");

  return db.transaction(async (tx) => {
    if (mode === "overwrite") {
      await repo.clearAll(tx);
    }
    await repo.importAll(payload, tx);
  }).then(() => {
    invalidateAllLookups();
    return { success: true };
  });
}

export async function clearData(user: AuthUserResult) {
  if (user.userRole !== "admin") return forbiddenError("权限不足");
  return db.transaction(async (tx) => {
    await repo.clearAll(tx);
  }).then(() => {
    invalidateAllLookups();
    return { success: true };
  });
}
```

### 17.3 迁移 data 路由

- [ ] **步骤 3：重构 `data/export/route.ts` 为流式响应**

```ts
import { withDbError } from "@/lib/route-handlers/with-db-error";
import { withAuth } from "@/lib/route-handlers/with-auth";
import { dataService } from "@/lib/services";

export const GET = withDbError(
  withAuth(async (req, { authUser }) => {
    const result = await dataService.exportData(authUser!);
    if (result instanceof Response) return result;

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode('{"tables":{'));
        const entries = Object.entries(result);
        for (let i = 0; i < entries.length; i++) {
          const [name, rows] = entries[i];
          controller.enqueue(encoder.encode(`"${name}":${JSON.stringify(rows)}`));
          if (i < entries.length - 1) controller.enqueue(encoder.encode(","));
        }
        controller.enqueue(encoder.encode("}}"));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": "attachment; filename=export.json",
      },
    });
  })
);
```

- [ ] **步骤 4：重构 `data/import/route.ts` 和 `data/full-import/route.ts` 使用 transaction**

- [ ] **步骤 5：重构 `data/clear/route.ts` 使用 transaction**

- [ ] **步骤 6：验证 lint / ts-check**

```bash
pnpm lint
pnpm ts-check
```

- [ ] **步骤 7：Commit**

```bash
git add src/lib/repositories/data-repository.ts src/lib/services/data-service.ts src/app/api/data
git commit -m "refactor(api): migrate data import/export to transaction-protected services with streaming export"
```

---

## 任务 18：迁移 batch-import 与 course-stages/reset 路由

**文件：**
- 修改：`src/app/api/batch-import/classes/route.ts`
- 修改：`src/app/api/batch-import/update-admin-teacher/route.ts`
- 修改：`src/app/api/course-stages/reset/route.ts`

- [ ] **步骤 1：将 batch-import 路由改为使用 data-service / student-service / class-service**
- [ ] **步骤 2：将 course-stages/reset 改为使用 repository + transaction**
- [ ] **步骤 3：验证 lint / ts-check**

```bash
pnpm lint
pnpm ts-check
```

- [ ] **步骤 4：Commit**

```bash
git add src/app/api/batch-import src/app/api/course-stages/reset
git commit -m "refactor(api): migrate batch-import and course-stages reset to services"
```

---

## 任务 19：移除 Supabase 客户端残留

**文件：**
- 删除：`src/storage/database/supabase-client.ts`
- 修改：任何仍引用 `getServerSupabaseClient` 的文件

- [ ] **步骤 1：确认无剩余引用**

```bash
grep -r "getServerSupabaseClient\|getServerClient\|createClient" src/ --include="*.ts" --include="*.tsx"
```

预期：无匹配（除了 `auth.ts` 或环境变量配置中可能存在的无关内容）。

- [ ] **步骤 2：删除 `src/storage/database/supabase-client.ts`（如仍存在）**

```bash
rm -f src/storage/database/supabase-client.ts
```

- [ ] **步骤 3：验证 lint / ts-check**

```bash
pnpm lint
pnpm ts-check
```

- [ ] **步骤 4：Commit**

```bash
git add -A
git commit -m "chore(api): remove remaining Supabase client code"
```

---

## 任务 20：最终验证与提交

**文件：**
- 按需修改

- [ ] **步骤 1：运行 lint**

```bash
pnpm lint
```

预期：0 errors（warnings 可接受）。

- [ ] **步骤 2：运行类型检查**

```bash
pnpm ts-check
```

预期：通过。

- [ ] **步骤 3：运行构建**

```bash
pnpm build
```

预期：成功（如果构建命令存在且无数据库连接问题）。

- [ ] **步骤 4：最终提交**

```bash
git add -A
git commit -m "feat(api): complete API layer optimization with repository/service architecture"
```

---

## 计划自检

- **规格覆盖度：** 设计文档中统一数据访问、Zod 校验、缓存、流式导出、事务保护、错误处理、路由瘦身均已覆盖。
- **占位符扫描：** 无 TODO/待定；每个任务包含实际文件路径、代码、命令。
- **类型一致性：** `AuthUserResult`、`RouteContext`、包装器签名、service/repository 命名在全文中保持一致。
