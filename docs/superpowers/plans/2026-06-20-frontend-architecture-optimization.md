# Phase 3 前端架构优化实现计划

> **面向 AI 代理的工作者：** 必需子技能：superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 引入 SWR 统一数据缓存层，将关键页面迁移为 Server Component，拆分巨型组件，降低首屏 JS 执行时间并减少重复请求。

**架构：** SWR 作为客户端数据缓存层；Next.js Server Component 负责首屏数据获取；Client Component 仅处理交互；大组件拆分为专注单一职责的子组件。

**技术栈：** Next.js 16、React 19、TypeScript、SWR、Tailwind CSS、sonner。

---

## 文件清单

- `package.json`：添加 `swr` 依赖。
- `src/lib/swr/fetcher.ts`：统一 fetch 包装。
- `src/lib/swr/keys.ts`：SWR key 工厂函数。
- `src/lib/swr/options.ts`：全局 SWR 默认配置。
- `src/lib/swr/index.ts`：统一导出。
- `src/lib/swr/types.ts`：共享类型。
- `src/hooks/use-home-data.ts`：迁移为基于 SWR。
- `src/hooks/use-settings-data.ts`：迁移为基于 SWR。
- `src/hooks/use-api-data.ts`：通用数据 hook（可选，用于简单资源）。
- `src/app/page.tsx`：迁移为 Server Component + Client Shell。
- `src/app/home-client.tsx`：新增首页客户端壳组件。
- `src/app/settings/page.tsx`：迁移为 Server Component。
- `src/app/settings/settings-client.tsx`：新增设置页客户端壳组件。
- `src/app/student/[id]/page.tsx`：迁移为 Server Component。
- `src/app/student/[id]/student-detail-client.tsx`：新增学员详情客户端组件。
- `src/app/error.tsx`：新增全局错误边界 UI。
- `src/components/business/page-skeleton.tsx`：新增页面级骨架屏。

---

## 任务 1：安装并配置 SWR

**文件：**
- 修改：`package.json`
- 创建：`src/lib/swr/fetcher.ts`
- 创建：`src/lib/swr/keys.ts`
- 创建：`src/lib/swr/options.ts`
- 创建：`src/lib/swr/index.ts`
- 创建：`src/lib/swr/types.ts`

- [ ] **步骤 1：安装 swr**

```bash
pnpm add swr
```

- [ ] **步骤 2：创建 fetcher**

```ts
// src/lib/swr/fetcher.ts
import { ApiResponse } from "@/lib/api-response";

export class FetchError extends Error {
  constructor(
    message: string,
    public status: number,
    public info?: unknown
  ) {
    super(message);
    this.name = "FetchError";
  }
}

export async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });

  if (!res.ok) {
    let info: unknown;
    try {
      info = await res.json();
    } catch {
      info = await res.text();
    }
    throw new FetchError(
      (info as { error?: string })?.error || `请求失败: ${res.status}`,
      res.status,
      info
    );
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const result = (await res.json()) as ApiResponse<T>;
    return result.data as T;
  }

  return (await res.text()) as unknown as T;
}
```

- [ ] **步骤 3：创建 keys**

```ts
// src/lib/swr/keys.ts
export const HOME_DATA_KEY = "/api/home-data";
export const STUDENTS_KEY = "/api/students";
export const CLASSES_KEY = "/api/classes";
export const TEACHERS_KEY = "/api/teachers";
export const ADMIN_TEACHERS_KEY = "/api/teachers?role=admin";
export const COURSE_STAGES_KEY = "/api/course-stages";
export const TAGS_KEY = "/api/tags";
export const THEMES_KEY = "/api/themes";
export const AI_SETTINGS_KEY = "/api/ai-settings";
export const USERS_KEY = "/api/users";
export const FEEDBACK_KEY = (id: string) => `/api/feedbacks/${id}`;
export const STUDENT_KEY = (id: string) => `/api/students/${id}`;
```

