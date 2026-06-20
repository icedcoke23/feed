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
