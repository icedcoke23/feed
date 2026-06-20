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