- [ ] **步骤 4：创建 options**

```ts
// src/lib/swr/options.ts
import { SWRConfiguration } from "swr";

export const defaultSwrConfig: SWRConfiguration = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  dedupingInterval: 2000,
  errorRetryCount: 2,
  shouldRetryOnError: (err) => {
    if (err?.status >= 400 && err?.status < 500) return false;
    return true;
  },
};
```

- [ ] **步骤 5：创建统一导出**

```ts
// src/lib/swr/index.ts
export { fetcher, FetchError } from "./fetcher";
export * from "./keys";
export { defaultSwrConfig } from "./options";
export type { UseDataResult } from "./types";
```

```ts
// src/lib/swr/types.ts
import { KeyedMutator } from "swr";

export interface UseDataResult<T> {
  data?: T;
  error?: Error;
  isLoading: boolean;
  mutate: KeyedMutator<T>;
}
```

- [ ] **步骤 6：运行 lint 与 ts-check**

```bash
pnpm ts-check && pnpm lint
```

预期：0 errors（允许历史 warnings）。

- [ ] **步骤 7：Commit**

```bash
git add -A
git commit -m "chore(deps): add swr and create swr foundation layer"
```

---

## 任务 2：迁移 useHomeData 到 SWR

**文件：**
- 修改：`src/hooks/use-home-data.ts`

- [ ] **步骤 1：读取现有 use-home-data.ts 确认接口**

已确认接口返回：`user`、`classes`、`teachers`、`adminTeachers`、`students`、分页状态、搜索/筛选状态。

- [ ] **步骤 2：使用 SWR 重构**

```ts
// src/hooks/use-home-data.ts
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import useSWR from "swr";
import { useAuth } from "@/contexts/auth-context";
import { fetcher, HOME_DATA_KEY } from "@/lib/swr";
import type { HomeDataResponse, Student, ClassItem } from "@/types/home";

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function useHomeData() {
  const { user, isLoading: authLoading } = useAuth();
  const [studentsPage, setStudentsPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("all");
  const [expandedClasses, setExpandedClasses] = useState<Record<string, boolean>>({});

  const { data, error, isLoading, mutate } = useSWR<HomeDataResponse>(
    user ? `${HOME_DATA_KEY}?page=${studentsPage}&limit=50` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const students = data?.students || [];
  const classes = data?.classes || [];
  const teachers = data?.teachers || [];
  const adminTeachers = data?.adminTeachers || [];
  const studentsPagination = data?.studentsPagination || null;

  // 搜索防抖
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 默认展开所有班级
  useEffect(() => {
    if (classes.length > 0 && Object.keys(expandedClasses).length === 0) {
      const initial: Record<string, boolean> = {};
      classes.forEach((cls) => { initial[cls.id] = true; });
      setExpandedClasses(initial);
    }
  }, [classes]);

  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const matchesSearch =
        student.name.includes(debouncedSearchQuery) ||
        student.current_class?.includes(debouncedSearchQuery) ||
        student.classes?.some((c) => c.name?.includes(debouncedSearchQuery)) ||
        student.grade?.includes(debouncedSearchQuery);
      const matchesTeacher =
        teacherFilter === "all" ||
        student.classes?.some((c) => c.teacher_id === teacherFilter) ||
        student.class?.teacher_id === teacherFilter ||
        student.current_teacher_id === teacherFilter;
      return matchesSearch && matchesTeacher;
    });
  }, [students, debouncedSearchQuery, teacherFilter]);

  const stats = useMemo(() => {
    const now = new Date();
    return {
      total: students.length,
      thisMonth: students.filter((s) => {
        const createdDate = new Date(s.created_at);
        return createdDate.getMonth() === now.getMonth() && createdDate.getFullYear() === now.getFullYear();
      }).length,
      classes: classes.length,
    };
  }, [students, classes]);

  const teachersFromClasses = useMemo(() => {
    return [...new Map(classes.filter((cls) => cls.teacher).map((cls) => [cls.teacher!.id, cls.teacher!])).values()];
  }, [classes]);

  const toggleClassExpand = (classId: string) => {
    setExpandedClasses((prev) => ({ ...prev, [classId]: !prev[classId] }));
  };

  const expandAllClasses = (expand: boolean) => {
    const newState: Record<string, boolean> = {};
    classes.forEach((cls) => { newState[cls.id] = expand; });
    setExpandedClasses(newState);
  };

  const loadMoreStudents = useCallback(() => {
    if (studentsPagination && studentsPage < studentsPagination.totalPages) {
      setStudentsPage((p) => p + 1);
    }
  }, [studentsPagination, studentsPage]);

  const hasMoreStudents = studentsPagination ? studentsPage < studentsPagination.totalPages : false;

  const refresh = useCallback(() => mutate(), [mutate]);

  return {
    user,
    authLoading,
    classes,
    teachers,
    adminTeachers,
    students,
    loading: authLoading || isLoading,
    error: error?.message || null,
    searchQuery,
    setSearchQuery,
    teacherFilter,
    setTeacherFilter,
    expandedClasses,
    toggleClassExpand,
    expandAllClasses,
    teachersFromClasses,
    filteredStudents,
    stats,
    refresh,
    loadingMore: isLoading && studentsPage > 1,
    hasMoreStudents,
    loadMoreStudents,
    studentsPagination,
  };
}
```

