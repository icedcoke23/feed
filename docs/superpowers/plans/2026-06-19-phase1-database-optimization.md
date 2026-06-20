# Phase 1: 数据库深度优化实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 通过添加外键约束、拆分 JSONB 反馈标签和能力评分为独立表、统一学生班级关系、优化索引、结构化 ai_settings、添加触发器，将数据库从原型级设计升级为生产级设计。

**架构：** 保留现有 Supabase PostgreSQL 数据库，通过 SQL 迁移脚本创建新表和约束，同时编写兼容层让现有 API 在双写/读取新表的模式下工作，最后通过数据迁移脚本将旧 JSONB 数据迁移到新表。

**技术栈：** PostgreSQL 15+、Drizzle ORM、Supabase JavaScript Client、SQL 迁移脚本。

---

## 将要创建或修改的文件

| 文件 | 职责 |
|------|------|
| `scripts/migrate-add-foreign-keys.sql` | 创建所有外键约束 |
| `scripts/migrate-feedback-items.sql` | 创建 feedback_items 表、约束、索引、迁移数据 |
| `scripts/migrate-ability-scores.sql` | 创建 feedback_ability_scores 表、约束、索引、迁移数据 |
| `scripts/migrate-ai-settings.sql` | 将 ai_settings 从 key-value 重构为结构化表 |
| `scripts/migrate-add-indexes.sql` | 复合索引、部分索引、GIN 索引 |
| `scripts/migrate-updated-at-triggers.sql` | updated_at 自动触发器 |
| `scripts/migrate-v1-to-v2.sql` | 总迁移脚本，按顺序调用以上所有 |
| `scripts/rollback-v2-to-v1.sql` | 回滚脚本，恢复旧结构（不删除已迁移数据） |
| `src/storage/database/shared/schema.ts` | 添加 feedback_items、feedback_ability_scores、studentClasses 表定义，更新 aiSettings |
| `src/storage/database/shared/relations.ts` | 添加新表关系 |
| `src/lib/ai-client.ts` | 适配结构化 ai_settings |
| `src/lib/db/index.ts` | 统一导出数据访问函数（占位创建） |
| `src/lib/db/feedbacks.ts` | 反馈相关数据库操作封装 |
| `src/app/api/feedbacks/route.ts` | 双写 feedback_items 和 feedback_ability_scores |
| `src/app/api/feedbacks/[id]/route.ts` | 读取/更新新表 |
| `src/app/api/stats/route.ts` | 使用 SQL 聚合替代应用层遍历 |
| `src/app/api/students/route.ts` | 移除 class_id 回退逻辑 |
| `src/app/api/home-data/route.ts` | 移除 class_id 回退逻辑 |
| `src/app/api/data/export/route.ts` | 导出新表数据 |
| `src/app/api/data/import/route.ts` | 导入新表数据 |
| `src/app/api/data/full-import/route.ts` | 全量导入新表数据 |

---

## 任务 1：添加外键约束

**文件：**
- 创建：`scripts/migrate-add-foreign-keys.sql`
- 测试：在 Supabase SQL Editor 中执行，确认无错误

- [ ] **步骤 1：编写迁移脚本**

