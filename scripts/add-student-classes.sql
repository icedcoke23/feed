-- 学生-班级关联表（多对多）
CREATE TABLE IF NOT EXISTS student_classes (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id VARCHAR(36) NOT NULL,
  class_id VARCHAR(36) NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,  -- 是否为主班级
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 唯一约束：一个学生在同一个班级中只能有一条记录
CREATE UNIQUE INDEX IF NOT EXISTS student_classes_unique_idx ON student_classes(student_id, class_id);
CREATE INDEX IF NOT EXISTS student_classes_student_idx ON student_classes(student_id);
CREATE INDEX IF NOT EXISTS student_classes_class_idx ON student_classes(class_id);

-- 启用 RLS
ALTER TABLE student_classes ENABLE ROW LEVEL SECURITY;

-- RLS 策略：管理员可看所有，授课老师只能看自己班级的关联，教务老师只能看自己负责学生的关联
CREATE POLICY "Admin can see all student_classes" ON student_classes FOR ALL USING (true);
