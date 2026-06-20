# Phase 1 剩余任务执行计划

> **面向 AI 代理的工作者：** 使用 executing-plans 或内联执行。步骤使用复选框（`- [ ]`）语法跟踪进度。无需再次询问用户确认。

**目标：** 完成 Phase 1 数据库优化剩余工作：外键约束、索引优化、updated_at 触发器、ai_settings 结构化重构、总迁移/回滚脚本。

**架构：** 当前项目已迁移到本地 PostgreSQL + Drizzle ORM。所有数据库变更通过 Drizzle schema 定义 + 原生 SQL 迁移脚本完成。本次不修改 API 路由读写逻辑（保留到后续任务），仅完成 schema 层和迁移脚本层。

**技术栈：** PostgreSQL 15+、Drizzle ORM、TypeScript、pnpm

---

## 将要创建或修改的文件

| 文件 | 职责 |
|------|------|
| `src/storage/database/shared/schema.ts` | 确认/补全外键定义，重构 `aiSettings` 表结构 |
| `src/storage/database/shared/relations.ts` | 确认/补全关系 |
| `src/storage/database/migrations/` | 重新生成 Drizzle 迁移 |
| `scripts/migrate-add-foreign-keys.sql` | 添加剩余外键约束 |
| `scripts/migrate-add-indexes.sql` | 复合索引、部分索引、GIN 索引 |
| `scripts/migrate-updated-at-triggers.sql` | updated_at 自动触发器 |
| `scripts/migrate-ai-settings.sql` | ai_settings 结构化迁移 |
| `scripts/migrate-v1-to-v2.sql` | 总迁移脚本 |
| `scripts/rollback-v2-to-v1.sql` | 回滚脚本 |
| `src/lib/ai-client.ts` | 适配结构化 ai_settings |

---

## 任务 1：补全 schema 外键定义并生成迁移

**文件：**
- 修改：`src/storage/database/shared/schema.ts`
- 创建：`src/storage/database/migrations/0002_*.sql`（重新生成）

- [ ] **步骤 1：读取当前 schema.ts 中所有表定义**

- [ ] **步骤 2：为以下字段补充 `.references()` 外键定义**

```ts
// students
adminTeacherId: varchar("admin_teacher_id", { length: 36 }).references(() => teachers.id, { onDelete: "set null" }),
currentTeacherId: varchar("current_teacher_id", { length: 36 }).references(() => teachers.id, { onDelete: "set null" }),
classId: varchar("class_id", { length: 36 }).references(() => classes.id, { onDelete: "set null" }),

// feedbacks
studentId: varchar("student_id", { length: 36 }).notNull().references(() => students.id, { onDelete: "cascade" }),
teacherId: varchar("teacher_id", { length: 36 }).notNull().references(() => teachers.id, { onDelete: "restrict" }),
parentFeedbackId: varchar("parent_feedback_id", { length: 36 }).references(() => feedbacks.id, { onDelete: "set null" }),

// classes
teacherId: varchar("teacher_id", { length: 36 }).references(() => teachers.id, { onDelete: "set null" }),

// classTransfers
studentId: varchar("student_id", { length: 36 }).notNull().references(() => students.id, { onDelete: "cascade" }),
fromTeacherId: varchar("from_teacher_id", { length: 36 }).references(() => teachers.id, { onDelete: "set null" }),
toTeacherId: varchar("to_teacher_id", { length: 36 }).notNull().references(() => teachers.id, { onDelete: "restrict" }),

// studentClasses
studentId: varchar("student_id", { length: 36 }).notNull().references(() => students.id, { onDelete: "cascade" }),
classId: varchar("class_id", { length: 36 }).notNull().references(() => classes.id, { onDelete: "cascade" }),

// coursePrompts
stageCode: varchar("stage_code", { length: 50 }).notNull().references(() => courseStages.stageCode, { onDelete: "cascade" }),
```

- [ ] **步骤 3：重新生成 Drizzle 迁移**

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/edu_db npx drizzle-kit generate
```

- [ ] **步骤 4：提交**

```bash
git add src/storage/database/shared/schema.ts src/storage/database/migrations/
git commit -m "feat(db): add foreign key constraints to schema and regenerate migration"
```

---

## 任务 2：创建外键约束 SQL 脚本

**文件：**
- 创建：`scripts/migrate-add-foreign-keys.sql`

- [ ] **步骤 1：创建脚本**

```sql
-- scripts/migrate-add-foreign-keys.sql
-- 添加 Phase 1 外键约束（幂等）

ALTER TABLE classes
  DROP CONSTRAINT IF EXISTS fk_classes_teacher,
  ADD CONSTRAINT fk_classes_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL;

