# 全栈深度优化长期计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 基于 P0-P5 阶段成果与三维度深度审计（后端 26 项、前端 46 项、测试工程化 17 项），系统性修复所有已知 bug、统一架构、补齐测试、提升性能与可访问性。

**架构：** 分 5 个阶段（P6-P10）按优先级推进：安全与数据完整性紧急修复 → 权限与一致性统一 → 性能优化 → 测试补齐 → 工程化与可访问性。每阶段结束运行 ts-check + lint + test + build 四重验证。

**技术栈：** Next.js 16 / React 19 / Drizzle ORM / SWR / vitest / playwright / zod / shadcn-ui

---

## P6: 安全与数据完整性紧急修复（高危）

### 任务 P6-1: home-service 敏感数据脱敏

**文件：**
- 修改：`/workspace/src/lib/services/home-service.ts`（L87-100, L113-114, L186, L200, L215, L219-221）

- [ ] **步骤 1：在 home-service 所有返回点调用 maskPhone/maskEmail**

在 `enrichStudents` 返回的学生对象（L200 `phone: s.phone`）改为 `phone: maskPhone(s.phone)`；班级教师（L186）、admin_teacher（L215、L219-221）的 phone/email 同样脱敏；L87-100 查询所有教师时，L113-114 返回前对 `teachersData`/`adminTeachersData` 数组 map 脱敏。导入 `maskPhone`/`maskEmail` from `@/lib/sensitive-mask`（与 student-service.ts:51 一致）。

- [ ] **步骤 2：运行验证**

运行：`pnpm ts-check && pnpm lint && pnpm test`
预期：0 错误

### 任务 P6-2: clearAll 加事务

**文件：**
- 修改：`/workspace/src/lib/services/data-service.ts:136-169`

- [ ] **步骤 1：将 clearAll 8 张表删除包入 withTransaction**

参照同文件 `resetAdmin`（L381）和 `restoreData`（L339）的 `withTransaction` 模式，将 feedbacks、classTransfers、students、classes、themes、tags、courseStages、teachers 的 8 个 `db.delete()` 包入单个事务。同时删除 `users WHERE role='teacher'`（修复 M12 孤儿 users）。

- [ ] **步骤 2：运行验证**

运行：`pnpm ts-check && pnpm test`
预期：0 错误

### 任务 P6-3: stats-service sql.raw 改参数化

**文件：**
- 修改：`/workspace/src/lib/services/stats-service.ts:70-73`

- [ ] **步骤 1：将 sql.raw 拼接改为 inArray 参数化**

将 `sql\`AND ${feedbacks.studentId} = ANY(${sql.raw(...)})\`` 改为 `inArray(feedbacks.studentId, accessibleStudentIds)`（Drizzle 已支持数组参数化）。同时修复 `gradeDistribution`、`tagUsage` 中相同的 `sql.raw` 模式（若存在）。

- [ ] **步骤 2：运行验证**

运行：`pnpm ts-check && pnpm test`
预期：0 错误

### 任务 P6-4: api-error 错误码补齐

**文件：**
- 修改：`/workspace/src/lib/api-error.ts`（L76, L81, L86, L91）

- [ ] **步骤 1：让快捷错误函数默认带 code**

`unauthorizedError()` 默认 `code: "UNAUTHORIZED"`；`forbiddenError()` 默认 `code: "FORBIDDEN"`；`notFoundError()` 默认 `code: "NOT_FOUND"`；`badRequestError()` 默认 `code: "BAD_REQUEST"`。在 `errorResponse` 调用时传入对应 code。

- [ ] **步骤 2：运行验证**

运行：`pnpm ts-check && pnpm test`
预期：47/47 通过

### 任务 P6-5: use-tag-operations 假装成功修复

**文件：**
- 修改：`/workspace/src/hooks/use-tag-operations.ts`（L65-128）

- [ ] **步骤 1：网络失败时 toast.error 不写虚假状态**

L114-128 catch 块：删除创建 tempId 加入 tagRatings 的逻辑，改为 `toast.error("标签添加失败，请重试")` 并 return。L98-108 data 为空时同样 toast.error return，不写 `custom-${Date.now()}` tempId。

- [ ] **步骤 2：clearTimeout 移到 finally**

L78 的 `clearTimeout(timeoutId)` 移到 finally 块，确保失败路径也清理 timer。

