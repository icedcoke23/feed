-- ============================================
-- 数据库迁移：为 feedbacks 表添加缺失列
-- 在 Supabase Dashboard -> SQL Editor 中执行
-- ============================================

-- 添加 metadata 列（存储反馈的上下文元数据）
ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 添加 work_info 列（存储作品信息）
ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS work_info JSONB DEFAULT '{}';

-- 添加 ability_scores 列（存储能力评分）
ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS ability_scores JSONB DEFAULT '[]';