ALTER TABLE students
  DROP CONSTRAINT IF EXISTS fk_students_admin_teacher,
  ADD CONSTRAINT fk_students_admin_teacher FOREIGN KEY (admin_teacher_id) REFERENCES teachers(id) ON DELETE SET NULL;

ALTER TABLE students
  DROP CONSTRAINT IF EXISTS fk_students_current_teacher,
  ADD CONSTRAINT fk_students_current_teacher FOREIGN KEY (current_teacher_id) REFERENCES teachers(id) ON DELETE SET NULL;

ALTER TABLE students
  DROP CONSTRAINT IF EXISTS fk_students_class,
  ADD CONSTRAINT fk_students_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL;

ALTER TABLE feedbacks
  DROP CONSTRAINT IF EXISTS fk_feedbacks_student,
  ADD CONSTRAINT fk_feedbacks_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

ALTER TABLE feedbacks
  DROP CONSTRAINT IF EXISTS fk_feedbacks_teacher,
  ADD CONSTRAINT fk_feedbacks_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE RESTRICT;

ALTER TABLE feedbacks
  DROP CONSTRAINT IF EXISTS fk_feedbacks_parent,
  ADD CONSTRAINT fk_feedbacks_parent FOREIGN KEY (parent_feedback_id) REFERENCES feedbacks(id) ON DELETE SET NULL;

ALTER TABLE class_transfers
  DROP CONSTRAINT IF EXISTS fk_class_transfers_student,
  ADD CONSTRAINT fk_class_transfers_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

ALTER TABLE class_transfers
  DROP CONSTRAINT IF EXISTS fk_class_transfers_from_teacher,
  ADD CONSTRAINT fk_class_transfers_from_teacher FOREIGN KEY (from_teacher_id) REFERENCES teachers(id) ON DELETE SET NULL;

ALTER TABLE class_transfers
  DROP CONSTRAINT IF EXISTS fk_class_transfers_to_teacher,
  ADD CONSTRAINT fk_class_transfers_to_teacher FOREIGN KEY (to_teacher_id) REFERENCES teachers(id) ON DELETE RESTRICT;

ALTER TABLE student_classes
  DROP CONSTRAINT IF EXISTS fk_student_classes_student,
  ADD CONSTRAINT fk_student_classes_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

ALTER TABLE student_classes
  DROP CONSTRAINT IF EXISTS fk_student_classes_class,
  ADD CONSTRAINT fk_student_classes_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;

ALTER TABLE course_prompts
  DROP CONSTRAINT IF EXISTS fk_course_prompts_stage,
  ADD CONSTRAINT fk_course_prompts_stage FOREIGN KEY (stage_code) REFERENCES course_stages(stage_code) ON DELETE CASCADE;
```

- [ ] **步骤 2：提交**

```bash
git add scripts/migrate-add-foreign-keys.sql
git commit -m "feat(db): add foreign key constraints migration script"
```

---

## 任务 3：创建索引优化 SQL 脚本

**文件：**
- 创建：`scripts/migrate-add-indexes.sql`

- [ ] **步骤 1：创建脚本**

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

- [ ] **步骤 2：提交**

```bash
git add scripts/migrate-add-indexes.sql
git commit -m "feat(db): add composite, partial and GIN indexes"
```

---

## 任务 4：创建 updated_at 触发器 SQL 脚本

**文件：**
- 创建：`scripts/migrate-updated-at-triggers.sql`

- [ ] **步骤 1：创建脚本**

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

- [ ] **步骤 2：提交**

```bash
git add scripts/migrate-updated-at-triggers.sql
git commit -m "feat(db): add updated_at auto-update triggers"
```

---

## 任务 5：重构 ai_settings 为结构化表

**文件：**
- 修改：`src/storage/database/shared/schema.ts`
- 修改：`src/storage/database/shared/relations.ts`（如需要）
- 修改：`src/lib/ai-client.ts`
- 创建：`scripts/migrate-ai-settings.sql`
- 创建：`src/storage/database/migrations/0003_*.sql`（重新生成）

- [ ] **步骤 1：更新 schema.ts 中 aiSettings 表定义**

```ts
export const aiSettings = pgTable(
  "ai_settings",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    apiKey: text("api_key"),
    baseUrl: text("base_url"),
    modelId: varchar("model_id", { length: 100 }).notNull().default("gpt-3.5-turbo"),
    maxConcurrent: integer("max_concurrent").notNull().default(5),
    systemPrompt: text("system_prompt"),
    useCustomAi: boolean("use_custom_ai").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [index("ai_settings_updated_idx").on(table.updatedAt)]
);
```

- [ ] **步骤 2：更新 ai-client.ts 中 getAISettings 函数读取结构化字段**

读取 `src/lib/ai-client.ts` 并替换 key-value 查询为结构化查询：

```ts
const rows = await db.select().from(aiSettings).limit(1);
const data = rows[0];
```

- [ ] **步骤 3：创建 SQL 迁移脚本**

```sql
-- scripts/migrate-ai-settings.sql
-- 将 ai_settings 从 key-value 重构为结构化表

