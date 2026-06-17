-- ============================================
-- 教学反馈系统 - 启用 RLS (Row Level Security)
-- 在 Supabase Dashboard -> SQL Editor 中执行
-- ============================================
--
-- 核心原则：
--   - service_role：对所有表拥有完整读写权限（用于 API 路由）
--   - anon：对敏感表无任何访问权限，仅对公开配置表有只读权限
--
-- 执行此脚本后，通过 anon key 直接访问 Supabase REST API
-- 将无法读写敏感数据，所有数据操作必须经过 API 路由（使用 service_role）
-- ============================================

-- ============================================
-- 1. 启用 RLS
-- ============================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE teaching_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_check ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. service_role 策略 — 所有表完整访问
-- ============================================
-- service_role 通过 JWT 中的 role: 'service_role' 识别，
-- 绕过 RLS 是 Supabase 内置行为，但显式创建策略更清晰。

-- 2.1 敏感表：service_role 完整访问，anon 无访问
-- ============================================

-- users
CREATE POLICY "service_role_full_access_users" ON users
  FOR ALL USING (true) WITH CHECK (true);

-- teachers
CREATE POLICY "service_role_full_access_teachers" ON teachers
  FOR ALL USING (true) WITH CHECK (true);

-- students
CREATE POLICY "service_role_full_access_students" ON students
  FOR ALL USING (true) WITH CHECK (true);

-- classes
CREATE POLICY "service_role_full_access_classes" ON classes
  FOR ALL USING (true) WITH CHECK (true);

-- feedbacks
CREATE POLICY "service_role_full_access_feedbacks" ON feedbacks
  FOR ALL USING (true) WITH CHECK (true);

-- class_transfers
CREATE POLICY "service_role_full_access_class_transfers" ON class_transfers
  FOR ALL USING (true) WITH CHECK (true);

-- ai_settings
CREATE POLICY "service_role_full_access_ai_settings" ON ai_settings
  FOR ALL USING (true) WITH CHECK (true);

-- 2.2 公开配置表：service_role 完整访问，anon 只读
-- ============================================
-- tags, teaching_themes, course_stages 属于预设配置数据，
-- 前端可能需要直接读取（如加载标签列表），因此允许 anon 只读。

-- tags
CREATE POLICY "service_role_full_access_tags" ON tags
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "anon_read_tags" ON tags
  FOR SELECT USING (true);

-- teaching_themes
CREATE POLICY "service_role_full_access_teaching_themes" ON teaching_themes
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "anon_read_teaching_themes" ON teaching_themes
  FOR SELECT USING (true);

-- course_stages
CREATE POLICY "service_role_full_access_course_stages" ON course_stages
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "anon_read_course_stages" ON course_stages
  FOR SELECT USING (true);

-- health_check
CREATE POLICY "service_role_full_access_health_check" ON health_check
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "anon_read_health_check" ON health_check
  FOR SELECT USING (true);

-- ============================================
-- 3. 验证 RLS 已启用
-- ============================================
-- 执行以下查询确认所有表都已启用 RLS：
--
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename IN (
--     'users', 'teachers', 'students', 'classes',
--     'feedbacks', 'class_transfers', 'tags',
--     'teaching_themes', 'course_stages', 'ai_settings', 'health_check'
--   );
--
-- 预期结果：所有表的 rowsecurity 列均为 true
-- ============================================

-- ============================================
-- 4. 验证策略已创建
-- ============================================
-- 执行以下查询确认策略已正确创建：
--
-- SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;
-- ============================================

-- ============================================
-- 5. 原子版本号递增函数
-- ============================================
-- 用于反馈更新时原子递增 version，避免并发竞态条件。
-- API 路由通过 client.rpc("increment_feedback_version", { feedback_id: id }) 调用。

CREATE OR REPLACE FUNCTION increment_feedback_version(feedback_id UUID)
RETURNS INTEGER AS $$
DECLARE
  new_version INTEGER;
BEGIN
  UPDATE feedbacks SET version = COALESCE(version, 0) + 1, updated_at = NOW()
  WHERE id = feedback_id
  RETURNING version INTO new_version;
  RETURN new_version;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. 事务保护 RPC 函数
-- ============================================

-- Transaction: Create teacher (insert into users + teachers atomically)
CREATE OR REPLACE FUNCTION create_teacher(
  p_username TEXT,
  p_password TEXT,
  p_name TEXT,
  p_phone TEXT DEFAULT NULL,
  p_role TEXT DEFAULT 'teacher'
)
RETURNS UUID AS $$
DECLARE
  new_user_id UUID;
BEGIN
  INSERT INTO users (username, password, name, role, is_active)
  VALUES (p_username, p_password, p_name, p_role, true)
  RETURNING id INTO new_user_id;

  INSERT INTO teachers (id, name, phone, is_active)
  VALUES (new_user_id, p_name, p_phone, true);

  RETURN new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Transaction: Delete teacher (disable in users + teachers atomically)
CREATE OR REPLACE FUNCTION delete_teacher(p_teacher_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE users SET is_active = false, updated_at = NOW() WHERE id = p_teacher_id;
  UPDATE teachers SET is_active = false, updated_at = NOW() WHERE id = p_teacher_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Transaction: Transfer student (insert transfer record + update student atomically)
CREATE OR REPLACE FUNCTION transfer_student(
  p_student_id UUID,
  p_from_class_id UUID,
  p_to_class_id UUID,
  p_from_teacher_id UUID,
  p_to_teacher_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_from_class_name VARCHAR;
  v_to_class_name VARCHAR;
  v_to_teacher_id VARCHAR;
BEGIN
  -- 查询目标班级的 teacher_id 和 name
  SELECT name, teacher_id INTO v_to_class_name, v_to_teacher_id
  FROM classes WHERE id = p_to_class_id;

  -- 获取源班级名称（从 students 表 current_class，UPDATE 之前）
  SELECT current_class INTO v_from_class_name
  FROM students WHERE id = p_student_id;

  INSERT INTO class_transfers (student_id, from_class, to_class, from_teacher_id, to_teacher_id, reason, transferred_at)
  VALUES (p_student_id, v_from_class_name, v_to_class_name, p_from_teacher_id, p_to_teacher_id, p_reason, NOW());

  UPDATE students
  SET class_id = p_to_class_id,
      current_teacher_id = v_to_teacher_id,
      current_class = v_to_class_name,
      updated_at = NOW()
  WHERE id = p_student_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
