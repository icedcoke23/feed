-- scripts/migrate-ai-settings.sql
-- 将 ai_settings 从 key-value 重构为结构化表

ALTER TABLE ai_settings RENAME TO ai_settings_old;

CREATE TABLE ai_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key TEXT,
  base_url TEXT,
  model_id VARCHAR(100) NOT NULL DEFAULT 'gpt-3.5-turbo',
  max_concurrent INTEGER NOT NULL DEFAULT 5,
  system_prompt TEXT,
  use_custom_ai BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO ai_settings (api_key, base_url, model_id, max_concurrent, system_prompt, use_custom_ai)
SELECT
  MAX(CASE WHEN setting_key = 'api_key' THEN setting_value END) AS api_key,
  MAX(CASE WHEN setting_key = 'base_url' THEN setting_value END) AS base_url,
  COALESCE(MAX(CASE WHEN setting_key = 'model_id' THEN setting_value END), 'gpt-3.5-turbo') AS model_id,
  COALESCE((MAX(CASE WHEN setting_key = 'max_concurrent' THEN setting_value END))::int, 5) AS max_concurrent,
  MAX(CASE WHEN setting_key = 'system_prompt' THEN setting_value END) AS system_prompt,
  COALESCE((MAX(CASE WHEN setting_key = 'use_custom_ai' THEN setting_value END))::boolean, false) AS use_custom_ai
FROM ai_settings_old;

DROP TABLE ai_settings_old;
