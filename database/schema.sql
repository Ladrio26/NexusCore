-- Nexus Core Arena - Schéma principal
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- Utilisateurs
CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(64) NOT NULL,
  role VARCHAR(32) NOT NULL DEFAULT 'player',
  elo INT NOT NULL DEFAULT 0,
  pvp_elo INT NOT NULL DEFAULT 0,
  last_login_at DATETIME DEFAULT NULL,
  last_daily_reward_claim_at DATETIME DEFAULT NULL,
  last_opponent_id INT UNSIGNED DEFAULT NULL,
  avatar_url VARCHAR(512) DEFAULT NULL,
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_display_name (display_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Portefeuille (crédits, noyaux, fragments, essence d'ascension)
CREATE TABLE IF NOT EXISTS user_wallet (
  user_id INT UNSIGNED NOT NULL PRIMARY KEY,
  credits INT UNSIGNED NOT NULL DEFAULT 0,
  cores INT UNSIGNED NOT NULL DEFAULT 0,
  fragments INT UNSIGNED NOT NULL DEFAULT 0,
  ascension_essence INT UNSIGNED NOT NULL DEFAULT 0,
  gold INT UNSIGNED NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Unités (catalogue global)
CREATE TABLE IF NOT EXISTS units (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(64) NOT NULL,
  name VARCHAR(128) NOT NULL,
  rarity VARCHAR(32) NOT NULL DEFAULT 'common',
  role VARCHAR(32) NOT NULL DEFAULT 'ranged',
  attack_type VARCHAR(32) NOT NULL DEFAULT 'melee',
  element VARCHAR(32) NOT NULL DEFAULT 'neutral',
  archetype VARCHAR(64) NOT NULL DEFAULT 'DISTANCE_DPS',
  base_hp INT UNSIGNED NOT NULL DEFAULT 1000,
  base_attack INT UNSIGNED NOT NULL DEFAULT 80,
  base_defense INT UNSIGNED NOT NULL DEFAULT 80,
  base_speed INT UNSIGNED NOT NULL DEFAULT 80,
  mastery INT UNSIGNED NOT NULL DEFAULT 0,
  traits JSON DEFAULT NULL,
  skill_data JSON DEFAULT NULL,
  image_url VARCHAR(512) DEFAULT NULL,
  synergy_tag VARCHAR(64) DEFAULT NULL,
  core_type VARCHAR(64) DEFAULT NULL,
  specA_bonus_stat VARCHAR(32) DEFAULT NULL,
  specB_bonus_stat VARCHAR(32) DEFAULT NULL,
  specA_skill_modifier JSON DEFAULT NULL,
  specB_skill_modifier JSON DEFAULT NULL,
  specA_passive JSON DEFAULT NULL,
  specB_passive JSON DEFAULT NULL,
  UNIQUE KEY uq_units_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Unités possédées par les joueurs
CREATE TABLE IF NOT EXISTS user_units (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  unit_id INT UNSIGNED NOT NULL,
  level INT UNSIGNED NOT NULL DEFAULT 1,
  xp INT UNSIGNED NOT NULL DEFAULT 0,
  specialization VARCHAR(8) DEFAULT NULL,
  power_level TINYINT UNSIGNED NOT NULL DEFAULT 1,
  power_openings INT UNSIGNED NOT NULL DEFAULT 1,
  ascension_count INT UNSIGNED NOT NULL DEFAULT 0,
  fatigue INT UNSIGNED NOT NULL DEFAULT 0,
  fatigue_last_update DATETIME DEFAULT NULL,
  injury_level INT UNSIGNED NOT NULL DEFAULT 0,
  is_injured TINYINT(1) NOT NULL DEFAULT 0,
  KEY idx_user_units_user (user_id),
  KEY idx_user_units_unit (unit_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Artefacts possédés par les joueurs (un artefact = une instance, l'UI les empile par type/niveau)
CREATE TABLE IF NOT EXISTS user_artifacts (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  stat_key VARCHAR(16) NOT NULL,
  level INT UNSIGNED NOT NULL DEFAULT 0,
  equipped_user_unit_id INT UNSIGNED DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_user_artifacts_user (user_id),
  KEY idx_user_artifacts_equipped_unit (equipped_user_unit_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (equipped_user_unit_id) REFERENCES user_units(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Équipes (mode ranked / classique)
CREATE TABLE IF NOT EXISTS teams (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  name VARCHAR(64) NOT NULL DEFAULT 'Default',
  mode VARCHAR(32) NOT NULL DEFAULT 'ranked',
  frontline_slots JSON DEFAULT NULL,
  backline_slots JSON DEFAULT NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 1,
  KEY idx_teams_user (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Presets d'équipe (1-10 par utilisateur)
CREATE TABLE IF NOT EXISTS user_team_presets (
  user_id INT UNSIGNED NOT NULL,
  preset_index TINYINT UNSIGNED NOT NULL,
  preset_name VARCHAR(64) DEFAULT NULL,
  front_slots JSON DEFAULT NULL,
  back_slots JSON DEFAULT NULL,
  selected_noyau_index INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, preset_index),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Défense PvP (preset utilisé)
CREATE TABLE IF NOT EXISTS pvp_defenses (
  user_id INT UNSIGNED NOT NULL PRIMARY KEY,
  preset_id TINYINT UNSIGNED NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Historique des combats PvP
CREATE TABLE IF NOT EXISTS pvp_battles (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  attacker_id INT UNSIGNED NOT NULL,
  defender_id INT UNSIGNED DEFAULT NULL,
  defender_type VARCHAR(16) NOT NULL DEFAULT 'npc',
  result VARCHAR(16) NOT NULL,
  elo_before INT NOT NULL,
  elo_after INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_pvp_battles_attacker (attacker_id),
  FOREIGN KEY (attacker_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Récompenses de palier PvP déjà obtenues pour une saison
CREATE TABLE IF NOT EXISTS pvp_rank_reward_claims (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  season_key VARCHAR(7) NOT NULL,
  reward_key VARCHAR(32) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_pvp_rank_reward_claims (user_id, season_key, reward_key),
  KEY idx_pvp_rank_reward_claims_user (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Combat en attente de validation finale après visionnage
CREATE TABLE IF NOT EXISTS pending_battles (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL UNIQUE,
  battle_type VARCHAR(32) NOT NULL,
  payload JSON NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_pending_battles_type (battle_type),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  type VARCHAR(64) NOT NULL,
  message TEXT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  KEY idx_notifications_user (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Combats classés (historique)
CREATE TABLE IF NOT EXISTS battles (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_a_id INT UNSIGNED NOT NULL,
  user_b_id INT UNSIGNED NOT NULL,
  is_ghost TINYINT(1) NOT NULL DEFAULT 0,
  result VARCHAR(32) NOT NULL,
  elo_delta_a INT NOT NULL,
  elo_delta_b INT NOT NULL,
  team_a_snapshot JSON DEFAULT NULL,
  team_b_snapshot JSON DEFAULT NULL,
  battle_log JSON DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_battles_user_a (user_a_id),
  KEY idx_battles_user_b (user_b_id),
  FOREIGN KEY (user_a_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (user_b_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Étapes de campagne
CREATE TABLE IF NOT EXISTS campaign_stages (
  chapter TINYINT UNSIGNED NOT NULL,
  stage TINYINT UNSIGNED NOT NULL,
  is_boss TINYINT(1) NOT NULL DEFAULT 0,
  normal_multiplier DECIMAL(6,3) NOT NULL DEFAULT 1.000,
  hard_multiplier DECIMAL(6,3) NOT NULL DEFAULT 1.000,
  enemy_template JSON DEFAULT NULL,
  boss_unit_code VARCHAR(64) DEFAULT NULL,
  PRIMARY KEY (chapter, stage)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Progression campagne normale
CREATE TABLE IF NOT EXISTS campaign_progress_normal (
  user_id INT UNSIGNED NOT NULL,
  chapter TINYINT UNSIGNED NOT NULL,
  stage TINYINT UNSIGNED NOT NULL,
  cleared TINYINT(1) NOT NULL DEFAULT 0,
  reward_claimed TINYINT(1) NOT NULL DEFAULT 0,
  cleared_at DATETIME DEFAULT NULL,
  PRIMARY KEY (user_id, chapter, stage),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Progression campagne hard
CREATE TABLE IF NOT EXISTS campaign_progress_hard (
  user_id INT UNSIGNED NOT NULL,
  season_key VARCHAR(32) NOT NULL,
  chapter TINYINT UNSIGNED NOT NULL,
  stage TINYINT UNSIGNED NOT NULL,
  cleared TINYINT(1) NOT NULL DEFAULT 0,
  reward_claimed TINYINT(1) NOT NULL DEFAULT 0,
  cleared_at DATETIME DEFAULT NULL,
  PRIMARY KEY (user_id, season_key, chapter, stage),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Récompenses campagne
CREATE TABLE IF NOT EXISTS campaign_rewards (
  chapter TINYINT UNSIGNED NOT NULL,
  stage TINYINT UNSIGNED NOT NULL,
  mode VARCHAR(16) NOT NULL,
  credits INT UNSIGNED NOT NULL DEFAULT 0,
  cores INT UNSIGNED NOT NULL DEFAULT 0,
  fragments INT UNSIGNED NOT NULL DEFAULT 0,
  ascension_essence INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (chapter, stage, mode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Modificateurs des boss de campagne
CREATE TABLE IF NOT EXISTS campaign_boss_modifiers (
  chapter TINYINT UNSIGNED NOT NULL,
  stage TINYINT UNSIGNED NOT NULL,
  normal_modifier JSON DEFAULT NULL,
  hard_modifier JSON DEFAULT NULL,
  PRIMARY KEY (chapter, stage)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Pitié gacha par bannière
CREATE TABLE IF NOT EXISTS gacha_pity (
  user_id INT UNSIGNED NOT NULL,
  banner_key VARCHAR(64) NOT NULL,
  total_pulls INT UNSIGNED NOT NULL DEFAULT 0,
  pity_epic INT UNSIGNED NOT NULL DEFAULT 0,
  pity_legendary INT UNSIGNED NOT NULL DEFAULT 0,
  pity_mythic INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, banner_key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- File de matchmaking
CREATE TABLE IF NOT EXISTS matchmaking_queue (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  mode VARCHAR(32) NOT NULL DEFAULT 'ranked',
  elo_snapshot INT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'searching',
  search_start_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_search_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  current_range INT UNSIGNED NOT NULL DEFAULT 50,
  KEY idx_matchmaking_user (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Guildes
CREATE TABLE IF NOT EXISTS guilds (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(30) NOT NULL,
  owner_user_id INT UNSIGNED NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_guilds_name (name),
  KEY idx_guilds_owner (owner_user_id),
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Membres de guilde
CREATE TABLE IF NOT EXISTS guild_members (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  guild_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  role ENUM('leader', 'officer', 'member') NOT NULL DEFAULT 'member',
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_guild_members_user (user_id),
  UNIQUE KEY uq_guild_members_guild_user (guild_id, user_id),
  KEY idx_guild_members_guild (guild_id),
  FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Demandes d'adhésion de guilde
CREATE TABLE IF NOT EXISTS guild_join_requests (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  guild_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_guild_join_requests_user (user_id),
  UNIQUE KEY uq_guild_join_requests_guild_user (guild_id, user_id),
  KEY idx_guild_join_requests_guild (guild_id),
  FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Monnaie de guilde par joueur
CREATE TABLE IF NOT EXISTS guild_currencies (
  user_id INT UNSIGNED NOT NULL PRIMARY KEY,
  guild_coins INT UNSIGNED NOT NULL DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Rotations hebdomadaires du portail de guilde
CREATE TABLE IF NOT EXISTS guild_portal_rotations (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  rotation_key VARCHAR(16) NOT NULL,
  week_year INT UNSIGNED NOT NULL,
  week_number TINYINT UNSIGNED NOT NULL,
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_guild_portal_rotations_key (rotation_key),
  KEY idx_guild_portal_rotations_week (week_year, week_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Unités présentes dans la rotation active
CREATE TABLE IF NOT EXISTS guild_portal_rotation_units (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  rotation_id INT UNSIGNED NOT NULL,
  unit_id INT UNSIGNED NOT NULL,
  rarity VARCHAR(32) NOT NULL,
  slot_index TINYINT UNSIGNED NOT NULL,
  UNIQUE KEY uq_guild_portal_rotation_slot (rotation_id, slot_index),
  UNIQUE KEY uq_guild_portal_rotation_unit (rotation_id, unit_id),
  KEY idx_guild_portal_rotation_rarity (rotation_id, rarity),
  FOREIGN KEY (rotation_id) REFERENCES guild_portal_rotations(id) ON DELETE CASCADE,
  FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Historique des invocations du portail de guilde
CREATE TABLE IF NOT EXISTS guild_portal_summons (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  guild_id INT UNSIGNED NOT NULL,
  rotation_id INT UNSIGNED NOT NULL,
  unit_id INT UNSIGNED NOT NULL,
  rarity VARCHAR(32) NOT NULL,
  cost INT UNSIGNED NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_guild_portal_summons_user (user_id),
  KEY idx_guild_portal_summons_guild (guild_id),
  KEY idx_guild_portal_summons_rotation (rotation_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
  FOREIGN KEY (rotation_id) REFERENCES guild_portal_rotations(id) ON DELETE CASCADE,
  FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Messages de chat de guilde
CREATE TABLE IF NOT EXISTS guild_chat_messages (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  guild_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  message VARCHAR(500) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_guild_chat_messages_guild_created (guild_id, created_at),
  KEY idx_guild_chat_messages_user (user_id),
  FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
