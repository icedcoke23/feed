-- ============================================
-- 教学反馈系统 - 数据库初始化脚本
-- 在 Supabase Dashboard -> SQL Editor 中执行
-- ============================================

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

-- 课程阶段专属 AI 提示词表
CREATE TABLE IF NOT EXISTS course_prompts (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_code VARCHAR(50) NOT NULL UNIQUE,
  system_prompt TEXT,
  report_structure TEXT,
  word_limit VARCHAR(20),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS course_prompts_stage_code_idx ON course_prompts(stage_code);
CREATE INDEX IF NOT EXISTS course_prompts_active_idx ON course_prompts(is_active);

-- 健康检查表
CREATE TABLE IF NOT EXISTS health_check (
  id SERIAL PRIMARY KEY,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 创建管理员账户（密码: admin123）
-- bcrypt hash 由 pgcrypto 生成
-- ============================================
INSERT INTO users (username, password, name, role, is_active)
VALUES ('admin', crypt('admin123', gen_salt('bf')), '管理员', 'admin', true)
ON CONFLICT (username) DO NOTHING;

-- ============================================
-- 预设标签数据
-- ============================================

-- 学员优点（strength）
INSERT INTO tags (category, name, description, sort_order, is_active) VALUES
-- 通用能力
('strength', '创造力', '作品有创意，敢于尝试新方案', 1, true),
('strength', '协作能力', '团队合作中沟通顺畅，分工合理', 2, true),
('strength', '表达能力', '能清晰描述作品结构、功能和原理', 3, true),
('strength', '调试排错能力', '能独立发现并修复程序bug和硬件问题', 4, true),
-- 大颗粒/小颗粒/BricQ - 乐高搭建类
('strength', '空间建构能力', '能理解三维结构，搭建作品空间布局合理', 10, true),
('strength', '机械原理理解', '能正确运用齿轮、杠杆、滑轮等机械原理', 11, true),
('strength', '动手操作能力', '搭建精细度高，操作熟练，作品牢固稳定', 12, true),
('strength', '互锁结构掌握', '能熟练运用平面互锁、转角互锁、阶梯互锁等搭建技巧', 13, true),
('strength', '传动原理运用', '能正确搭建齿轮传动、蜗轮蜗杆、连杆等传动结构', 14, true),
('strength', '生活认知与观察', '能观察生活中的物品和现象，并在搭建中还原', 15, true),
-- WeDo/SPIKE - 机器人编程类
('strength', '传感器应用能力', '能正确选择和使用各类传感器', 20, true),
('strength', '软硬件联动能力', '能实现传感器与执行器的正确联动控制', 21, true),
('strength', '图形化编程能力', '积木编程逻辑清晰，程序结构合理', 22, true),
('strength', '硬件连接与调试', '能正确连接硬件设备，快速排查连接问题', 23, true),
('strength', '多设备协同能力', '能实现多传感器、多电机的协调控制', 24, true),
('strength', '梁结构搭建能力', '能熟练使用梁、销、轴搭建稳定的机械结构', 25, true),
-- Scratch/Python/C++ - 代码编程类
('strength', '代码编程能力', '语法掌握扎实，代码规范，逻辑严谨', 30, true),
('strength', '算法思维能力', '能将复杂问题拆解为可执行的算法步骤', 31, true),
('strength', '程序逻辑清晰', '代码逻辑清晰，结构合理，易于理解', 32, true),
('strength', '项目设计能力', '能独立进行需求分析和模块划分', 33, true),
('strength', '竞赛解题能力', '能快速理解题目要求，设计高效算法', 34, true),
('strength', '数据结构应用', '能合理选择和使用数组、链表、栈、队列等数据结构', 35, true)
ON CONFLICT (category, name) DO NOTHING;

-- 能力提升（improvement）
INSERT INTO tags (category, name, description, sort_order, is_active) VALUES
-- 通用能力
('improvement', '独立思考能力', '遇到问题能自主分析，减少依赖', 1, true),
('improvement', '问题解决能力', '面对困难时的分析和解决能力持续进步', 2, true),
('improvement', '自主学习能力', '主动探索和独立思考的意愿增强', 3, true),
('improvement', '创新思维能力', '作品创意性提升，敢于尝试新方法', 4, true),
('improvement', '抗挫折能力', '遇到失败时情绪管理和再尝试意愿提升', 5, true),
-- 乐高搭建类
('improvement', '结构设计能力', '搭建结构越来越合理，稳定性持续提升', 10, true),
('improvement', '机械分析能力', '能越来越准确地分析模型的传动路径和受力原理', 11, true),
('improvement', '搭建速度提升', '搭建效率明显提高，能在规定时间内完成作品', 12, true),
('improvement', '作品创意性提升', '从照搬图纸到自主设计，作品越来越有个性', 13, true),
-- 机器人编程类
('improvement', '编程逻辑优化能力', '编程逻辑越来越清晰，代码效率提升', 20, true),
('improvement', '工程任务拆解能力', '能将复杂任务分解为可执行的步骤', 21, true),
('improvement', '传感器运用进步', '从单一传感器到多传感器协同，应用能力持续提升', 22, true),
('improvement', '软硬件协同进步', '编程与硬件配合越来越默契，联动效果更流畅', 23, true),
-- 代码编程类
('improvement', '语言表达能力', '描述作品和思路越来越清晰', 30, true),
('improvement', '代码规范提升', '命名越来越规范，代码结构越来越清晰', 31, true),
('improvement', '算法优化意识', '从能实现功能到追求更高效的算法', 32, true),
('improvement', '科学探究能力', '对原理的好奇心和探究精神增强', 33, true),
('improvement', '数学应用能力', '能将数学知识应用到编程和搭建中', 34, true),
('improvement', '团队协作能力', '合作中的沟通和协调能力进步', 35, true)
ON CONFLICT (category, name) DO NOTHING;

-- 需要提升（weakness）
INSERT INTO tags (category, name, description, sort_order, is_active) VALUES
-- 通用
('weakness', '专注力', '课堂学习投入程度和持续时间需提升', 1, true),
('weakness', '畏难情绪', '遇到挑战容易退缩，需要更多鼓励', 2, true),
('weakness', '依赖性强', '过度依赖教师指导，自主性需培养', 3, true),
('weakness', '细节把控', '容易忽略细节，需培养严谨态度', 4, true),
('weakness', '时间管理', '任务时间分配和效率需提升', 5, true),
-- 乐高搭建类
('weakness', '空间想象不足', '搭建时空间布局规划能力需加强', 10, true),
('weakness', '机械原理理解薄弱', '对传动原理和力学概念理解不够', 11, true),
('weakness', '动手协调性弱', '搭建速度和精细度有待提高', 12, true),
('weakness', '搭建不够牢固', '作品结构松散，互锁结构运用不够', 13, true),
('weakness', '照搬缺乏创意', '过于依赖图纸，缺少自主设计和创新', 14, true),
-- 机器人编程类
('weakness', '软硬件联动困难', '编程与硬件配合的思路需加强', 20, true),
('weakness', '编程逻辑混乱', '程序逻辑不够清晰，结构需优化', 21, true),
('weakness', '传感器使用单一', '只会使用一种传感器，缺乏组合运用意识', 22, true),
('weakness', '硬件连接不熟练', '设备连接容易出错，调试速度慢', 23, true),
-- 代码编程类
('weakness', '编码习惯', '代码命名和结构规范需要改进', 30, true),
('weakness', '学习习惯', '课堂参与和课后练习的主动性需加强', 31, true),
('weakness', '算法思路受限', '解题方法单一，缺乏多角度思考', 32, true),
('weakness', '调试能力不足', '遇到bug不知如何排查，缺乏系统调试方法', 33, true),
('weakness', '抽象思维薄弱', '函数/类/模块的抽象能力需加强', 34, true)
ON CONFLICT (category, name) DO NOTHING;

-- ============================================
-- 预设教学主题数据
-- ============================================

INSERT INTO teaching_themes (name, category, description, sort_order) VALUES
('生活家电', '科技生活', '探索日常家电的工作原理', 1),
('生命科学和自然环境', '自然科学', '了解生命和自然奥秘', 2),
('工程机械', '工程技术', '学习机械结构和工作原理', 3),
('智能机器人', '人工智能', '机器人编程与控制', 4),
('编程思维', '计算机科学', '培养计算思维和算法能力', 5),
('电子电路', '电子技术', '学习电路原理和电子元件', 6),
('3D建模与打印', '数字制造', '三维设计和快速成型技术', 7),
('航空航天', '航天科技', '探索航空航天知识', 8),
('积木搭建与结构设计', '乐高教育', '积木搭建技巧与结构设计原理', 9),
('机械传动与物理原理', '工程技术', '机械传动机制与物理原理应用', 10),
('传感器与智能感知', '人工智能', '传感器原理与智能感知技术', 11),
('机器人竞赛', '竞赛活动', '机器人竞赛策略与实战训练', 12),
('游戏与互动媒体', '计算机科学', '游戏设计与互动媒体创作', 13),
('数学与逻辑推理', '数学思维', '数学思维训练与逻辑推理能力培养', 14)
ON CONFLICT DO NOTHING;
