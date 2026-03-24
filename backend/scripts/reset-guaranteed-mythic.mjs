#!/usr/bin/env node
/**
 * Réattribue la garantie mythique à la prochaine invocation pour LZDAlpha et Hixxy.
 * À exécuter une fois pour donner une nouvelle chance après un échec précédent.
 * Usage: node backend/scripts/reset-guaranteed-mythic.mjs
 */
import { getPool } from '../src/config/db.js';

async function main() {
  const pool = getPool();

  // Assure que la table existe
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS user_guaranteed_next_mythic (
      user_id INT UNSIGNED NOT NULL PRIMARY KEY,
      used TINYINT UNSIGNED NOT NULL DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Insère ou remet used=0 pour LZDAlpha et Hixxy (insensible à la casse)
  const [insertResult] = await pool.execute(`
    INSERT INTO user_guaranteed_next_mythic (user_id, used)
    SELECT id, 0 FROM users WHERE LOWER(TRIM(display_name)) IN ('lzdalpha', 'hixxy', 'klinx')
    ON DUPLICATE KEY UPDATE used = 0
  `);

  console.log('Garantie mythique réattribuée pour LZDAlpha et Hixxy.');
  console.log('Lignes affectées:', insertResult.affectedRows);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