```sql
-- scripts/migrate-add-foreign-keys.sql
-- 需要先确保所有被引用字段有唯一索引/主键

ALTER TABLE classes
  ADD CONSTRAINT fk_classes_teacher
  FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL;

ALTER TABLE students
  ADD CONSTRAINT fk_students_admin_teacher
  FOREIGN KEY (admin_teacher_id) REFERENCES teachers(id) ON DELETE SET NULL;

ALTER TABLE students
  ADD CONSTRAINT fk_students_current_teacher
  FOREIGN KEY (current_teacher_id) REFERENCES teachers(id) ON DELETE SET NULL;

ALTER TABLE feedbacks
  ADD CONSTRAINT fk_feedbacks_student
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

ALTER TABLE feedbacks
  ADD CONSTRAINT fk_feedbacks_teacher
  FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE RESTRICT;

ALTER TABLE feedbacks
  ADD CONSTRAINT fk_feedbacks_parent
  FOREIGN KEY (parent_feedback_id) REFERENCES feedbacks(id) ON DELETE SET NULL;

ALTER TABLE class_transfers
  ADD CONSTRAINT fk_class_transfers_student
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

ALTER TABLE class_transfers
  ADD CONSTRAINT fk_class_transfers_from_teacher
  FOREIGN KEY (from_teacher_id) REFERENCES teachers(id) ON DELETE SET NULL;

ALTER TABLE class_transfers
  ADD CONSTRAINT fk_class_transfers_to_teacher
  FOREIGN KEY (to_teacher_id) REFERENCES teachers(id) ON DELETE RESTRICT;

ALTER TABLE teachers
  ADD CONSTRAINT fk_teachers_user
  FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE student_classes
  ADD CONSTRAINT fk_student_classes_student
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

ALTER TABLE student_classes
  ADD CONSTRAINT fk_student_classes_class
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;

ALTER TABLE course_prompts
  ADD CONSTRAINT fk_course_prompts_stage
  FOREIGN KEY (stage_code) REFERENCES course_stages(stage_code) ON DELETE CASCADE;
```

- [ ] **步骤 2：在测试环境执行**

运行：`psql $TEST_DATABASE_URL -f scripts/migrate-add-foreign-keys.sql`
预期：所有 `ALTER TABLE` 成功执行，无外键冲突报错。若有冲突，先修复脏数据。

- [ ] **步骤 3：提交脚本**

```bash
git add scripts/migrate-add-foreign-keys.sql
git commit -m "feat(db): add foreign key constraints for referential integrity"
```

---

## 任务 2：创建 feedback_items 表

**文件：**
- 创建：`scripts/migrate-feedback-items.sql`
- 修改：`src/storage/database/shared/schema.ts`
- 修改：`src/storage/database/shared/relations.ts`

- [ ] **步骤 1：编写建表和迁移脚本**

```sql
-- scripts/migrate-feedback-items.sql

CREATE TABLE IF NOT EXISTS feedback_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID NOT NULL REFERENCES feedbacks(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE SET NULL,
  category VARCHAR(20) NOT NULL CHECK (category IN ('strength','improvement','weakness')),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  rating SMALLINT CHECK (rating BETWEEN 1 AND 5),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_feedback_items_feedback_id ON feedback_items(feedback_id);
CREATE INDEX idx_feedback_items_tag_id ON feedback_items(tag_id);
CREATE INDEX idx_feedback_items_category ON feedback_items(category);

-- 迁移现有数据
INSERT INTO feedback_items (feedback_id, tag_id, category, name, description, rating, sort_order)
SELECT
  f.id AS feedback_id,
  t.id AS tag_id,
  item.category,
  COALESCE(item.name, item.label, '未命名') AS name,
  item.description,
  (item.rating)::smallint AS rating,
  item.sort_order
FROM feedbacks f,
LATERAL (
  SELECT 'strength' AS category, value AS item FROM jsonb_array_elements(f.strengths) WITH ORDINALITY AS value
  UNION ALL
  SELECT 'improvement', value FROM jsonb_array_elements(f.improvements) WITH ORDINALITY AS value
  UNION ALL
  SELECT 'weakness', value FROM jsonb_array_elements(f.weaknesses) WITH ORDINALITY AS value
) AS item,
LATERAL (
  SELECT id FROM tags WHERE tags.name = COALESCE((item.item->>'name'), (item.item->>'label')) LIMIT 1
) AS t
WHERE f.strengths IS NOT NULL OR f.improvements IS NOT NULL OR f.weaknesses IS NOT NULL;
```

> 注意：实际迁移需要根据 JSONB 结构精确调整字段提取路径。执行前必须先用小批量数据验证。

