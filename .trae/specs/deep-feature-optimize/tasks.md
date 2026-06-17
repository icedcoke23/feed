# Tasks

- [x] Task 1: 修复转班流程 - 更新 current_teacher_id + 填写 class_transfers 教师字段
  - [x] SubTask 1.1: 修改 src/app/api/students/[id]/transfer/route.ts - 转班时查询目标班级的 teacher_id，更新 student.current_teacher_id
  - [x] SubTask 1.2: 修改 src/app/api/students/[id]/transfer/route.ts - 在 class_transfers 记录中填写 from_teacher_id 和 to_teacher_id

- [x] Task 2: 统一 AI 接口 - review/parse 支持第三方 AI + 提取共享常量
  - [x] SubTask 2.1: 创建 src/lib/constants/ai.ts - 提取 DEFAULT_COZE_MODEL 常量和 getDefaultPrompt() 函数
  - [x] SubTask 2.2: 修改 src/app/api/generate/route.ts - 使用共享常量替代硬编码
  - [x] SubTask 2.3: 修改 src/app/api/generate/review/route.ts - 添加第三方 AI 支持分支，使用共享常量
  - [x] SubTask 2.4: 修改 src/app/api/parse/route.ts - 添加第三方 AI 支持分支，使用共享常量
  - [x] SubTask 2.5: 修改 src/app/api/ai-settings/route.ts - 使用共享常量替代硬编码模型名
  - [x] SubTask 2.6: 修改 src/app/api/ai-settings/test/route.ts - 使用共享常量

- [x] Task 3: 提取前端公共 SSE Hook + 模型名常量
  - [x] SubTask 3.1: 创建 src/hooks/use-sse-stream.ts - 提取公共 SSE 流式读取逻辑
  - [x] SubTask 3.2: 修改 src/hooks/use-report-generation.ts - 使用 useSSEStream 替代重复的 SSE 读取代码

- [x] Task 4: API 密钥脱敏
  - [x] SubTask 4.1: 修改 src/app/api/ai-settings/route.ts GET - 对 api_key 返回掩码版本（前4后4位，中间用 **** 替代）
  - [x] SubTask 4.2: 修改 src/app/api/ai-settings/test/route.ts - 从数据库读取完整密钥而非前端传入

- [x] Task 5: 修复 ai_report 字段职责 - 拆分元数据
  - [x] SubTask 5.1: 修改 src/storage/database/shared/schema.ts - 为 feedbacks 表添加 metadata JSONB 字段
  - [x] SubTask 5.2: 修改 src/app/api/feedbacks/route.ts POST - 将元数据存入 metadata 字段，ai_report 仅存 AI 文本
  - [x] SubTask 5.3: 修改 src/app/api/feedbacks/[id]/route.ts PUT - 同步更新逻辑
  - [x] SubTask 5.4: 修改前端组件 - 从 metadata 字段读取元数据，ai_report 仅用于展示

- [x] Task 6: 统一课程阶段预设数据源
  - [x] SubTask 6.1: 创建 src/lib/constants/course-stages.ts - 统一定义预设数据
  - [x] SubTask 6.2: 修改 src/app/api/course-stages/route.ts - 从常量文件导入 DEFAULT_COURSE_STAGES
  - [x] SubTask 6.3: 修改 src/types/settings.ts - 从常量文件导入 DEFAULT_PRESETS
  - [x] SubTask 6.4: 修改 src/hooks/use-settings-data.ts - 从常量文件导入

- [x] Task 7: 补充数据库约束 + 初始化数据
  - [x] SubTask 7.1: 修改 src/storage/database/shared/schema.ts - 为 tags 表添加 (category, name) 联合唯一索引
  - [x] SubTask 7.2: 修改 src/app/api/init-data/route.ts - 添加课程阶段预设初始化逻辑
  - [x] SubTask 7.3: 更新 scripts/init-supabase.sql - 添加联合唯一索引 SQL

- [x] Task 8: 验证构建
  - [x] SubTask 8.1: 运行 tsc 类型检查
  - [x] SubTask 8.2: 运行 ESLint 检查
  - [x] SubTask 8.3: 运行 next build 构建测试

# Task Dependencies
- [Task 3] depends on [Task 2] (先统一后端 AI 常量再提取前端 Hook)
- [Task 5] depends on [Task 7.1] (先更新 Schema 再修改 API)
- [Task 8] depends on [Task 1-7] (所有修改完成后验证)