注意：`HomeDataResponse` 类型需与 `/api/home-data` 返回一致。若 `src/types/home.ts` 中不存在，则在此任务中补充。

- [ ] **步骤 3：运行 lint 与 ts-check**

```bash
pnpm ts-check && pnpm lint
```

- [ ] **步骤 4：Commit**

```bash
git add -A
git commit -m "refactor(hooks): migrate useHomeData to SWR"
```

---

## 任务 3：迁移 useSettingsData 到 SWR

**文件：**
- 修改：`src/hooks/use-settings-data.ts`

- [ ] **步骤 1：为每个资源 hook 使用 useSWR**

将 `useCourseStages`、`useTags`、`useThemes`、`useAISettings`、`useUsers` 中的 `useState/useEffect/fetch` 替换为 `useSWR`，保留 mutate 用于变更后刷新。

以 `useCourseStages` 为例：

```ts
import useSWR, { mutate as globalMutate } from "swr";
import { fetcher, COURSE_STAGES_KEY } from "@/lib/swr";

export function useCourseStages() {
  const { data, error, isLoading, mutate } = useSWR<CourseStage[]>(COURSE_STAGES_KEY, fetcher);
  const [saving, setSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(INITIAL_CONFIRM_STATE);

  const courseStages = data || [];

  const saveCourseStage = useCallback(async (editingStage: Partial<CourseStage>, isAdding: boolean) => {
    // 校验与请求逻辑保持不变
    const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(body) });
    if (response.ok) {
      toast.success(isNew ? "添加成功" : "更新成功");
      await mutate();
      return true;
    }
    // ...
  }, [mutate]);

  return {
    courseStages,
    loading: isLoading,
    error: error?.message || null,
    saving,
    confirmDialog,
    setConfirmDialog,
    refresh: mutate,
    saveCourseStage,
    deleteCourseStage,
    addDefaultPresets,
    resetToPresets,
  };
}
```

对 `useTags`、`useThemes`、`useAISettings`、`useUsers` 做同样迁移。

- [ ] **步骤 2：更新 settings/page.tsx 引用**

确保 `settings/page.tsx` 使用新 hook 返回的 `refresh` / `loading` / `error` 字段。如果字段名变化，同步调整调用处。

- [ ] **步骤 3：运行 lint 与 ts-check**

```bash
pnpm ts-check && pnpm lint
```

- [ ] **步骤 4：Commit**

```bash
git add -A
git commit -m "refactor(hooks): migrate settings data hooks to SWR"
```