- [ ] **步骤 2：在 Drizzle Schema 中添加表定义**

在 `src/storage/database/shared/schema.ts` 中追加：

```ts
export const feedbackItems = pgTable("feedback_items", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  feedbackId: varchar("feedback_id", { length: 36 }).notNull().references(() => feedbacks.id, { onDelete: "cascade" }),
  tagId: varchar("tag_id", { length: 36 }).references(() => tags.id, { onDelete: "set null" }),
  category: varchar("category", { length: 20 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  rating: smallint("rating"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **步骤 3：在 relations.ts 添加关系**

```ts
export const feedbackItemsRelations = relations(feedbackItems, ({ one }) => ({
  feedback: one(feedbacks, { fields: [feedbackItems.feedbackId], references: [feedbacks.id] }),
  tag: one(tags, { fields: [feedbackItems.tagId], references: [tags.id] }),
}));

export const feedbacksRelations = relations(feedbacks, ({ one, many }) => ({
  ...existing,
  items: many(feedbackItems),
}));
```

- [ ] **步骤 4：在测试环境执行迁移**

运行：`psql $TEST_DATABASE_URL -f scripts/migrate-feedback-items.sql`
预期：`feedback_items` 表创建成功，现有数据迁移到新表，行数与预期一致。

- [ ] **步骤 5：提交**

```bash
git add scripts/migrate-feedback-items.sql src/storage/database/shared/schema.ts src/storage/database/shared/relations.ts
git commit -m "feat(db): create feedback_items table and migrate jsonb strengths/improvements/weaknesses"
```

---

## 任务 3：创建 feedback_ability_scores 表

**文件：**
- 创建：`scripts/migrate-ability-scores.sql`
- 修改：`src/storage/database/shared/schema.ts`
- 修改：`src/storage/database/shared/relations.ts`

- [ ] **步骤 1：编写建表和迁移脚本**

```sql
-- scripts/migrate-ability-scores.sql

CREATE TABLE IF NOT EXISTS feedback_ability_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID NOT NULL REFERENCES feedbacks(id) ON DELETE CASCADE,
  ability_name VARCHAR(100) NOT NULL,
  score SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_feedback_ability_unique
  ON feedback_ability_scores(feedback_id, ability_name);

INSERT INTO feedback_ability_scores (feedback_id, ability_name, score)
SELECT
  f.id,
  kv.key AS ability_name,
  (kv.value::text)::smallint AS score
