-- 补充复合索引，优化常用查询
CREATE INDEX IF NOT EXISTS "feedbacks_student_created_idx" ON "feedbacks" ("student_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "student_classes_student_active_idx" ON "student_classes" ("student_id", "is_active");
CREATE INDEX IF NOT EXISTS "classes_name_teacher_idx" ON "classes" ("name", "teacher_id");

-- 自动更新 updated_at 字段的触发器
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