- [ ] **步骤 3：运行验证**

运行：`pnpm ts-check && pnpm lint`
预期：0 错误

### 任务 P6-6: AuthContext 先信任后验证修复

**文件：**
- 修改：`/workspace/src/contexts/auth-context.tsx`（L41-73）

- [ ] **步骤 1：移除 setTimeout 提前 setUser**

删除 L41-73 中 `setTimeout(() => setUser(parsedUser), 0)`。改为：mount 时 `isLoading=true`，调用 `/api/auth/me`，仅 200 时 `setUser(data.user)`，401 时清除 localStorage 并 `setUser(null)`。isLoading 期间 UI 显示 loading（已有逻辑）。

- [ ] **步骤 2：login/logout 用 useCallback 包装**

L75、L95 的 `login`/`logout` 用 `useCallback` 包装，依赖 `[router]` / `[]`。

- [ ] **步骤 3：运行验证**

运行：`pnpm ts-check && pnpm lint && pnpm test`
预期：0 错误

### 任务 P6-7: use-home-data 竞态修复

**文件：**
- 修改：`/workspace/src/hooks/use-home-data.ts`（L33-106, L108-112, L193）

- [ ] **步骤 1：fetchData 加 AbortController**

L33 `fetchData` 入口创建 `AbortController`，存入 ref，传入所有 fetch 的 `signal`；新调用前 abort 旧 controller。effect cleanup 也 abort。

- [ ] **步骤 2：loadMoreStudents 防重入**

L108 加 `loadingMoreRef`，入口判断 `if (loadingMoreRef.current) return;`，finally 释放。

- [ ] **步骤 3：删除 L193 temp key bug**

删除 `newState['temp'] = expand;`。

- [ ] **步骤 4：运行验证**

运行：`pnpm ts-check && pnpm lint`
预期：0 错误

### 任务 P6-8: use-feedback-restore 覆盖编辑修复

**文件：**
- 修改：`/workspace/src/hooks/use-feedback-restore.ts`（L70-156, L159-300）

- [ ] **步骤 1：加"已恢复"ref guard 防止 effect 重跑覆盖**

L70 effect 加 `restoredRef`，首次恢复后置 true，后续 tags/themes 变化不重跑。L159 effect 加 `editLoadedRef`，首次加载后置 true。

- [ ] **步骤 2：L287 允许空 tags 加载**

把 `if (tags.length > 0) loadFeedbackForEdit();` 改为 `if (tags !== undefined) loadFeedbackForEdit();`（loading 时跳过，loaded 但空也允许）。

- [ ] **步骤 3：运行验证**

运行：`pnpm ts-check && pnpm lint`
预期：0 错误

### 任务 P6-9: use-feedback-form editId 不更新修复

**文件：**
- 修改：`/workspace/src/hooks/use-feedback-form.ts:54`

- [ ] **步骤 1：editId 改为 derived value**

删除 `const [editId] = useState<string | null>(editIdFromUrl);`，直接用 `editIdFromUrl` 作为 derived value 传递给下游。

- [ ] **步骤 2：运行验证**

运行：`pnpm ts-check && pnpm lint`
预期：0 错误

### 任务 P6-10: use-feedback-save 并发保护+mutate

**文件：**
- 修改：`/workspace/src/hooks/use-feedback-save.ts`（L51-205）

- [ ] **步骤 1：加 savingRef 并发锁**

入口 `if (savingRef.current) return;`，finally 释放。

- [ ] **步骤 2：保存成功后 SWR mutate**

L195 `clearDraft()` 后，调 `globalMutate((key) => typeof key === 'string' && key.startsWith('/api/feedbacks'))` 失效反馈列表缓存。从 `useSWRConfig` 取 `mutate`。

- [ ] **步骤 3：运行验证**

运行：`pnpm ts-check && pnpm lint && pnpm test && pnpm build`
预期：P6 阶段全部通过

---

## P7: 权限与一致性统一（中危）

### 任务 P7-1: isAdmin 统一

**文件：**
- 修改：`/workspace/src/lib/services/` 下 user-service.ts、course-stage-service.ts、ai-setting-service.ts（仅检查 userRole）
- 创建：`/workspace/src/lib/services/auth-utils.ts`

