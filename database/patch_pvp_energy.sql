-- Compteur PvP horaire (0-10), reset chaque heure UTC (exécuter une fois si colonnes absentes)
ALTER TABLE users ADD COLUMN pvp_energy TINYINT UNSIGNED NOT NULL DEFAULT 10
  COMMENT 'Combats PvP restants (0-10), reset chaque heure UTC';
ALTER TABLE users ADD COLUMN pvp_energy_hour_key VARCHAR(32) DEFAULT NULL
  COMMENT 'Heure UTC du dernier reset (YYYY-MM-DDTHH)';