ALTER TABLE ai_settings RENAME TO ai_settings_old;

CREATE TABLE ai_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key TEXT,
  base_url TEXT,
  model_id VARCHAR(100) NOT NULL DEFAULT 'gpt-3.5-turbo',
  max_concurrent INTEGER NOT NULL DEFAULT 5,
  system_prompt TEXT,
  use_custom_ai BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO ai_settings (api_key, base_url, model_id, max_concurrent, system_prompt, use_custom_ai)
SELECT
  MAX(CASE WHEN setting_key = 'api_key' THEN setting_value END) AS api_key,
  MAX(CASE WHEN setting_key = 'base_url' THEN setting_value END) AS base_url,
  COALESCE(MAX(CASE WHEN setting_key = 'model_id' THEN setting_value END), 'gpt-3.5-turbo') AS model_id,
  COALESCE((MAX(CASE WHEN setting_key = 'max_concurrent' THEN setting_value END))::int, 5) AS max_concurrent,
  MAX(CASE WHEN setting_key = 'system_prompt' THEN setting_value END) AS system_prompt,
  COALESCE((MAX(CASE WHEN setting_key = 'use_custom_ai' THEN setting_value END))::boolean, false) AS use_custom_ai
FROM ai_settings_old;

DROP TABLE ai_settings_old;
```

- [ ] **步骤 4：重新生成 Drizzle 迁移**

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/edu_db npx drizzle-kit generate
```

- [ ] **步骤 5：提交**

```bash
git add src/storage/database/shared/schema.ts src/lib/ai-client.ts scripts/migrate-ai-settings.sql src/storage/database/migrations/
git commit -m "feat(db): restructure ai_settings to structured table and adapt ai-client"
```

---

## 任务 6：创建总迁移脚本与回滚脚本

**文件：**
- 创建：`scripts/migrate-v1-to-v2.sql`
- 创建：`scripts/rollback-v2-to-v1.sql`

- [ ] **步骤 1：创建总迁移脚本**

```sql
-- scripts/migrate-v1-to-v2.sql
-- 执行前务必备份数据库

\set ON_ERROR_STOP on
BEGIN;
\i scripts/migrate-add-foreign-keys.sql
\i scripts/migrate-add-indexes.sql
\i scripts/migrate-updated-at-triggers.sql
\i scripts/migrate-feedback-items.sql
\i scripts/migrate-ability-scores.sql
\i scripts/migrate-ai-settings.sql
COMMIT;
```

- [ ] **步骤 2：创建回滚脚本**

```sql
-- scripts/rollback-v2-to-v1.sql
-- 仅回滚结构变更，不删除已迁移到新表的数据

DROP TABLE IF EXISTS feedback_items CASCADE;
DROP TABLE IF EXISTS feedback_ability_scores CASCADE;

-- 回滚 ai_settings
ALTER TABLE IF EXISTS ai_settings RENAME TO ai_settings_new;
ALTER TABLE IF EXISTS ai_settings_old RENAME TO ai_settings;

-- 删除触发器
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY['teachers','students','classes','feedbacks','course_stages','course_prompts','ai_settings'])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS tr_%s_updated_at ON %I', t, t);
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS update_updated_at_column();
```

- [ ] **步骤 3：提交**

```bash
git add scripts/migrate-v1-to-v2.sql scripts/rollback-v2-to-v1.sql
git commit -m "feat(db): add full migration and rollback scripts"
```

---

## 任务 7：运行验证并提交最终修复

**文件：**
- 按需修改

- [ ] **步骤 1：运行类型检查**

```bash
pnpm ts-check
```

- [ ] **步骤 2：运行 ESLint**

```bash
pnpm lint
```

- [ ] **步骤 3：修复错误（如有）并提交**

```bash
git add -A
git commit -m "fix: resolve lint and type errors"
```

---

## 计划自检

1. **规格覆盖度：** Phase 1 剩余的外键、索引、触发器、ai_settings 重构、总迁移/回滚脚本均已覆盖。
2. **占位符扫描：** 无 TODO/待定，所有脚本包含实际 SQL/TypeScript。
3. **类型一致性：** ai_settings 字段名在 schema、ai-client、迁移脚本中保持一致。