- [ ] **步骤 1：抽取共享 isAdmin 函数**

新建 `auth-utils.ts` 导出 `isAdmin(user: AuthUserResult): boolean` 统一实现为 `user.userRole === 'admin' || user.teacherRole === 'admin'`。所有 service 引用此函数。

- [ ] **步骤 2：运行验证**

运行：`pnpm ts-check && pnpm test`
预期：0 错误

### 任务 P7-2: toSnakeCase 转换函数补齐

**文件：**
- 修改：`/workspace/src/lib/services/class-service.ts`、`tag-service.ts`、`theme-service.ts`
- 创建：`/workspace/src/lib/services/snake-case-mappers.ts`

- [ ] **步骤 1：抽取统一 mappers 模块**

新建 `snake-case-mappers.ts`，集中 `toSnakeCaseStudent`/`toSnakeCaseFeedback`/`toSnakeCaseUser`/`toSnakeCaseClass`/`toSnakeCaseTag`/`toSnakeCaseTheme`/`toSnakeCaseClassTransfer`。class-service、tag-service、theme-service 的 list 返回值应用对应 mapper。

- [ ] **步骤 2：运行验证**

运行：`pnpm ts-check && pnpm test && pnpm build`
预期：0 错误

### 任务 P7-3: teacher-service.remove 改软删除

**文件：**
- 修改：`/workspace/src/lib/services/teacher-service.ts:84-93`

- [ ] **步骤 1：改软删除+自删/最后 admin 校验**

参照 user-service.ts:209-222 模式，改为 `set({ isActive: false })`；加自删检查（`if (teacher.id === user.userId) return badRequestError`）；加最后 admin 检查。

- [ ] **步骤 2：运行验证**

运行：`pnpm ts-check && pnpm test`
预期：0 错误

### 任务 P7-4: data-repository 错误记录

**文件：**
- 修改：`/workspace/src/lib/repositories/data-repository.ts`（L330, L368, L406, L475, L545, L587, L620）

- [ ] **步骤 1：catch 块记录 error 详情**

每个 `catch { results.xxx.failed++; }` 改为 `catch (e) { results.xxx.failed++; console.error('[import xxx]', e); }`，保留 error 对象。

- [ ] **步骤 2：运行验证**

运行：`pnpm ts-check && pnpm lint`
预期：0 错误

### 任务 P7-5: parse-service 二次 parse 保护

**文件：**
- 修改：`/workspace/src/lib/services/parse-service.ts:124-132`

- [ ] **步骤 1：二次 JSON.parse 包入 try-catch**

L128 `JSON.parse(jsonMatch[0])` 包入独立 try-catch，失败时抛 `new Error("无法解析AI响应")`。

- [ ] **步骤 2：运行验证**

运行：`pnpm ts-check && pnpm test`
预期：0 错误

### 任务 P7-6: init-data-service 事务+竞态

**文件：**
- 修改：`/workspace/src/lib/services/init-data-service.ts:111-133`

- [ ] **步骤 1：包入事务+onConflictDoNothing**

三个 insert 包入 `db.transaction`；每个 insert 加 `onConflictDoNothing()` 防竞态重复插入。

- [ ] **步骤 2：运行验证**

运行：`pnpm ts-check && pnpm test`
预期：0 错误

### 任务 P7-7: feedback-service.update 乐观锁

**文件：**
- 修改：`/workspace/src/lib/services/feedback-service.ts:412-438`

- [ ] **步骤 1：canAccess 移入事务+WHERE version 校验**

`canAccessFeedback` 和 `findById` 移入事务；update 的 WHERE 加 `eq(feedbacks.version, current.version)`，检查 `updated.length === 0` 时返回冲突错误。

- [ ] **步骤 2：运行验证**

运行：`pnpm ts-check && pnpm test && pnpm build`
预期：P7 阶段全部通过

---

## P8: 性能优化（N+1 与组件拆分）

### 任务 P8-1: 启用 Drizzle with 关系查询消除 N+1

**文件：**
- 修改：`/workspace/src/lib/services/student-service.ts`（enrichStudents）、`home-service.ts`（enrichStudents）
- 参考：`/workspace/src/storage/database/shared/relations.ts`

- [ ] **步骤 1：用 with 关系查询合并 enrichStudents 的 6 次查询为 1-2 次**