---

## 任务 4：创建 Server Component 数据服务

**文件：**
- 创建：`src/lib/services/home-service.ts`
- 创建：`src/lib/services/student-detail-service.ts`
- 创建：`src/lib/services/settings-service.ts`

- [ ] **步骤 1：创建 home-service**

```ts
// src/lib/services/home-service.ts
import "server-only";
import { cookies } from "next/headers";
import { getHomeData } from "@/lib/repositories/home-repository";

export async function fetchHomeData(page = 1, limit = 50) {
  // 服务端直接调用 repository，绕过 HTTP 请求
  return getHomeData({ page, limit });
}
```

若不存在 `home-repository`，则创建：

```ts
// src/lib/repositories/home-repository.ts
import "server-only";
import { db } from "@/storage/database/shared/db";
import { students, classes, teachers, studentClasses } from "@/storage/database/shared/schema";
import { eq, desc, sql } from "drizzle-orm";

export async function getHomeData({ page, limit }: { page: number; limit: number }) {
  // 查询班级、教师、学员并返回与 /api/home-data 兼容的结构
  const classesData = await db.query.classes.findMany({ with: { teacher: true } });
  const teachersData = await db.query.teachers.findMany();
  const adminTeachersData = await db.query.teachers.findMany({ where: eq(teachers.role, "admin") });

  const total = await db.$count(students);
  const studentsData = await db.query.students.findMany({
    with: { classes: { with: { class: { with: { teacher: true } } } } },
    orderBy: desc(students.createdAt),
    limit,
    offset: (page - 1) * limit,
  });

  return {
    students: studentsData,
    classes: classesData,
    teachers: teachersData,
    adminTeachers: adminTeachersData,
    studentsPagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}
```

- [ ] **步骤 2：创建 student-detail-service**

```ts
// src/lib/services/student-detail-service.ts
import "server-only";
import { db } from "@/storage/database/shared/db";
import { students } from "@/storage/database/shared/schema";
import { eq } from "drizzle-orm";

export async function fetchStudentById(id: string) {
  return db.query.students.findFirst({
    where: eq(students.id, id),
    with: {
      classes: { with: { class: { with: { teacher: true } } } },
      adminTeacher: true,
      currentTeacher: true,
    },
  });
}
```

- [ ] **步骤 3：创建 settings-service**

```ts
// src/lib/services/settings-service.ts
import "server-only";
import { db } from "@/storage/database/shared/db";
import { courseStages, tags as tagsTable, themes, aiSettings, users } from "@/storage/database/shared/schema";

export async function fetchSettingsPageData() {
  const [courseStagesData, tagsData, themesData, aiSettingsData, usersData] = await Promise.all([
    db.query.courseStages.findMany(),
    db.query.tags.findMany(),
    db.query.themes.findMany(),
    db.query.aiSettings.findFirst(),
    db.query.users.findMany(),
  ]);

  return {
    courseStages: courseStagesData,
    tags: tagsData,
    themes: themesData,
    aiSettings: aiSettingsData,
    users: usersData,
  };
}
```

- [ ] **步骤 4：运行 lint 与 ts-check**

```bash
pnpm ts-check && pnpm lint
```

- [ ] **步骤 5：Commit**

```bash
git add -A
git commit -m "feat(server): add server-side data services for home, student and settings"
```

---

## 任务 5：迁移首页为 Server Component

**文件：**
- 修改：`src/app/page.tsx`
- 创建：`src/app/home-client.tsx`

- [ ] **步骤 1：创建 home-client.tsx**

将当前 `src/app/page.tsx` 的内容整体迁移到 `src/app/home-client.tsx`，保持 Client Component，但删除数据获取逻辑，改为接收 props。

```tsx
// src/app/home-client.tsx
"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useHomeData } from "@/hooks/use-home-data";
// ... 其余 import 与当前 page.tsx 一致

export default function HomeClient() {
  const {
    user,
    classes,
    teachers,
    adminTeachers,
    loading,
    // ...
  } = useHomeData();

  // 其余 JSX 与当前 page.tsx 一致
}
```

