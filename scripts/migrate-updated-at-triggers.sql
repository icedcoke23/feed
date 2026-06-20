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
