-- À exécuter une fois sur la base Nexus (MySQL / MariaDB).
-- Corrige : Unknown column 'is_boss' in 'INSERT INTO'

ALTER TABLE units
  ADD COLUMN is_boss TINYINT(1) NOT NULL DEFAULT 0
  COMMENT '1 = boss (hors sanctuaire / bestiaire / tirages)';

-- Anciens boss chapitre (codes BOSS_CH*) : aligné avec l’ancien filtre bestiaire
UPDATE units SET is_boss = 1 WHERE code LIKE 'BOSS_CH%';