students 查询加 `.with({ studentClasses: { class: { teacher: true } } })` 一次拉取学生+班级+教师。删除手动 Map 拼装。

- [ ] **步骤 2：统一两份 enrichStudents 为单一共享函数**

抽取到 `student-enricher.ts`，student-service 和 home-service 共用。

- [ ] **步骤 3：运行验证**

运行：`pnpm ts-check && pnpm test && pnpm build`
预期：0 错误

### 任务 P8-2: use-settings-data optimistic 回滚

**文件：**
- 修改：`/workspace/src/hooks/use-settings-data.ts`（L408-429, L488-525, L99-135）

- [ ] **步骤 1：saveAISettings/resetPrompt 失败回滚**

记录 prev 值，catch 中 `mutate(prev, { revalidate: false })` 回滚。

- [ ] **步骤 2：addDefaultPresets 改 Promise.allSettled 并行**

L99-135 串行 for...of 改 `Promise.allSettled`。

- [ ] **步骤 3：运行验证**

运行：`pnpm ts-check && pnpm lint`
预期：0 错误

### 任务 P8-3: 大组件拆分

**文件：**
- 修改：`/workspace/src/components/business/pdf-analysis-page.tsx`（611 行）、`image-crop-dialog.tsx`（527 行）、`ai-settings-panel.tsx`（463 行）

- [ ] **步骤 1：pdf-analysis-page 拆分**

拆出 `EditableBlock`、`EditableCoursePlanCell` 为独立文件；按三大区块（学情/课程规划/教师建议）拆子组件。

- [ ] **步骤 2：image-crop-dialog 拆出 FreeCropOverlay**

- [ ] **步骤 3：ai-settings-panel 按 Tab 拆分**

拆为 `AIGeneralSettings`、`CoursePromptSettings`。

- [ ] **步骤 4：修复 index key fallback bug**

pdf-analysis-page L421 `key={plan.id || index}` 改为客户端生成 uuid。

- [ ] **步骤 5：运行验证**

运行：`pnpm ts-check && pnpm lint && pnpm build`
预期：P8 阶段全部通过

---

## P9: 测试补齐

### 任务 P9-1: tsconfig.test.json + CI 测试类型检查

**文件：**
- 创建：`/workspace/tsconfig.test.json`
- 修改：`/workspace/.github/workflows/quality.yml`、`/workspace/package.json`

- [ ] **步骤 1：新建 tsconfig.test.json 继承主配置移除测试 exclude**

- [ ] **步骤 2：package.json 加 test:typecheck 脚本，CI quality job 增加此步骤**

- [ ] **步骤 3：运行验证**

运行：`pnpm test:typecheck`
预期：0 错误

### 任务 P9-2: 覆盖率阈值上调

**文件：**
- 修改：`/workspace/vitest.config.ts:21-26`

- [ ] **步骤 1：阈值上调到 lines 30% / branches 20% / functions 30%**

- [ ] **步骤 2：运行验证**

运行：`pnpm test`
预期：通过新阈值

### 任务 P9-3: auth-service 单元测试

**文件：**
- 创建：`/workspace/src/lib/services/__tests__/auth-service.test.ts`

- [ ] **步骤 1：覆盖 login（成功/失败）、canTeacherAccessStudent、getAccessibleStudentIds**

复用 login route test 的 pglite + Proxy mock 模式。

- [ ] **步骤 2：运行验证**

运行：`pnpm test`
预期：通过

### 任务 P9-4: feedback-service 单元测试

**文件：**
- 创建：`/workspace/src/lib/services/__tests__/feedback-service.test.ts`

- [ ] **步骤 1：覆盖 buildCreatePayload、buildUpdatePayload、migrateAiReport、canAccessFeedback、toSnakeCaseFeedback**

- [ ] **步骤 2：运行验证**

运行：`pnpm test`
预期：通过

### 任务 P9-5: stats-service 单元测试

**文件：**
- 创建：`/workspace/src/lib/services/__tests__/stats-service.test.ts`

- [ ] **步骤 1：覆盖 getStats、clearStatsCache 缓存失效**

setup.ts 加 `beforeEach(clearStatsCache)` 防缓存残留。

- [ ] **步骤 2：运行验证**

运行：`pnpm test`
预期：通过

### 任务 P9-6: data 系列路由集成测试

