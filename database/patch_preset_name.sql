-- Ajout du nom de preset si colonne absente (bases créées avant)
SET NAMES utf8mb4;
ALTER TABLE user_team_presets ADD COLUMN IF NOT EXISTS preset_name VARCHAR(64) DEFAULT NULL;
ALTER TABLE user_team_presets ADD COLUMN IF NOT EXISTS selected_noyau_index INT UNSIGNED NOT NULL DEFAULT 0;