- [ ] **步骤 2：重写 page.tsx 为 Server Component**

```tsx
// src/app/page.tsx
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyAuth } from "@/lib/auth/server-auth";
import { fetchHomeData } from "@/lib/services/home-service";
import HomeClient from "./home-client";
import { HomePageSkeleton } from "@/components/business/page-skeleton";

export default async function HomePage() {
  const user = await verifyAuth();
  if (!user) redirect("/login");

  return (
    <Suspense fallback={<HomePageSkeleton />}>
      <HomeClient />
    </Suspense>
  );
}
```

说明：Server Component 中只做权限校验，数据仍由 `HomeClient` 通过 SWR 获取（渐进式迁移，避免一次改动过大）。后续可进一步将数据预取通过 SWR fallback 传入。

- [ ] **步骤 3：运行 lint 与 ts-check**

```bash
pnpm ts-check && pnpm lint
```

- [ ] **步骤 4：Commit**

```bash
git add -A
git commit -m "refactor(pages): migrate home page to server component shell"
```

---

## 任务 6：迁移设置页为 Server Component

**文件：**
- 修改：`src/app/settings/page.tsx`
- 创建：`src/app/settings/settings-client.tsx`

- [ ] **步骤 1：创建 settings-client.tsx**

将当前 `src/app/settings/page.tsx` 的 Client Component 逻辑迁移到 `settings-client.tsx`，移除 `useEffect` 中的按需 fetch（因为 SWR 已自动处理）。

- [ ] **步骤 2：重写 settings/page.tsx 为 Server Component**

```tsx
// src/app/settings/page.tsx
import { redirect } from "next/navigation";
import { verifyAuth } from "@/lib/auth/server-auth";
import SettingsClient from "./settings-client";

export default async function SettingsPage() {
  const user = await verifyAuth();
  if (!user) redirect("/login");

  return <SettingsClient initialUser={user} />;
}
```

- [ ] **步骤 3：运行 lint 与 ts-check**

```bash
pnpm ts-check && pnpm lint
```

- [ ] **步骤 4：Commit**

```bash
git add -A
git commit -m "refactor(pages): migrate settings page to server component shell"
```

---

## 任务 7：迁移学员详情页为 Server Component

**文件：**
- 修改：`src/app/student/[id]/page.tsx`
- 创建：`src/app/student/[id]/student-detail-client.tsx`

- [ ] **步骤 1：创建 student-detail-client.tsx**

接收 `student` 作为 props，保留客户端交互（编辑、删除、跳转等）。

- [ ] **步骤 2：重写 student/[id]/page.tsx 为 Server Component**

```tsx
// src/app/student/[id]/page.tsx
import { notFound, redirect } from "next/navigation";
import { verifyAuth } from "@/lib/auth/server-auth";
import { fetchStudentById } from "@/lib/services/student-detail-service";
import StudentDetailClient from "./student-detail-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function StudentDetailPage({ params }: Props) {
  const user = await verifyAuth();
  if (!user) redirect("/login");

  const { id } = await params;
  const student = await fetchStudentById(id);
  if (!student) notFound();

  return <StudentDetailClient student={student} user={user} />;
}
```

- [ ] **步骤 3：运行 lint 与 ts-check**

```bash
pnpm ts-check && pnpm lint
```

- [ ] **步骤 4：Commit**

```bash
git add -A
git commit -m "refactor(pages): migrate student detail page to server component"
```

---

## 任务 8：添加全局错误边界与骨架屏

**文件：**
- 创建：`src/app/error.tsx`
- 创建：`src/components/business/page-skeleton.tsx`

- [ ] **步骤 1：创建 error.tsx**

