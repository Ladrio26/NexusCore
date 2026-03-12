-- Colonnes optionnelles pour units (synergy_tag, core_type) utilisées par la collection
SET NAMES utf8mb4;
ALTER TABLE units ADD COLUMN IF NOT EXISTS synergy_tag VARCHAR(64) DEFAULT NULL;
ALTER TABLE units ADD COLUMN IF NOT EXISTS core_type VARCHAR(64) DEFAULT NULL;
