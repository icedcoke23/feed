# Phase 3 前端架构优化设计

## 目标
通过引入 SWR 统一数据缓存层、拆分 Client/Server 职责、重构巨型组件，降低首屏 JS 执行时间，减少重复数据请求，提升代码可维护性。

## 架构
- **数据层**：使用 `swr` 提供请求去重、缓存、重验证、错误重试；封装通用 `fetcher` 和按 API 路径组织的 SWR key。
- **服务端渲染**：将数据只读、首屏关键的页面迁移为 Next.js Server Component，在服务端完成数据获取并直接返回 HTML。
- **客户端交互**：仅保留需要事件、状态、dialog 的组件为 Client Component，通过 props 接收服务端预取数据。
- **组件拆分**：将 `settings/page.tsx`、`feedback/new/page.tsx` 等职责过重的大组件拆分为专注单一职责的子组件。
- **加载/错误兜底**：使用 `Suspense` + `ErrorBoundary` 统一处理异步边界。

## 技术栈
- Next.js 16 App Router
- React 19
- TypeScript
- SWR
- Tailwind CSS
- sonner

## 详细设计

### 1. SWR 基础层

创建 `src/lib/swr/` 目录：

- `src/lib/swr/fetcher.ts`：统一的 fetch 包装，处理 credentials、JSON 解析、HTTP 错误。
- `src/lib/swr/keys.ts`：按资源类型导出 SWR key 工厂函数，如 `homeDataKey()`、`studentsKey()`。
- `src/lib/swr/options.ts`：全局默认 SWR 配置（dedupingInterval、revalidateOnFocus、errorRetryCount）。

### 2. 数据 Hooks 迁移

逐步替换现有自定义 hooks 中的 `useState/useEffect/fetch`：

- `useHomeData`：改用 `useSWRImmutable` / `useSWR` 获取 `/api/home-data`，保留本地搜索/筛选/展开状态。
- `useSettingsData`：拆分为 `useCourseStages`、`useTags`、`useThemes`、`useAISettings`、`useUsers` 五个独立 hook，每个 hook 使用 `useSWR` 管理对应资源。
- `useFeedbackData`、`useStudentActions` 等：优先读取 SWR 缓存，变更后调用 `mutate` 刷新。

### 3. Server Component 迁移

将以下页面改为 Server Component：

- `src/app/page.tsx`：服务端调用 `homeService.getHomeData()` 获取聚合数据，传给 Client Component 渲染。
- `src/app/settings/page.tsx`：服务端完成身份校验与默认 Tab 数据预取。
- `src/app/student/[id]/page.tsx`：服务端获取学员详情，避免客户端二次请求。

Server Component 中不直接使用浏览器 API，错误处理通过 `error.tsx` 边界兜底。

### 4. 组件拆分

- `settings/page.tsx` 拆分为：
  - `SettingsShell`：布局 + Tab 切换
  - `AISettingsTab`、`ThemesTab`、`CourseStagesTab`、`TagsTab`、`UsersTab`、`DataTab`：各自独立
- `feedback/new/page.tsx` 拆分为：
  - `FeedbackFormShell`
  - `StudentSelectorPanel`
  - `FeedbackEditorPanel`
  - `TagRatingPanel`

### 5. Suspense 与 ErrorBoundary

- 在数据依赖较重的页面使用 `<Suspense fallback={<PageSkeleton />}>`。
- 全局 `ErrorBoundary` 已存在，补充页面级 `error.tsx`。

### 6. 类型与接口

所有新 hooks 返回稳定类型：

```ts
interface UseDataResult<T> {
  data?: T;
  error?: Error;
  isLoading: boolean;
  mutate: KeyedMutator<T>;
}
```

### 7. 测试策略

- 为 `fetcher.ts` 添加单元测试，覆盖成功/失败/非 JSON 响应。
- 为迁移后的 hooks 添加渲染测试，验证缓存命中与变更刷新。
- 验证 `pnpm ts-check && pnpm lint` 无新增错误。

## 验收标准
1. `pnpm ts-check && pnpm lint` 通过，不引入新错误。
2. 首页首屏不再依赖客户端 fetch 聚合接口（可由服务端预取）。
3. 设置页切换 Tab 时不再重复请求已加载数据。
4. 学员详情页服务端渲染核心信息。
5. 所有重复的数据请求代码减少 50% 以上。
