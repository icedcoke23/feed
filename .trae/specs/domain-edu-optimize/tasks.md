# Tasks

- [x] Task 1: 扩展评价标签体系 - 从22个通用标签扩展为约40个领域化标签
  - [x] SubTask 1.1: 修改 src/app/api/init-data/route.ts - 重写预设标签数据，按乐高搭建/机器人编程/代码编程/通用能力四类组织
  - [x] SubTask 1.2: 更新 scripts/init-supabase.sql - 同步更新标签初始化SQL

- [x] Task 2: AI Prompt 领域化 - 根据课程类型动态切换系统提示词
  - [x] SubTask 2.1: 修改 src/lib/constants/ai.ts - 新增领域化Prompt函数 getDomainPrompt(theme)
  - [x] SubTask 2.2: 修改 src/app/api/generate/route.ts - 调用 getDomainPrompt(theme) 替代 getDefaultPrompt()

- [x] Task 3: 补充教学主题 - 从8个扩展为约14个
  - [x] SubTask 3.1: 修改 src/app/api/init-data/route.ts - 新增6个教学主题
  - [x] SubTask 3.2: 更新 scripts/init-supabase.sql - 同步更新主题初始化SQL

- [x] Task 4: 课程阶段扩充 - 新增小颗粒积木，BricQ/WEDO拆分多阶段
  - [x] SubTask 4.1: 修改 src/lib/constants/course-stages.ts - 新增小颗粒2阶段，BricQ拆2阶段，WEDO拆2阶段
  - [x] SubTask 4.2: 修改 src/types/settings.ts - THEME_OPTIONS 新增"小颗粒"选项
  - [x] SubTask 4.3: 确认 init-data 自动使用新常量

- [x] Task 5: 反馈数据结构增强 - 增加作品信息和能力评分
  - [x] SubTask 5.1: 修改 src/storage/database/shared/schema.ts - 新增 work_info 和 ability_scores JSONB 字段
  - [x] SubTask 5.2: 修改 src/types/feedback.ts - 新增 WorkInfo 和 AbilityScore 接口
  - [x] SubTask 5.3: 修改 src/app/api/feedbacks/route.ts POST - 支持保存新字段
  - [x] SubTask 5.4: 修改 src/app/api/feedbacks/[id]/route.ts PUT - 支持更新新字段

- [x] Task 6: 照片上传优化 - 裁剪功能 + 学员风采排版
  - [x] SubTask 6.1: 安装 react-easy-crop 依赖
  - [x] SubTask 6.2: 创建 src/components/business/image-crop-dialog.tsx - 图片裁剪对话框
  - [x] SubTask 6.3: 修改照片上传相关组件 - 集成裁剪功能
  - [x] SubTask 6.4: 修改学员风采展示组件 - 网格布局优化

- [x] Task 7: 验证构建
  - [x] SubTask 7.1: 运行 tsc 类型检查
  - [x] SubTask 7.2: 运行 ESLint 检查
  - [x] SubTask 7.3: 运行 next build 构建测试

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 4] depends on [Task 2]
- [Task 5] depends on [Task 4]
- [Task 6] independent
- [Task 7] depends on [Task 1-6]
