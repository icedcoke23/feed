-- scripts/migrate-feedback-items.sql
-- 拆分 feedbacks.strengths / improvements / weaknesses 到 feedback_items
-- 执行前请确保 feedback_items 表已存在

INSERT INTO feedback_items (feedback_id, tag_id, category, name, description, rating, sort_order)
SELECT
  f.id AS feedback_id,
  t.id AS tag_id,
  item.category,
  COALESCE(item.item->>'name', item.item->>'label', '未命名') AS name,
  item.item->>'description' AS description,
  (item.item->>'rating')::smallint AS rating,
  COALESCE((item.item->>'sort_order')::int, item.ordinality - 1) AS sort_order
FROM feedbacks f,
LATERAL (
  SELECT 'strength' AS category, value AS item, ordinality FROM jsonb_array_elements(f.strengths) WITH ORDINALITY AS value
  UNION ALL
  SELECT 'improvement', value, ordinality FROM jsonb_array_elements(f.improvements) WITH ORDINALITY AS value
  UNION ALL
  SELECT 'weakness', value, ordinality FROM jsonb_array_elements(f.weaknesses) WITH ORDINALITY AS value
) AS item
LEFT JOIN LATERAL (
  SELECT id FROM tags WHERE tags.name = COALESCE(item.item->>'name', item.item->>'label') LIMIT 1
) AS t ON true
WHERE f.strengths IS NOT NULL
   OR f.improvements IS NOT NULL
   OR f.weaknesses IS NOT NULL;