**文件：**
- 创建：`/workspace/src/app/api/data/clear/__tests__/route.test.ts`、`reset-admin/__tests__/route.test.ts`

- [ ] **步骤 1：覆盖权限校验 + 破坏性操作事务回滚**

- [ ] **步骤 2：运行验证**

运行：`pnpm test`
预期：通过

### 任务 P9-7: E2E 核心流程

**文件：**
- 创建：`/workspace/e2e/feedback-flow.spec.ts`、`/workspace/e2e/data-management.spec.ts`

- [ ] **步骤 1：登录→创建反馈→导出 PDF happy path**

- [ ] **步骤 2：admin 数据备份→恢复→校验**

- [ ] **步骤 3：运行验证**

运行：`pnpm test:e2e`
预期：P9 阶段全部通过

---

## P10: 工程化与可访问性

### 任务 P10-1: 客户端 zod 校验统一

**文件：**
- 创建：`/workspace/src/lib/validations/client.ts`
- 修改：`/workspace/src/hooks/use-class-actions.ts`、`use-student-actions.ts`、`use-settings-data.ts`、`use-feedback-save.ts`

- [ ] **步骤 1：抽客户端 schema 模块**

- [ ] **步骤 2：各表单 hook 接入 zod 校验**

- [ ] **步骤 3：运行验证**

运行：`pnpm ts-check && pnpm lint`
预期：0 错误

### 任务 P10-2: 可访问性 Label/aria-label

**文件：**
- 修改：`/workspace/src/components/business/` 下 ai-settings-panel、course-stage-management、batch-add-dialog、student-selector、pdf-analysis-page、image-crop-dialog、free-layout-photo-editor、student-list

- [ ] **步骤 1：所有 Label 加 htmlFor 关联 Input**

- [ ] **步骤 2：纯图标按钮加 aria-label**

- [ ] **步骤 3：图片 alt 描述性化**

- [ ] **步骤 4：运行验证**

运行：`pnpm ts-check && pnpm lint && pnpm build`
预期：0 错误

### 任务 P10-3: CI 依赖审计+Dependabot

**文件：**
- 创建：`/workspace/.github/dependabot.yml`
- 修改：`/workspace/.github/workflows/quality.yml`

- [ ] **步骤 1：新增 audit job 跑 pnpm audit --prod**

- [ ] **步骤 2：新增 dependabot.yml 监控 pnpm 依赖**

- [ ] **步骤 3：运行验证**

运行：`pnpm audit --prod`
预期：无高危漏洞或已记录

### 任务 P10-4: CI 缓存复用

**文件：**
- 修改：`/workspace/.github/workflows/quality.yml`

- [ ] **步骤 1：e2e job needs quality，复用构建产物**

用 `actions/cache` 缓存 `.next/` 与 `node_modules/`，e2e job 下载复用。

- [ ] **步骤 2：运行验证**

运行：CI 触发
预期：构建次数减半

### 任务 P10-5: 文档同步

**文件：**
- 修改：`/workspace/docs/api-errors.md`、`/workspace/docs/testing.md`、`/workspace/README.md`

- [ ] **步骤 1：api-errors.md 删除未实现的 INTERNAL_ERROR 或实现它**

- [ ] **步骤 2：testing.md 维护待补测试清单表格**

- [ ] **步骤 3：README 命令同步 package.json**

- [ ] **步骤 4：运行验证**

运行：`pnpm ts-check && pnpm lint && pnpm test && pnpm build`
预期：P10 阶段全部通过，全计划完成

---

## 自检结果

**1. 规格覆盖度：** 审计报告中的所有高危项（后端 H1-H5、前端 H1-H11、测试 H1-H5）均有对应任务。中危项挑选了影响最大的（isAdmin、toSnakeCase、N+1、optimistic 回滚）纳入 P7-P8。低危项（LIKE 注入、死参数、骨架屏 key）因影响小未单独列任务，可在 P10 顺手修复。

**2. 占位符扫描：** 无占位符，每个步骤都有具体文件路径和操作。

**3. 类型一致性：** `isAdmin` 在 P7-1 统一后所有 service 引用同一函数；`toSnakeCase*` 在 P7-2 集中到 mappers 模块；P8-1 的 `with` 关系查询返回类型与现有 enrichStudents 返回类型保持一致。