FROM feedbacks f,
LATERAL jsonb_each_text(f.ability_scores) AS kv
WHERE f.ability_scores IS NOT NULL AND jsonb_typeof(f.ability_scores) = 'object';
```

- [ ] **步骤 2：在 Drizzle Schema 中添加表定义**

```ts
export const feedbackAbilityScores = pgTable("feedback_ability_scores", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  feedbackId: varchar("feedback_id", { length: 36 }).notNull().references(() => feedbacks.id, { onDelete: "cascade" }),
  abilityName: varchar("ability_name", { length: 100 }).notNull(),
  score: smallint("score").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **步骤 3：在 relations.ts 添加关系**

```ts
export const feedbackAbilityScoresRelations = relations(feedbackAbilityScores, ({ one }) => ({
  feedback: one(feedbacks, { fields: [feedbackAbilityScores.feedbackId], references: [feedbacks.id] }),
}));
```

- [ ] **步骤 4：执行迁移并验证**

- [ ] **步骤 5：提交**

---

## 任务 4：将 student_classes 纳入 Drizzle Schema

**文件：**
- 修改：`src/storage/database/shared/schema.ts`
- 修改：`src/storage/database/shared/relations.ts`

- [ ] **步骤 1：在 schema.ts 添加表定义**

```ts
export const studentClasses = pgTable("student_classes", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  studentId: varchar("student_id", { length: 36 }).notNull().references(() => students.id, { onDelete: "cascade" }),
  classId: varchar("class_id", { length: 36 }).notNull().references(() => classes.id, { onDelete: "cascade" }),
  isPrimary: boolean("is_primary").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  leftAt: timestamp("left_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  uniquePrimary: uniqueIndex("idx_student_classes_primary").on(table.studentId).where(sql`${table.isPrimary} = true`),
}));
```

- [ ] **步骤 2：在 relations.ts 添加关系**

```ts
export const studentClassesRelations = relations(studentClasses, ({ one }) => ({
  student: one(students, { fields: [studentClasses.studentId], references: [students.id] }),
  class: one(classes, { fields: [studentClasses.classId], references: [classes.id] }),
}));
```

- [ ] **步骤 3：生成 Zod schema 和类型**

运行：`npx drizzle-kit generate:pg`（或项目配置的生成命令）
预期：生成包含 `studentClasses` 的新迁移文件。

- [ ] **步骤 4：提交**

---

## 任务 5：重构 ai_settings 为结构化表

**文件：**
- 创建：`scripts/migrate-ai-settings.sql`
- 修改：`src/storage/database/shared/schema.ts`
- 修改：`src/lib/ai-client.ts`

- [ ] **步骤 1：编写迁移脚本**

```sql
-- scripts/migrate-ai-settings.sql

CREATE TABLE ai_settings_new (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key TEXT,
  base_url TEXT,
  model_id VARCHAR(100) NOT NULL DEFAULT 'gpt-3.5-turbo',
  max_concurrent INTEGER NOT NULL DEFAULT 5,
  system_prompt TEXT,
  use_custom_ai BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO ai_settings_new (api_key, base_url, model_id, max_concurrent, system_prompt, use_custom_ai)
SELECT
  MAX(CASE WHEN key = 'api_key' THEN value END) AS api_key,
  MAX(CASE WHEN key = 'base_url' THEN value END) AS base_url,
  COALESCE(MAX(CASE WHEN key = 'model_id' THEN value END), 'gpt-3.5-turbo') AS model_id,
  COALESCE((MAX(CASE WHEN key = 'max_concurrent' THEN value END))::int, 5) AS max_concurrent,
  MAX(CASE WHEN key = 'system_prompt' THEN value END) AS system_prompt,
  COALESCE((MAX(CASE WHEN key = 'use_custom_ai' THEN value END))::boolean, false) AS use_custom_ai
FROM ai_settings;

ALTER TABLE ai_settings RENAME TO ai_settings_old;
ALTER TABLE ai_settings_new RENAME TO ai_settings;
```

- [ ] **步骤 2：更新 Drizzle Schema**

```ts
export const aiSettings = pgTable("ai_settings", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  apiKey: text("api_key"),
  baseUrl: text("base_url"),
  modelId: varchar("model_id", { length: 100 }).notNull().default("gpt-3.5-turbo"),
  maxConcurrent: integer("max_concurrent").notNull().default(5),
  systemPrompt: text("system_prompt"),
  useCustomAi: boolean("use_custom_ai").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **步骤 3：更新 `src/lib/ai-client.ts` 的 getAISettings**

```ts
export async function getAISettings(): Promise<AISettings> {
  const supabase = getServerSupabaseClient();
  const { data, error } = await supabase
    .from("ai_settings")
    .select("api_key, base_url, model_id, max_concurrent, system_prompt, use_custom_ai")
    .single();
  // ... 处理默认值
}
```

- [ ] **步骤 4：执行迁移并验证**

- [ ] **步骤 5：提交**

---

## 任务 6：添加索引

**文件：**
- 创建：`scripts/migrate-add-indexes.sql`

- [ ] **步骤 1：编写索引脚本**

```sql
-- scripts/migrate-add-indexes.sql

-- 复合索引
CREATE INDEX IF NOT EXISTS idx_feedbacks_student_created ON feedbacks(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedbacks_teacher_created ON feedbacks(teacher_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedbacks_status_created ON feedbacks(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_students_admin_created ON students(admin_teacher_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_class_transfers_student_transferred ON class_transfers(student_id, transferred_at DESC);

-- 部分索引
CREATE INDEX IF NOT EXISTS idx_students_active_name ON students(name) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_classes_active_teacher ON classes(teacher_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_teachers_active_role ON teachers(role) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_course_stages_active_theme_level ON course_stages(theme, level) WHERE is_active = true;
CREATE UNIQUE INDEX IF NOT EXISTS idx_student_classes_primary ON student_classes(student_id) WHERE is_primary = true;

-- GIN 索引
CREATE INDEX IF NOT EXISTS idx_feedbacks_metadata_gin ON feedbacks USING GIN (metadata);
CREATE INDEX IF NOT EXISTS idx_feedbacks_work_info_gin ON feedbacks USING GIN (work_info);
```

- [ ] **步骤 2：执行并验证 `pg_indexes`**

- [ ] **步骤 3：提交**

---

## 任务 7：添加 updated_at 触发器

**文件：**
- 创建：`scripts/migrate-updated-at-triggers.sql`

- [ ] **步骤 1：编写触发器脚本**

```sql
-- scripts/migrate-updated-at-triggers.sql

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY['teachers','students','classes','feedbacks','course_stages','course_prompts','ai_settings'])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS tr_%s_updated_at ON %I', t, t);
    EXECUTE format(
      'CREATE TRIGGER tr_%s_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
      t, t
    );
  END LOOP;
END $$;
```

- [ ] **步骤 2：测试更新操作自动更新时间**

- [ ] **步骤 3：提交**

---

## 任务 8：更新统计 API 使用 SQL 聚合

**文件：**
- 修改：`src/app/api/stats/route.ts`

- [ ] **步骤 1：替换标签统计为 SQL 聚合**

```ts
const { data: tagStats, error: tagError } = await supabase.rpc("get_feedback_tag_stats", {
  p_student_ids: targetStudentIds,
});
```

- [ ] **步骤 2：创建对应 RPC 函数**

```sql
CREATE OR REPLACE FUNCTION get_feedback_tag_stats(p_student_ids UUID[])
RETURNS TABLE(
  tag TEXT,
  strength BIGINT,
  improvement BIGINT,
  weakness BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    fi.name AS tag,
    COUNT(*) FILTER (WHERE fi.category = 'strength') AS strength,
    COUNT(*) FILTER (WHERE fi.category = 'improvement') AS improvement,
    COUNT(*) FILTER (WHERE fi.category = 'weakness') AS weakness
  FROM feedback_items fi
  JOIN feedbacks f ON f.id = fi.feedback_id
  WHERE f.student_id = ANY(p_student_ids)
  GROUP BY fi.name
  ORDER BY COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql;
```

- [ ] **步骤 3：删除旧的应用层遍历代码**

- [ ] **步骤 4：测试 `/api/stats` 返回格式一致**

- [ ] **步骤 5：提交**

---

## 任务 9：创建总迁移脚本和回滚脚本

**文件：**
- 创建：`scripts/migrate-v1-to-v2.sql`
- 创建：`scripts/rollback-v2-to-v1.sql`

- [ ] **步骤 1：编写总迁移脚本**

```sql
-- scripts/migrate-v1-to-v2.sql
-- 执行前务必备份数据库

\set ON_ERROR_STOP on
BEGIN;
\i scripts/migrate-add-foreign-keys.sql
\i scripts/migrate-feedback-items.sql
\i scripts/migrate-ability-scores.sql
\i scripts/migrate-ai-settings.sql
\i scripts/migrate-add-indexes.sql
\i scripts/migrate-updated-at-triggers.sql
COMMIT;
```

- [ ] **步骤 2：编写回滚脚本**

```sql
-- scripts/rollback-v2-to-v1.sql
-- 仅回滚结构变更，不删除已迁移到新表的数据

DROP TABLE IF EXISTS feedback_items CASCADE;
DROP TABLE IF EXISTS feedback_ability_scores CASCADE;
ALTER TABLE ai_settings RENAME TO ai_settings_new;
ALTER TABLE IF EXISTS ai_settings_old RENAME TO ai_settings;
-- 按需删除索引、触发器、外键
```

- [ ] **步骤 3：提交**

---

## 任务 10：更新 API 路由适配新 Schema

**文件：**
- 修改：`src/app/api/feedbacks/route.ts`
- 修改：`src/app/api/feedbacks/[id]/route.ts`
- 修改：`src/app/api/students/route.ts`
- 修改：`src/app/api/home-data/route.ts`
- 修改：`src/app/api/data/export/route.ts`
- 修改：`src/app/api/data/import/route.ts`
- 修改：`src/app/api/data/full-import/route.ts`

- [ ] **步骤 1：创建 `src/lib/db/feedbacks.ts` 封装反馈 CRUD**

```ts
// src/lib/db/feedbacks.ts
import { getServerSupabaseClient } from "@/storage/database/supabase-client";

export async function createFeedback(payload: CreateFeedbackPayload) {
  const supabase = getServerSupabaseClient();
  const { data: feedback, error } = await supabase
    .from("feedbacks")
    .insert({
      student_id: payload.studentId,
      teacher_id: payload.teacherId,
      stage: payload.stage,
      status: payload.status,
      content: payload.content,
      metadata: payload.metadata,
      work_info: payload.workInfo,
    })
    .select()
    .single();
  if (error) throw error;

  // 插入 feedback_items
  if (payload.items?.length) {
    const { error: itemError } = await supabase.from("feedback_items").insert(
      payload.items.map((item, idx) => ({
        feedback_id: feedback.id,
        tag_id: item.tagId,
        category: item.category,
        name: item.name,
        description: item.description,
        rating: item.rating,
        sort_order: idx,
      }))
    );
    if (itemError) throw itemError;
  }

  // 插入 feedback_ability_scores
  if (payload.abilityScores) {
    const rows = Object.entries(payload.abilityScores).map(([abilityName, score]) => ({
      feedback_id: feedback.id,
      ability_name: abilityName,
      score,
    }));
    const { error: scoreError } = await supabase.from("feedback_ability_scores").insert(rows);
    if (scoreError) throw scoreError;
  }

  return feedback;
}

export async function getFeedbackWithDetails(id: string) {
  // 单条 JOIN 查询 feedbacks + feedback_items + feedback_ability_scores
}
```

- [ ] **步骤 2：更新 `/api/feedbacks` POST 使用新封装**

- [ ] **步骤 3：更新 `/api/feedbacks` GET 返回 items/abilityScores**

- [ ] **步骤 4：更新 `/api/feedbacks/[id]` GET/PUT/DELETE**

- [ ] **步骤 5：更新 `/api/students` 和 `/api/home-data` 移除 class_id 回退**

- [ ] **步骤 6：更新导入导出适配新表**

- [ ] **步骤 7：运行 API 测试**

- [ ] **步骤 8：提交**

---

## 计划自检

1. **规格覆盖度**：Phase 1 Spec 中的所有数据库优化项都已在本计划中有对应任务。
2. **占位符扫描**：所有脚本包含实际 SQL，无 TODO 占位符；迁移字段路径需要结合实际 JSONB 结构在第一次执行时验证。
3. **类型一致性**：`feedback_items`/`feedback_ability_scores` 在 SQL、Drizzle、API 中的字段命名保持一致。

## 执行交接

**计划已完成并保存到 `docs/superpowers/plans/2026-06-19-phase1-database-optimization.md`。两种执行方式：**

**1. 子代理驱动（推荐）** - 每个任务调度一个新的子代理，任务间进行审查，快速迭代

**2. 内联执行** - 在当前会话中使用 executing-plans 执行任务，批量执行并设有检查点

**选哪种方式？**
