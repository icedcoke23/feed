# Phase 2 安全加固（不含 /setup 引导页）设计规格

## 背景
长期开发计划中 Phase 2 的安全加固任务，本次跳过 `/setup` 首次安装引导页，聚焦以下四项：

1. 移除硬编码教务老师映射。
2. 敏感信息脱敏。
3. API 输入校验全覆盖。
4. 全量 lint 修复。

## 目标

- 所有教务老师映射通过环境变量 `ADMIN_TEACHER_MAPPINGS` 配置，代码中无硬编码。
- API 错误日志与响应不泄露 API Key、密码、URL、手机号、邮箱等敏感信息。
- 导入/初始化/重置等管理接口具备完整的 Zod 输入校验。
- `pnpm lint` 达到 0 warning，`pnpm ts-check` 与 `pnpm build` 通过。

## 技术方案

### 1. 移除硬编码教务老师映射

- 删除 `src/app/api/batch-import/update-admin-teacher/route.ts` 中的 `ADMIN_TEACHER_USERNAMES` 常量。
- 改用 `src/lib/config/default-admins.ts` 中的 `getAdminTeacherMappings()`。
- 调整 `batch-import-service.updateAdminTeachers` 签名，接收 `Record<string, string>` 映射表。
- 若环境变量未配置，接口返回 400 并提示需要配置 `ADMIN_TEACHER_MAPPINGS`。

### 2. API 输入校验全覆盖

在 `src/lib/validations/data-import.ts` 新建共享 schema：

- `batchImportClassSchema`：班级批量导入。
- `updateAdminTeacherSchema`：教务老师批量更新。
- `initDataSchema`：初始化数据（可为空对象）。
- `resetAdminSchema`：重置管理员（可为空对象）。

路由中统一使用 `z.safeParse`：

```ts
const parsed = schema.safeParse(body);
if (!parsed.success) {
  return badRequestError("请求参数错误", parsed.error.flatten());
}
```

涉及路由：
- `src/app/api/batch-import/classes/route.ts`
- `src/app/api/batch-import/update-admin-teacher/route.ts`
- `src/app/api/init-data/route.ts`
- `src/app/api/data/reset-admin/route.ts`

### 3. 敏感信息脱敏

- 扩展 `src/lib/sensitive-mask.ts`，新增 `sanitizeError(error: unknown): string` 统一处理 Error / string / object。
- 更新 `src/lib/api-error.ts` 的 `handleDbError`：
  - 日志使用 `sanitizeError`。
  - 返回给客户端的消息使用 `sanitizeErrorMessage`。
- 检查所有 `console.error` 调用，替换为脱敏后输出。
- 导出接口 `src/app/api/data/export/route.ts` 排除 `aiSettings.api_key` 字段（如导出 aiSettings）。
- `data/reset-admin` 返回的管理员密码是管理员主动操作的结果，保留在响应中，但不再写入日志。

### 4. 全量 lint 修复

分类处理当前 60 个 warning：

- `@typescript-eslint/no-unused-vars`：删除未使用的 import/变量/函数。
- `react-hooks/exhaustive-deps`：补充依赖，或在确实不需要时添加 `eslint-disable-next-line` 并注明原因。
- `@next/next/no-img-element`：
  - 若图片来源为 base64/object URL 或需要自定义 loader，可保留 `<img>` 并局部禁用规则。
  - 其他场景迁移到 Next.js `<Image />`。

修复后必须满足：
- `pnpm lint` 0 error、0 warning。
- `pnpm ts-check` 通过。
- `pnpm build` 通过。

## 验收标准

- [ ] `pnpm ts-check` 无错误。
- [ ] `pnpm lint` 无 errors、无 warnings。
- [ ] `pnpm build` 成功。
- [ ] `ADMIN_TEACHER_USERNAMES` 硬编码常量已删除。
- [ ] `batch-import/classes`、`batch-import/update-admin-teacher`、`init-data`、`data/reset-admin` 均使用 Zod 校验。
- [ ] `handleDbError` 与所有错误日志均经过脱敏处理。

## 备注

- 跳过 `/setup` 引导页，不在本次范围内。
- 不改动业务功能，仅做安全与质量加固。
