-- Ajout des colonnes de ciblage (basic_targeting, skill_targeting) pour user_units
SET NAMES utf8mb4;
ALTER TABLE user_units ADD COLUMN IF NOT EXISTS basic_targeting VARCHAR(32) DEFAULT NULL;
ALTER TABLE user_units ADD COLUMN IF NOT EXISTS skill_targeting VARCHAR(32) DEFAULT NULL;
