-- scripts/migrate-v1-to-v2.sql
-- 执行前务必备份数据库

\set ON_ERROR_STOP on
BEGIN;
\i scripts/migrate-add-foreign-keys.sql
\i scripts/migrate-add-indexes.sql
\i scripts/migrate-updated-at-triggers.sql
\i scripts/migrate-feedback-items.sql
\i scripts/migrate-ability-scores.sql
\i scripts/migrate-ai-settings.sql
COMMIT;
