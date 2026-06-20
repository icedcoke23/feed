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
