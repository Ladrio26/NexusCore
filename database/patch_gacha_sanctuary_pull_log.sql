-- Historique des invocations sanctuaire (hors portail de guilde).
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS gacha_sanctuary_pull_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  pull_type VARCHAR(32) NOT NULL COMMENT 'standard, core, resonance, divine_standard, etc.',
  banner_key VARCHAR(64) NOT NULL,
  cost_currency VARCHAR(32) NOT NULL COMMENT 'credits, cores, fragments, divine_credits, …',
  cost_amount INT UNSIGNED NOT NULL DEFAULT 0,
  unit_id INT UNSIGNED NOT NULL,
  unit_rarity VARCHAR(32) NOT NULL,
  is_new_unit TINYINT(1) NOT NULL DEFAULT 0,
  duplicate_credits INT UNSIGNED NOT NULL DEFAULT 0,
  duplicate_fragments INT UNSIGNED NOT NULL DEFAULT 0,
  batch_id CHAR(36) DEFAULT NULL COMMENT 'UUID commun pour un pack x10',
  batch_index TINYINT UNSIGNED DEFAULT NULL COMMENT '0..9 dans le batch',
  batch_size TINYINT UNSIGNED DEFAULT NULL COMMENT '10 pour x10',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_gacha_sanctuary_pull_user_created (user_id, created_at),
  KEY idx_gacha_sanctuary_pull_batch (batch_id),
  CONSTRAINT fk_gacha_sanctuary_pull_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_gacha_sanctuary_pull_unit FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
