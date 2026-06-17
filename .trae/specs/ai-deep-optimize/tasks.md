# Tasks

- [x] Task 1: 抽取公共 AI 模块 `src/lib/ai-client.ts`
  - [x] 1.1: 将 `getAISettings()` 从 3 个 route.ts 抽取到 ai-client.ts
  - [x] 1.2: 将 `streamThirdPartyAI()` 从 generate/review route.ts 抽取到 ai-client.ts
  - [x] 1.3: 更新 generate/route.ts、review/route.ts、parse/route.ts 引用

- [x] Task 2: 修复 P0 致命 bug
  - [x] 2.1: review/route.ts 复检时扣子AI添加 system Prompt
  - [x] 2.2: use-report-generation.ts 自定义标签分类使用实际 category
  - [x] 2.3: ai-settings/route.ts PUT 接口字段名与前端统一 + 掩码值跳过
  - [x] 2.4: use-settings-data.ts 重置 Prompt 调用 getDefaultPrompt()

- [x] Task 3: 修复 SSE 跨包拆分 bug
  - [x] 3.1: 后端 generate/review route.ts 添加 SSE buffer 机制
  - [x] 3.2: 前端 use-sse-stream.ts 添加 buffer 机制

- [x] Task 4: 添加 AI 调用超时控制
  - [x] 4.1: ai-client.ts 中 streamThirdPartyAI 添加 AbortSignal.timeout
  - [x] 4.2: parse/route.ts 非流式调用添加超时
  - [x] 4.3: 前端 use-sse-stream.ts 添加 120s 无数据超时

- [x] Task 5: 添加输入校验防 Prompt 注入
  - [x] 5.1: generate/route.ts 添加 Zod schema 校验
  - [x] 5.2: review/route.ts 添加 Zod schema 校验
  - [x] 5.3: parse/route.ts 添加 Zod schema 校验
  - [x] 5.4: 用户输入转义函数（防 Prompt 注入）

- [x] Task 6: 领域 Prompt 优化
  - [x] 6.1: 3 个领域 Prompt 补充【总结】部分
  - [x] 6.2: getDomainPrompt 匹配逻辑优化（优先匹配更具体类别）
  - [x] 6.3: 自定义 Prompt 与领域 Prompt 合并策略

- [x] Task 7: AI 流式对话框增强
  - [x] 7.1: ai-stream-dialog.tsx 添加 Markdown 渲染
  - [x] 7.2: ai-stream-dialog.tsx 添加取消按钮

- [x] Task 8: 构建验证
  - [x] 8.1: TypeScript 类型检查通过
  - [x] 8.2: ESLint 检查通过
  - [x] 8.3: Next.js 构建通过

# Task Dependencies
- Task 2 depends on Task 1 (公共模块先抽取，再修复 bug)
- Task 3 depends on Task 1 (SSE buffer 修改需要引用公共模块)
- Task 4 depends on Task 1
- Task 5 depends on Task 1
- Task 6, 7, 8 are independent
