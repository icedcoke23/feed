ALTER TABLE "feedback_ability_scores" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "feedback_items" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "feedback_ability_scores" CASCADE;--> statement-breakpoint
DROP TABLE "feedback_items" CASCADE;--> statement-breakpoint
CREATE INDEX "transfers_student_transferred_idx" ON "class_transfers" USING btree ("student_id","transferred_at");--> statement-breakpoint
CREATE INDEX "classes_name_teacher_idx" ON "classes" USING btree ("name","teacher_id");--> statement-breakpoint
CREATE INDEX "classes_active_teacher_idx" ON "classes" USING btree ("teacher_id") WHERE "classes"."is_active" = true;--> statement-breakpoint
CREATE INDEX "course_stages_active_theme_level_idx" ON "course_stages" USING btree ("theme","level") WHERE "course_stages"."is_active" = true;--> statement-breakpoint
CREATE INDEX "feedbacks_status_idx" ON "feedbacks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "feedbacks_period_idx" ON "feedbacks" USING btree ("period_start","period_end");--> statement-breakpoint
CREATE INDEX "feedbacks_student_created_idx" ON "feedbacks" USING btree ("student_id","created_at");--> statement-breakpoint
CREATE INDEX "feedbacks_teacher_created_idx" ON "feedbacks" USING btree ("teacher_id","created_at");--> statement-breakpoint
CREATE INDEX "feedbacks_status_created_idx" ON "feedbacks" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "feedbacks_metadata_gin_idx" ON "feedbacks" USING gin ("metadata");--> statement-breakpoint
CREATE INDEX "feedbacks_work_info_gin_idx" ON "feedbacks" USING gin ("work_info");--> statement-breakpoint
CREATE INDEX "student_classes_student_active_idx" ON "student_classes" USING btree ("student_id","is_active");--> statement-breakpoint
CREATE INDEX "students_admin_created_idx" ON "students" USING btree ("admin_teacher_id","created_at");--> statement-breakpoint
CREATE INDEX "students_active_name_idx" ON "students" USING btree ("name") WHERE "students"."is_active" = true;--> statement-breakpoint
CREATE INDEX "teachers_active_role_idx" ON "teachers" USING btree ("role") WHERE "teachers"."is_active" = true;--> statement-breakpoint

-- 自动更新 updated_at 字段的触发器（从原 0001_indexes_and_triggers.sql 合并）
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

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