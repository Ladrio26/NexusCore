-- Patch V1 Guilde - Nexus Core Arena
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS guilds (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(30) NOT NULL,
  owner_user_id INT UNSIGNED NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_guilds_name (name),
  KEY idx_guilds_owner (owner_user_id),
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE IF NOT EXISTS guild_currencies (
  user_id INT UNSIGNED NOT NULL PRIMARY KEY,
  guild_coins INT UNSIGNED NOT NULL DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE IF NOT EXISTS guild_notifications (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  guild_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  type VARCHAR(32) NOT NULL,
  data JSON NOT NULL DEFAULT (JSON_OBJECT()),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_guild_notif_guild_created (guild_id, created_at),
  KEY idx_guild_notif_user (user_id),
  FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
