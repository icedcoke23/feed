-- scripts/migrate-ability-scores.sql
-- 拆分 feedbacks.ability_scores 到 feedback_ability_scores
-- 执行前请确保 feedback_ability_scores 表已存在

INSERT INTO feedback_ability_scores (feedback_id, ability_name, score)
SELECT
  f.id AS feedback_id,
  kv.key AS ability_name,
  (kv.value::text)::smallint AS score
FROM feedbacks f,
LATERAL jsonb_each_text(f.ability_scores) AS kv
WHERE f.ability_scores IS NOT NULL
  AND jsonb_typeof(f.ability_scores) = 'object';
