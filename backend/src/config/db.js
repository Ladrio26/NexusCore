import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { getAllCustomTreeNodes } from '../data/customUnitDefinitions.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Charge toujours backend/.env, même quand un script est lancé depuis la racine du projet.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const {
  DB_HOST = 'localhost',
  DB_PORT = '3306',
  DB_USER = 'ladrio',
  DB_PASSWORD = 'cerise',
  DB_NAME = 'nexuscore'
} = process.env;

let pool;

export function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: DB_HOST,
      port: Number(DB_PORT),
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      timezone: 'Z'  // Interpréter tous les DATETIME comme UTC (guerres de guilde = Paris)
    });
  }
  return pool;
}

export async function query(sql, params = []) {
  const [rows] = await getPool().execute(sql, params);
  return rows;
}

export async function withTransaction(callback) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const tx = {
      connection,
      query: async (sql, params = []) => {
        const [rows] = await connection.execute(sql, params);
        return rows;
      }
    };
    const result = await callback(tx);
    await connection.commit();
    return result;
  } catch (err) {
    try {
      await connection.rollback();
    } catch {}
    throw err;
  } finally {
    connection.release();
  }
}

export async function ensureDatabaseSchema() {
  let lastError = null;

  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      await query("ALTER TABLE users ADD COLUMN role VARCHAR(32) NOT NULL DEFAULT 'player'");
    } catch (err) {
      if (err?.code !== 'ER_DUP_FIELDNAME') {
        lastError = err;
        if (attempt < 10) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
        throw err;
      }
    }

    try {
      await query('ALTER TABLE users ADD COLUMN last_daily_reward_claim_at DATETIME DEFAULT NULL');
    } catch (err) {
      if (err?.code !== 'ER_DUP_FIELDNAME') {
        lastError = err;
        if (attempt < 10) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
        throw err;
      }
    }

    try {
      await query('ALTER TABLE users ADD COLUMN last_daily_reward_claim_day_key CHAR(10) DEFAULT NULL');
    } catch (err) {
      if (err?.code !== 'ER_DUP_FIELDNAME') {
        lastError = err;
        if (attempt < 10) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
        throw err;
      }
    }

    try {
      await query('ALTER TABLE user_units ADD COLUMN power_level TINYINT UNSIGNED NOT NULL DEFAULT 1');
    } catch (err) {
      if (err?.code !== 'ER_DUP_FIELDNAME') {
        lastError = err;
        if (attempt < 10) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
        throw err;
      }
    }

    try {
      await query('ALTER TABLE user_units ADD COLUMN power_openings INT UNSIGNED NOT NULL DEFAULT 1');
    } catch (err) {
      if (err?.code !== 'ER_DUP_FIELDNAME') {
        lastError = err;
        if (attempt < 10) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
        throw err;
      }
    }

    try {
      await query('ALTER TABLE user_units ADD COLUMN fatigue_last_update DATETIME DEFAULT NULL');
    } catch (err) {
      if (err?.code !== 'ER_DUP_FIELDNAME') {
        lastError = err;
        if (attempt < 10) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
        throw err;
      }
    }

    try {
      await query('ALTER TABLE user_wallet ADD COLUMN gold INT UNSIGNED NOT NULL DEFAULT 0');
    } catch (err) {
      if (err?.code !== 'ER_DUP_FIELDNAME') {
        lastError = err;
        if (attempt < 10) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
        throw err;
      }
    }

    for (const col of ['divine_cores', 'divine_credits', 'divine_fragments']) {
      try {
        await query(`ALTER TABLE user_wallet ADD COLUMN ${col} INT UNSIGNED NOT NULL DEFAULT 0`);
      } catch (err) {
        if (err?.code !== 'ER_DUP_FIELDNAME') {
          lastError = err;
          if (attempt < 10) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            continue;
          }
          throw err;
        }
      }
    }

    try {
      await query(
        'ALTER TABLE users ADD COLUMN combat_tutorial_completed TINYINT(1) NOT NULL DEFAULT 1'
      );
    } catch (err) {
      if (err?.code !== 'ER_DUP_FIELDNAME') {
        lastError = err;
        if (attempt < 10) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
        throw err;
      }
    }

    try {
      await query('ALTER TABLE guild_war_defenses ADD COLUMN preset_id INT UNSIGNED NULL');
    } catch (err) {
      if (err?.code !== 'ER_DUP_FIELDNAME') {
        lastError = err;
        if (attempt < 10) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
        throw err;
      }
    }

    try {
      await query(
        'ALTER TABLE guild_wars ADD COLUMN attack_gap_applied TINYINT(1) NOT NULL DEFAULT 0'
      );
    } catch (err) {
      if (err?.code !== 'ER_DUP_FIELDNAME') {
        lastError = err;
        if (attempt < 10) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
        throw err;
      }
    }

    try {
      await query(
        "ALTER TABLE units ADD COLUMN is_boss TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = boss (hors sanctuaire / bestiaire / tirages)'"
      );
    } catch (err) {
      if (err?.code !== 'ER_DUP_FIELDNAME') {
        lastError = err;
        if (attempt < 10) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
        throw err;
      }
    }

    try {
      await query('ALTER TABLE notifications ADD COLUMN data JSON DEFAULT NULL');
    } catch (err) {
      if (err?.code !== 'ER_DUP_FIELDNAME') {
        lastError = err;
        if (attempt < 10) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
        throw err;
      }
    }

    for (const col of ['combat_kills', 'combat_victories', 'combat_defeats', 'combat_damage_dealt', 'combat_healing_done']) {
      try {
        await query(`ALTER TABLE user_units ADD COLUMN ${col} INT UNSIGNED NOT NULL DEFAULT 0`);
      } catch (err) {
        if (err?.code !== 'ER_DUP_FIELDNAME') {
          lastError = err;
          if (attempt < 10) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            continue;
          }
          throw err;
        }
      }
    }

    await query(
      "UPDATE users SET role = 'player' WHERE role IS NULL OR TRIM(role) = '' OR LOWER(role) NOT IN ('player', 'admin')"
    );
    await query('UPDATE user_units SET power_level = 1 WHERE power_level IS NULL OR power_level < 1');
    await query('UPDATE user_units SET power_openings = 1 WHERE power_openings IS NULL OR power_openings < 1');
    await query('UPDATE user_units SET fatigue_last_update = NOW() WHERE fatigue_last_update IS NULL');
    await query("UPDATE units SET is_boss = 1 WHERE code LIKE 'BOSS_CH%'");
    await query("UPDATE units SET is_boss = 1 WHERE code LIKE 'CUSTOM_U%'");

    await query(`
      CREATE TABLE IF NOT EXISTS pvp_rank_reward_claims (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        season_key VARCHAR(7) NOT NULL,
        reward_key VARCHAR(32) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_pvp_rank_reward_claims (user_id, season_key, reward_key),
        KEY idx_pvp_rank_reward_claims_user (user_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS pending_battles (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL UNIQUE,
        battle_type VARCHAR(32) NOT NULL,
        payload JSON NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        KEY idx_pending_battles_type (battle_type),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS user_artifacts (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        stat_key VARCHAR(32) NOT NULL,
        level INT UNSIGNED NOT NULL DEFAULT 0,
        equipped_user_unit_id INT UNSIGNED DEFAULT NULL,
        rarity VARCHAR(16) NOT NULL DEFAULT 'common',
        extra_data JSON DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        KEY idx_user_artifacts_user (user_id),
        KEY idx_user_artifacts_equipped_unit (equipped_user_unit_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (equipped_user_unit_id) REFERENCES user_units(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    try {
      await query('ALTER TABLE user_artifacts ADD COLUMN rarity VARCHAR(16) NOT NULL DEFAULT \'common\'');
    } catch (err) {
      if (err?.code !== 'ER_DUP_FIELDNAME') throw err;
    }
    try {
      await query('ALTER TABLE user_artifacts ADD COLUMN extra_data JSON DEFAULT NULL');
    } catch (err) {
      if (err?.code !== 'ER_DUP_FIELDNAME') throw err;
    }
    await query("UPDATE user_artifacts SET rarity = 'uncommon' WHERE stat_key = 'immune'");
    await query(`
      CREATE TABLE IF NOT EXISTS guilds (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(30) NOT NULL,
        owner_user_id INT UNSIGNED NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_guilds_name (name),
        KEY idx_guilds_owner (owner_user_id),
        FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await query(`
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await query(`
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS guild_currencies (
        user_id INT UNSIGNED NOT NULL PRIMARY KEY,
        guild_coins INT UNSIGNED NOT NULL DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await query(`
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await query(`
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await query(`
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await query(`
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await query(`
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    // ── Guild War ──────────────────────────────────────────────────────────────
    await query(`
      CREATE TABLE IF NOT EXISTS guild_elo (
        guild_id INT UNSIGNED NOT NULL PRIMARY KEY,
        elo INT NOT NULL DEFAULT 1000,
        wins INT UNSIGNED NOT NULL DEFAULT 0,
        losses INT UNSIGNED NOT NULL DEFAULT 0,
        draws INT UNSIGNED NOT NULL DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS guild_wars (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        guild_a_id INT UNSIGNED NOT NULL,
        guild_b_id INT UNSIGNED NOT NULL,
        start_time DATETIME NOT NULL,
        attack_phase_start DATETIME NOT NULL,
        end_time DATETIME NOT NULL,
        guild_a_score TINYINT UNSIGNED NOT NULL DEFAULT 0,
        guild_b_score TINYINT UNSIGNED NOT NULL DEFAULT 0,
        attack_gap_applied TINYINT(1) NOT NULL DEFAULT 0,
        status ENUM('preparation','attack','finished') NOT NULL DEFAULT 'preparation',
        winner_guild_id INT UNSIGNED NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        KEY idx_guild_wars_a (guild_a_id),
        KEY idx_guild_wars_b (guild_b_id),
        KEY idx_guild_wars_status (status),
        FOREIGN KEY (guild_a_id) REFERENCES guilds(id) ON DELETE CASCADE,
        FOREIGN KEY (guild_b_id) REFERENCES guilds(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS guild_war_defenses (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        war_id INT UNSIGNED NOT NULL,
        guild_id INT UNSIGNED NOT NULL,
        slot_index TINYINT UNSIGNED NOT NULL,
        defender_user_id INT UNSIGNED NULL,
        units_json JSON NULL,
        is_destroyed TINYINT(1) NOT NULL DEFAULT 0,
        destroyed_at DATETIME NULL,
        UNIQUE KEY uq_war_guild_slot (war_id, guild_id, slot_index),
        KEY idx_gwd_war (war_id),
        KEY idx_gwd_guild (guild_id),
        FOREIGN KEY (war_id) REFERENCES guild_wars(id) ON DELETE CASCADE,
        FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
        FOREIGN KEY (defender_user_id) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS guild_war_saved_defenses (
        guild_id INT UNSIGNED NOT NULL,
        slot_index TINYINT UNSIGNED NOT NULL,
        defender_user_id INT UNSIGNED NULL,
        units_json JSON NOT NULL,
        preset_id INT UNSIGNED NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (guild_id, slot_index),
        KEY idx_gwsd_guild (guild_id),
        FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
        FOREIGN KEY (defender_user_id) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS guild_defense_presets (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        guild_id INT UNSIGNED NOT NULL,
        name VARCHAR(50) NOT NULL DEFAULT 'Défense',
        units_json JSON NOT NULL DEFAULT (JSON_ARRAY()),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        KEY idx_gdp_user (user_id),
        KEY idx_gdp_guild (guild_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS guild_war_used_units (
        war_id INT UNSIGNED NOT NULL,
        user_id INT UNSIGNED NOT NULL,
        user_unit_id INT UNSIGNED NOT NULL,
        PRIMARY KEY (war_id, user_id, user_unit_id),
        FOREIGN KEY (war_id) REFERENCES guild_wars(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS guild_war_logs (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        war_id INT UNSIGNED NOT NULL,
        attacker_user_id INT UNSIGNED NOT NULL,
        attacker_username VARCHAR(60) NOT NULL DEFAULT '',
        attacker_guild_id INT UNSIGNED NOT NULL,
        target_slot_index TINYINT UNSIGNED NOT NULL,
        target_guild_id INT UNSIGNED NOT NULL,
        result ENUM('win','loss') NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        KEY idx_gwl_war (war_id),
        FOREIGN KEY (war_id) REFERENCES guild_wars(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS guild_war_notifications (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        war_id INT UNSIGNED NOT NULL,
        guild_id INT UNSIGNED NOT NULL,
        type VARCHAR(32) NOT NULL,
        data JSON NOT NULL DEFAULT (JSON_OBJECT()),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        KEY idx_gwn_war_guild (war_id, guild_id),
        FOREIGN KEY (war_id) REFERENCES guild_wars(id) ON DELETE CASCADE,
        FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS guild_war_unmatched (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        date_key VARCHAR(10) NOT NULL,
        guild_id INT UNSIGNED NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_unmatched_date_guild (date_key, guild_id),
        KEY idx_gwu_date (date_key),
        FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS feedback_tickets (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        status ENUM('proposes','non_prio','acceptes','en_cours','realises','disponibles','refuser') NOT NULL DEFAULT 'proposes',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_feedback_tickets_user (user_id),
        KEY idx_feedback_tickets_status (status),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS user_guaranteed_next_mythic (
        user_id INT UNSIGNED NOT NULL PRIMARY KEY,
        used TINYINT UNSIGNED NOT NULL DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS user_guaranteed_next_legendary_standard (
        user_id INT UNSIGNED NOT NULL PRIMARY KEY,
        used TINYINT UNSIGNED NOT NULL DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await query(`
      INSERT IGNORE INTO user_guaranteed_next_mythic (user_id, used)
      SELECT id, 0 FROM users WHERE LOWER(TRIM(display_name)) IN ('lzdalpha', 'hixxy', 'klinx')
    `);
    await query(
      `INSERT IGNORE INTO user_guaranteed_next_legendary_standard (user_id, used)
       SELECT id, 0 FROM users WHERE display_name = ?`,
      ["Minipoucce l'oméga gentil (ou l'oméga sympa si vous voulez ^_^)"]
    );
    try {
      await query(
        "ALTER TABLE users ADD COLUMN rest_center_slots JSON DEFAULT NULL COMMENT 'Centre de Repos: max 6 user_unit_id'"
      );
    } catch (err) {
      if (err?.code !== 'ER_DUP_FIELDNAME') {
        lastError = err;
        if (attempt < 10) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
        throw err;
      }
    }
    await query(`
      CREATE TABLE IF NOT EXISTS user_dungeon_progress (
        user_id INT UNSIGNED NOT NULL,
        element VARCHAR(16) NOT NULL,
        max_unlocked_level TINYINT UNSIGNED NOT NULL DEFAULT 1,
        PRIMARY KEY (user_id, element),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS user_dungeon_run (
        user_id INT UNSIGNED NOT NULL PRIMARY KEY,
        element VARCHAR(16) NOT NULL,
        level TINYINT UNSIGNED NOT NULL,
        combats_cleared TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '0=début série, 1=après combat1, 2=après combat2',
        team_json JSON NOT NULL,
        selected_noyau_index INT NOT NULL DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    try {
      await query('ALTER TABLE user_dungeon_run DROP COLUMN next_combat_index');
    } catch {
      /* colonne absente ou déjà migrée */
    }
    try {
      await query(
        'ALTER TABLE user_dungeon_run ADD COLUMN combats_cleared TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER level'
      );
    } catch (err) {
      if (err?.code !== 'ER_DUP_FIELDNAME') {
        /* ignore */
      }
    }
    await query(`
      CREATE TABLE IF NOT EXISTS user_dungeon_floor_clear (
        user_id INT UNSIGNED NOT NULL,
        element VARCHAR(16) NOT NULL,
        level TINYINT UNSIGNED NOT NULL,
        cleared_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, element, level),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS dungeon_encounters (
        element VARCHAR(16) NOT NULL,
        level TINYINT UNSIGNED NOT NULL,
        combat_index TINYINT UNSIGNED NOT NULL,
        enemy_template_json JSON NULL COMMENT 'Même forme que campaign enemy_template: { units: [{ code, position, level, specialization }] }',
        PRIMARY KEY (element, level, combat_index)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS custom_units (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        name VARCHAR(128) NOT NULL,
        role VARCHAR(32) NOT NULL,
        element VARCHAR(32) NOT NULL,
        attack_type VARCHAR(16) NOT NULL,
        unit_id INT UNSIGNED DEFAULT NULL,
        is_locked TINYINT(1) NOT NULL DEFAULT 0,
        raid_meta JSON DEFAULT NULL,
        future_creation_cost JSON DEFAULT NULL,
        future_evolution_cost JSON DEFAULT NULL,
        future_evolution_level TINYINT UNSIGNED NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_custom_units_user (user_id),
        KEY idx_custom_units_unit (unit_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    try {
      await query(
        "ALTER TABLE custom_units ADD COLUMN config_json JSON NULL COMMENT 'Unité custom : config budget points (v2)'"
      );
    } catch (e) {
      if (e?.code !== 'ER_DUP_FIELDNAME') {
        console.warn('[ensureDatabaseSchema] custom_units.config_json:', e?.message || e);
      }
    }
    await query(`
      CREATE TABLE IF NOT EXISTS custom_unit_choices (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        custom_unit_id INT UNSIGNED NOT NULL,
        skill_slot TINYINT UNSIGNED NOT NULL DEFAULT 0,
        choice_type VARCHAR(64) NOT NULL,
        choice_value VARCHAR(128) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        KEY idx_cuc_custom (custom_unit_id),
        FOREIGN KEY (custom_unit_id) REFERENCES custom_units(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS custom_unit_snapshots (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        custom_unit_id INT UNSIGNED NOT NULL,
        final_stats_json JSON NOT NULL,
        final_skill1_json JSON NOT NULL,
        final_skill2_json JSON NOT NULL,
        final_preview_json JSON DEFAULT NULL,
        version INT UNSIGNED NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        KEY idx_cus_custom (custom_unit_id),
        FOREIGN KEY (custom_unit_id) REFERENCES custom_units(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS custom_skill_tree_nodes (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        role VARCHAR(32) NOT NULL,
        skill_slot TINYINT NOT NULL,
        node_key VARCHAR(128) NOT NULL,
        node_label VARCHAR(255) NOT NULL,
        step TINYINT NOT NULL,
        choice_group VARCHAR(128) NOT NULL,
        requires_json JSON DEFAULT NULL,
        ui_order INT NOT NULL DEFAULT 0,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        power_cost INT UNSIGNED NOT NULL DEFAULT 1,
        UNIQUE KEY uq_cst_node_key (node_key),
        KEY idx_cst_role (role, skill_slot, step)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    try {
      await query(
        'ALTER TABLE custom_skill_tree_nodes ADD COLUMN power_cost INT UNSIGNED NOT NULL DEFAULT 1'
      );
    } catch (e) {
      if (e?.code !== 'ER_DUP_FIELDNAME') {
        console.warn('[ensureDatabaseSchema] custom_skill_tree_nodes.power_cost:', e?.message || e);
      }
    }
    try {
      const cnt = await query('SELECT COUNT(*) AS n FROM custom_skill_tree_nodes');
      if (Number(cnt[0]?.n) === 0) {
        const nodes = getAllCustomTreeNodes();
        for (const n of nodes) {
          await query(
            `INSERT INTO custom_skill_tree_nodes (role, skill_slot, node_key, node_label, step, choice_group, requires_json, ui_order, is_active, power_cost)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
            [
              n.role,
              n.skillSlot,
              n.nodeKey,
              n.labelFr,
              n.step,
              n.groupId,
              n.requiresOneOf ? JSON.stringify(n.requiresOneOf) : null,
              n.step * 10 + (n.skillSlot === 2 ? 100 : 0),
              Number(n.powerCost ?? 1)
            ]
          );
        }
      }
    } catch (e) {
      console.warn('[ensureDatabaseSchema] seed custom_skill_tree_nodes:', e?.message || e);
    }
    try {
      for (const n of getAllCustomTreeNodes()) {
        await query('UPDATE custom_skill_tree_nodes SET power_cost = ? WHERE node_key = ?', [
          Number(n.powerCost ?? 1),
          n.nodeKey
        ]);
      }
    } catch (e) {
      console.warn('[ensureDatabaseSchema] sync custom_skill_tree_nodes.power_cost:', e?.message || e);
    }
    // Campagne normale : même découpage mensuel (YYYY-MM) que le hard — progression + récompenses first-clear par saison
    try {
      const colRows = await query(`
        SELECT COLUMN_NAME FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'campaign_progress_normal' AND COLUMN_NAME = 'season_key'
      `);
      if (!colRows.length) {
        await query('ALTER TABLE campaign_progress_normal ADD COLUMN season_key VARCHAR(7) NULL AFTER user_id');
        await query(
          `UPDATE campaign_progress_normal SET season_key = DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m') WHERE season_key IS NULL`
        );
        await query('ALTER TABLE campaign_progress_normal MODIFY COLUMN season_key VARCHAR(7) NOT NULL');
        await query(
          'ALTER TABLE campaign_progress_normal DROP PRIMARY KEY, ADD PRIMARY KEY (user_id, season_key, chapter, stage)'
        );
      } else {
        const keyCols = await query(`
          SELECT COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'campaign_progress_normal' AND CONSTRAINT_NAME = 'PRIMARY'
          ORDER BY ORDINAL_POSITION
        `);
        const hasSeasonInPk = keyCols.some((k) => k.COLUMN_NAME === 'season_key');
        if (!hasSeasonInPk) {
          await query(
            `UPDATE campaign_progress_normal SET season_key = DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m') WHERE season_key IS NULL OR season_key = ''`
          );
          await query('ALTER TABLE campaign_progress_normal MODIFY COLUMN season_key VARCHAR(7) NOT NULL');
          await query(
            'ALTER TABLE campaign_progress_normal DROP PRIMARY KEY, ADD PRIMARY KEY (user_id, season_key, chapter, stage)'
          );
        }
      }
    } catch (e) {
      console.warn('[ensureDatabaseSchema] campaign_progress_normal.season_key:', e?.message || e);
    }

    await query(`
      CREATE TABLE IF NOT EXISTS campaign_monthly_enemies (
        month_key VARCHAR(7) NOT NULL,
        mode VARCHAR(16) NOT NULL,
        chapter TINYINT UNSIGNED NOT NULL,
        stage TINYINT UNSIGNED NOT NULL,
        enemy_template JSON NOT NULL COMMENT 'Forme: { units: [{ code, position }] } — niveaux via matrice au combat',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (month_key, mode, chapter, stage),
        KEY idx_cme_month (month_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS campaign_boss_teams (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        mode VARCHAR(16) NOT NULL,
        name VARCHAR(128) NOT NULL,
        sort_order INT NOT NULL DEFAULT 0,
        active TINYINT(1) NOT NULL DEFAULT 1,
        notes TEXT NULL,
        composition JSON NOT NULL COMMENT '{ units: [{code,position}], boss_unit_code }',
        fixed_chapter TINYINT UNSIGNED NULL DEFAULT NULL COMMENT 'Si 10 : toujours affectée au boss chapitre 10 (non mélangée)',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_cbt_mode (mode, active, sort_order)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    try {
      await query(
        'ALTER TABLE campaign_boss_teams ADD COLUMN fixed_chapter TINYINT UNSIGNED NULL DEFAULT NULL COMMENT \'Si 10 : boss final ch.10, non mélangé\' AFTER composition'
      );
    } catch (e) {
      if (e?.code !== 'ER_DUP_FIELDNAME') {
        console.warn('[ensureDatabaseSchema] campaign_boss_teams.fixed_chapter:', e?.message || e);
      }
    }
    try {
      await query(
        'UPDATE campaign_boss_teams SET fixed_chapter = 10 WHERE sort_order = 10 AND (fixed_chapter IS NULL OR fixed_chapter = 0)'
      );
    } catch (e) {
      console.warn('[ensureDatabaseSchema] campaign_boss_teams fixed_chapter seed:', e?.message || e);
    }
    await query(`
      CREATE TABLE IF NOT EXISTS campaign_boss_assignments (
        month_key VARCHAR(7) NOT NULL,
        mode VARCHAR(16) NOT NULL,
        chapter TINYINT UNSIGNED NOT NULL,
        boss_team_id INT UNSIGNED NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (month_key, mode, chapter),
        KEY idx_cba_team (boss_team_id),
        CONSTRAINT fk_cba_boss_team FOREIGN KEY (boss_team_id) REFERENCES campaign_boss_teams(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS campaign_stage_level_overrides (
        mode VARCHAR(16) NOT NULL,
        chapter TINYINT UNSIGNED NOT NULL,
        stage TINYINT UNSIGNED NOT NULL,
        level TINYINT UNSIGNED NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (mode, chapter, stage),
        KEY idx_cslo_mode (mode)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS gacha_sanctuary_pull_log (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        pull_type VARCHAR(32) NOT NULL,
        banner_key VARCHAR(64) NOT NULL,
        cost_currency VARCHAR(32) NOT NULL,
        cost_amount INT UNSIGNED NOT NULL DEFAULT 0,
        unit_id INT UNSIGNED NOT NULL,
        unit_rarity VARCHAR(32) NOT NULL,
        is_new_unit TINYINT(1) NOT NULL DEFAULT 0,
        duplicate_credits INT UNSIGNED NOT NULL DEFAULT 0,
        duplicate_fragments INT UNSIGNED NOT NULL DEFAULT 0,
        batch_id CHAR(36) DEFAULT NULL,
        batch_index TINYINT UNSIGNED DEFAULT NULL,
        batch_size TINYINT UNSIGNED DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        KEY idx_gacha_sanctuary_pull_user_created (user_id, created_at),
        KEY idx_gacha_sanctuary_pull_batch (batch_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ── Système de bots joueurs ──────────────────────────────────────────────
    await query(`
      CREATE TABLE IF NOT EXISTS bot_profiles (
        user_id    INT UNSIGNED NOT NULL,
        profile    VARCHAR(32)  NOT NULL DEFAULT 'balanced',
        enabled    TINYINT(1)   NOT NULL DEFAULT 1,
        created_at DATETIME     DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS bot_runtime_state (
        user_id            INT UNSIGNED NOT NULL,
        current_action     VARCHAR(64)  DEFAULT NULL,
        next_action_at     DATETIME     DEFAULT NULL,
        cooldowns_json     JSON         DEFAULT NULL,
        dungeon_state_json JSON         DEFAULT NULL,
        last_action_at     DATETIME     DEFAULT NULL,
        action_count       INT UNSIGNED NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS bot_action_logs (
        id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id     INT UNSIGNED    NOT NULL,
        action      VARCHAR(64)     NOT NULL,
        success     TINYINT(1)      NOT NULL DEFAULT 1,
        detail_json JSON            DEFAULT NULL,
        created_at  DATETIME        DEFAULT CURRENT_TIMESTAMP,
        KEY idx_bal_user_created (user_id, created_at),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS bot_profile_definitions (
        profile_key           VARCHAR(64)  NOT NULL PRIMARY KEY,
        display_label         VARCHAR(128) NOT NULL,
        extends_key           VARCHAR(64)  DEFAULT NULL COMMENT 'Profil code de base (balanced, farmer, …) pour les profils custom',
        action_priority_json  JSON         NOT NULL,
        overrides_json        JSON         DEFAULT NULL,
        updated_at            DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    try {
      await query(
        "ALTER TABLE bot_profiles MODIFY COLUMN profile VARCHAR(64) NOT NULL DEFAULT 'balanced'"
      );
    } catch {
      /* Déjà appliqué ou table absente sur vieux dump — ignoré */
    }

    return;
  }

  if (lastError) {
    throw lastError;
  }
}