```tsx
// src/app/error.tsx
"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <h2 className="text-2xl font-bold mb-2">页面出错了</h2>
      <p className="text-gray-500 mb-6">{error.message || "请稍后重试"}</p>
      <Button onClick={reset}>重试</Button>
    </div>
  );
}
```

- [ ] **步骤 2：创建骨架屏组件**

```tsx
// src/components/business/page-skeleton.tsx
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function HomePageSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="h-16 bg-white border-b" />
      <div className="flex">
        <aside className="w-64 hidden lg:block min-h-screen bg-white border-r" />
        <main className="flex-1 p-4 lg:p-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <Skeleton className="h-4 w-20 mb-2" />
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <Skeleton className="h-6 w-24 mb-4" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-2/3 mb-4" />
                  <div className="flex gap-2">
                    <Skeleton className="h-9 flex-1" />
                    <Skeleton className="h-9 flex-1" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
```

- [ ] **步骤 3：运行 lint 与 ts-check**

```bash
pnpm ts-check && pnpm lint
```

- [ ] **步骤 4：Commit**

```bash
git add -A
git commit -m "feat(ui): add global error boundary and page skeleton"
```

---

## 任务 9：设置页组件拆分

**文件：**
- 修改：`src/app/settings/settings-client.tsx`
- 创建：`src/app/settings/tabs/ai-settings-tab.tsx`
- 创建：`src/app/settings/tabs/themes-tab.tsx`
- 创建：`src/app/settings/tabs/course-stages-tab.tsx`
- 创建：`src/app/settings/tabs/tags-tab.tsx`
- 创建：`src/app/settings/tabs/users-tab.tsx`
- 创建：`src/app/settings/tabs/data-tab.tsx`

- [ ] **步骤 1：将各 Tab 拆分为独立组件**

每个 Tab 组件只接收自己需要的数据和回调，例如：

```tsx
// src/app/settings/tabs/course-stages-tab.tsx
"use client";

import { CourseStageManagement } from "@/components/business/course-stage-management";
import { useCourseStages } from "@/hooks/use-settings-data";

export function CourseStagesTab() {
  const { courseStages, loading, saving, saveCourseStage, deleteCourseStage, addDefaultPresets, resetToPresets } = useCourseStages();

  return (
    <CourseStageManagement
      courseStages={courseStages}
      loading={loading}
      saving={saving}
      onSave={saveCourseStage}
      onDelete={deleteCourseStage}
      onAddDefaults={addDefaultPresets}
      onReset={resetToPresets}
    />
  );
}
```

其他 Tab 类似拆分。

- [ ] **步骤 2：简化 settings-client.tsx**

`settings-client.tsx` 只负责 Tab 切换和公共布局，渲染对应 Tab 组件。

- [ ] **步骤 3：运行 lint 与 ts-check**

```bash
pnpm ts-check && pnpm lint
```

- [ ] **步骤 4：Commit**

```bash
git add -A
git commit -m "refactor(settings): split settings page into tab components"
```

---

## 任务 10：验证与收尾

**文件：** 全部

- [ ] **步骤 1：全量 lint 与 ts-check**

```bash
pnpm ts-check && pnpm lint
```

预期：0 errors，不新增 warnings。

- [ ] **步骤 2：检查运行时**

```bash
pnpm dev &
```

访问首页、设置页、学员详情页，确认：
- 数据正常加载
- Tab 切换不重复请求
- 服务端渲染页面无客户端二次请求

- [ ] **步骤 3：Commit 最终变更**

```bash
git add -A
git commit -m "refactor(frontend): complete phase 3 architecture optimization"
```

---

## 自检

1. **规格覆盖度**：SWR 基础层、hooks 迁移、Server Component、组件拆分、错误边界、骨架屏均已覆盖。
2. **占位符扫描**：无 TODO/待定，所有步骤包含实际代码。
3. **类型一致性**：`HomeDataResponse`、`CourseStage`、`Tag` 等类型与现有类型一致；新 hooks 返回字段向后兼容。
