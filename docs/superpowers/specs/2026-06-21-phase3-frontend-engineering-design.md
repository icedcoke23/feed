# Phase 3 前端工程化落地设计规格

## 背景

Phase 1（数据库迁移）与 Phase 2（安全加固）已完成。当前前端存在以下技术债：

1. **重复页面文件**：`page.tsx` 与 `*-client.tsx` 并存，逻辑高度重复（home、settings、student detail 三处）。
2. **SWR 基础设施已搭建但未使用**：`src/lib/swr/` 下已有 keys/options/types/fetcher，但业务代码全部使用手动 `useState + fetch + useCallback` 模式。
3. **`use-feedback-form.ts` 过大**：723 行，承担表单状态、草稿、提交、AI 生成、照片编辑等多重职责。
4. **CRUD Hook 高度重复**：`useCourseStages`、`useTags`、`useThemes`、`useUsers` 四个 Hook 结构几乎一致（fetch / save / delete / confirmDialog），每个 100-180 行。
5. **列表组件未 memo**：`StudentCard`、`TagRatingItem` 等列表项未使用 `React.memo`，父组件状态变化时全量重渲染。
6. **跨页面状态通过 sessionStorage**：反馈报告数据通过 `sessionStorage` 传递到 PDF 页面。

## 目标

- 删除重复页面文件，统一为单一入口。
- SWR 落地到设置页 CRUD 场景，减少手动状态管理代码。
- 拆分 `use-feedback-form.ts` 为更小的组合 Hook。
- 抽象通用 CRUD Hook，消除四份重复代码。
- 关键列表组件添加 `React.memo`。
- 跨页面状态保留 sessionStorage 方案（PDF 打印场景合理），但类型化封装。

## 技术方案

### 3.1 删除重复页面文件

**策略**：保留 `page.tsx` 作为唯一入口（Next.js App Router 约定），删除 `*-client.tsx`。

| 删除 | 保留 | 处理方式 |
|------|------|---------|
| `src/app/home-client.tsx` | `src/app/page.tsx` | 将 home-client 中独有的逻辑合并到 page.tsx，删除 home-client |
| `src/app/settings/settings-client.tsx` | `src/app/settings/page.tsx` | 将 settings-client 的 Tab 延迟加载逻辑合并到 page.tsx，删除 settings-client |
| `src/app/student/[id]/student-detail-client.tsx` | `src/app/student/[id]/page.tsx` | 将 client 的 props 初始化逻辑合并到 page.tsx，删除 client |

**原则**：合并时以功能更完整的版本为准，不丢失任何业务逻辑。

### 3.2 SWR 落地（设置页 CRUD）

**范围**：先在设置页的 4 个 CRUD Hook 中落地 SWR，验证模式后再推广。

**SWR Provider**：在 `src/app/layout.tsx` 中包裹 `<SWRConfig>`，配置全局 fetcher 和错误处理。

**改造模式**（以 `useTags` 为例）：

```ts
// 改造前：手动 useState + fetch + useCallback（~100 行）
export function useTags() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [tagsLoading, setTagsLoading] = useState(true);
  const fetchTags = useCallback(async () => { ... }, []);
  const saveTag = useCallback(async (...) => { fetchTags(); }, [fetchTags]);
  const deleteTag = useCallback(async (...) => { fetchTags(); }, [fetchTags]);
  useEffect(() => { fetchTags(); }, [fetchTags]);
  return { tags, tagsLoading, saving, saveTag, deleteTag, ... };
}

// 改造后：SWR + mutate（~40 行）
export function useTags() {
  const { data: tags, isLoading, mutate } = useSWR(SWR_KEYS.tags, fetcher<Tag[]>);
  const { trigger: saveTag, isMutating: saving } = useSWRMutation(
    SWR_KEYS.tags,
    async (_, { arg }: { arg: Partial<Tag> }) => { ... }
  );
  const { trigger: deleteTag } = useSWRMutation(
    SWR_KEYS.tags,
    async (_, { arg }: { arg: string }) => { ... }
  );
  return { tags: tags || [], isLoading, saving, saveTag, deleteTag, ... };
}
```

**涉及 Hook**：`useCourseStages`、`useTags`、`useThemes`、`useUsers`。

### 3.3 拆分 use-feedback-form

将 723 行的 `use-feedback-form.ts` 按职责拆分为：

| 新 Hook | 职责 | 来源行数 |
|---------|------|---------|
| `use-feedback-form.ts`（瘦身后） | 表单状态 + 提交 | ~200 行 |
| `use-feedback-draft.ts`（已存在） | 草稿保存/恢复 | 已有 94 行 |
| `use-feedback-photos.ts` | 照片选择/裁剪/编辑 | ~150 行 |
| `use-feedback-ai.ts` | AI 生成 SSE 流 | ~150 行 |

**原则**：组合优于继承，`useFeedbackForm` 内部调用其他子 Hook。

### 3.4 抽象通用 CRUD Hook

在 SWR 落地后，4 个 CRUD Hook 的模式进一步抽象为 `useCrudResource`：

```ts
export function useCrudResource<T extends { id: string }>(options: {
  key: string;
  endpoint: string;
  itemName: string;
}) {
  const { data, isLoading, mutate } = useSWR(options.key, fetcher<T[]>);
  const { trigger: save } = useSWRMutation(options.key, saveMutator(options));
  const { trigger: remove } = useSWRMutation(options.key, deleteMutator(options));
  return { data: data || [], isLoading, save, remove, mutate };
}
```

**注意**：如果抽象后反而增加复杂度（如各 Hook 有特殊逻辑），则保留独立 Hook，仅共享 SWR 基础设施。YAGNI 原则优先。

### 3.5 列表组件 React.memo

为以下列表项组件添加 `React.memo`：

| 组件 | 场景 |
|------|------|
| `StudentCard` | 首页班级列表中的学生卡片 |
| `TagRatingItem` | 反馈表单中的标签评分项 |
| `FeedbackCard` | 首页反馈列表项 |

**方式**：`export const StudentCard = memo(function StudentCard(...) { ... })`。

### 3.6 跨页面状态封装

`sessionStorage` 传递 PDF 数据的场景合理（避免大数据通过 URL 传递），但需要类型化封装：

```ts
// src/lib/pdf-session.ts
const PDF_DATA_KEY = "pdfReportData";
export function savePdfData(data: PdfReportPayload): void { ... }
export function loadPdfData(): PdfReportPayload | null { ... }
export function clearPdfData(): void { ... }
```

## 验收标准

- [ ] `home-client.tsx`、`settings-client.tsx`、`student-detail-client.tsx` 已删除，功能无回归。
- [ ] 设置页 4 个 CRUD Hook 使用 SWR，代码量减少 40%+。
- [ ] `use-feedback-form.ts` 拆分后主文件 < 300 行。
- [ ] `StudentCard`、`TagRatingItem`、`FeedbackCard` 使用 `React.memo`。
- [ ] `pnpm ts-check` 通过。
- [ ] `pnpm lint` 0 warning。
- [ ] `pnpm build` 成功。

## 备注

- 不改动业务功能，仅做工程化重构。
- SWR 先在设置页落地，验证模式稳定后再推广到其他页面。
- CRUD Hook 抽象遵循 YAGNI，若抽象增加复杂度则保留独立 Hook。
