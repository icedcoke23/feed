// 初始化数据库表结构 + 创建管理员账户
// 在新 Supabase 实例上运行

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('错误: 环境变量 SUPABASE_URL 和 SUPABASE_KEY 必须设置。');
  console.error('请先设置后再运行此脚本：');
  console.error('  export SUPABASE_URL="https://your-project.supabase.co"');
  console.error('  export SUPABASE_KEY="your-api-key"');
  process.exit(1);
}

const SQL = `
-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(128) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'teacher',
  phone VARCHAR(20),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS users_username_idx ON users(username);

-- 教师表
CREATE TABLE IF NOT EXISTS teachers (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(128) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(20),
  role VARCHAR(20) NOT NULL DEFAULT 'teacher',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS teachers_email_idx ON teachers(email);

-- 班级表
CREATE TABLE IF NOT EXISTS classes (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  grade VARCHAR(50),
  teacher_id VARCHAR(36),
  schedule VARCHAR(255),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS classes_teacher_idx ON classes(teacher_id);

-- 学生表
CREATE TABLE IF NOT EXISTS students (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(128) NOT NULL,
  grade VARCHAR(50),
  school VARCHAR(255),
  phone VARCHAR(20),
  current_teacher_id VARCHAR(36),
  current_class VARCHAR(100),
  class_id VARCHAR(36),
  admin_teacher_id VARCHAR(36),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS students_teacher_idx ON students(current_teacher_id);
CREATE INDEX IF NOT EXISTS students_name_idx ON students(name);
CREATE INDEX IF NOT EXISTS students_class_idx ON students(class_id);
CREATE INDEX IF NOT EXISTS students_admin_teacher_idx ON students(admin_teacher_id);

-- 教学反馈报告表
CREATE TABLE IF NOT EXISTS feedbacks (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id VARCHAR(36) NOT NULL,
  teacher_id VARCHAR(36) NOT NULL,
  strengths JSONB DEFAULT '[]',
  improvements JSONB DEFAULT '[]',
  weaknesses JSONB DEFAULT '[]',
  teaching_plan JSONB DEFAULT '[]',
  suggestions TEXT,
  ai_report TEXT,
  metadata JSONB DEFAULT '{}',
  work_info JSONB DEFAULT '{}',
  ability_scores JSONB DEFAULT '[]',
  version INTEGER NOT NULL DEFAULT 1,
  parent_feedback_id VARCHAR(36),
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS feedbacks_student_idx ON feedbacks(student_id);
CREATE INDEX IF NOT EXISTS feedbacks_teacher_idx ON feedbacks(teacher_id);
CREATE INDEX IF NOT EXISTS feedbacks_created_idx ON feedbacks(created_at);

-- 转班记录表
CREATE TABLE IF NOT EXISTS class_transfers (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id VARCHAR(36) NOT NULL,
  from_teacher_id VARCHAR(36),
  to_teacher_id VARCHAR(36) NOT NULL,
  from_class VARCHAR(100),
  to_class VARCHAR(100),
  reason TEXT,
  transferred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS transfers_student_idx ON class_transfers(student_id);
CREATE INDEX IF NOT EXISTS transfers_date_idx ON class_transfers(transferred_at);

-- 预设标签表
CREATE TABLE IF NOT EXISTS tags (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS tags_category_idx ON tags(category);
CREATE UNIQUE INDEX IF NOT EXISTS tags_category_name_idx ON tags(category, name);

-- 教学主题表
CREATE TABLE IF NOT EXISTS teaching_themes (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  category VARCHAR(100),
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS themes_category_idx ON teaching_themes(category);

-- 课程阶段预设表
CREATE TABLE IF NOT EXISTS course_stages (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_code VARCHAR(50) NOT NULL UNIQUE,
  stage_name VARCHAR(100) NOT NULL,
  theme VARCHAR(50) NOT NULL,
  level VARCHAR(20) NOT NULL,
  description TEXT,
  content TEXT,
  goal TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS course_stages_theme_idx ON course_stages(theme);
CREATE INDEX IF NOT EXISTS course_stages_level_idx ON course_stages(level);

-- AI 配置表
CREATE TABLE IF NOT EXISTS ai_settings (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_value TEXT,
  description VARCHAR(255),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_settings_key_idx ON ai_settings(setting_key);

-- 健康检查表
CREATE TABLE IF NOT EXISTS health_check (
  id SERIAL PRIMARY KEY,
  updated_at TIMESTAMPTZ DEFAULT now()
);
`;

async function initDatabase() {
  console.log('=== 初始化数据库表结构 ===\n');

  // 使用 Supabase SQL API 执行 DDL
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/pgmeta`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify({ query: SQL }),
  });

  // 如果 RPC 不可用，尝试直接用管理 API
  if (!response.ok) {
    console.log('RPC 方式不可用，尝试逐表创建...');

    // 用 REST API 逐表创建（通过插入一条记录来触发表创建）
    // Supabase REST API 不能执行 DDL，需要用 Supabase Dashboard 或 psql
    console.log('\n无法通过 REST API 创建表结构。');
    console.log('请在 Supabase Dashboard 的 SQL Editor 中执行以下 SQL：\n');
    console.log(SQL);
    console.log('\n或者使用 psql 连接数据库执行。');
    return false;
  }

  console.log('数据库表结构创建成功！');
  return true;
}

async function createAdmin() {
  const bcrypt = require('bcryptjs');
  const adminId = crypto.randomUUID();
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  if (password === 'admin123') {
    console.warn('\n⚠️  警告: 正在使用默认管理员密码 "admin123"，这在生产环境中极不安全！');
    console.warn('⚠️  请通过环境变量 ADMIN_PASSWORD 设置一个强密码，例如：');
    console.warn('⚠️  export ADMIN_PASSWORD="your-strong-password"\n');
  }
  const hashedPassword = await bcrypt.hash(password, 10);

  console.log('\n=== 创建管理员账户 ===\n');

  const response = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({
      id: adminId,
      username: 'admin',
      password: hashedPassword,
      name: '管理员',
      role: 'admin',
      is_active: true,
      created_at: new Date().toISOString(),
    }),
  });

  if (response.ok) {
    console.log('管理员账户创建成功！');
    console.log('  用户名: admin');
    console.log('  密码: ********');
    if (password === 'admin123') {
      console.warn('⚠️  当前使用默认密码，请尽快修改！');
    }
    return true;
  } else {
    const error = await response.text();
    console.error('创建管理员失败:', response.status, error);
    return false;
  }
}

async function main() {
  const dbOk = await initDatabase();
  if (dbOk) {
    await createAdmin();
  } else {
    console.log('\n请先在 Supabase Dashboard 创建表，然后运行: node scripts/create-admin.js');
  }
}

main().catch(console.error);
