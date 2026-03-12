#!/usr/bin/env node
/**
 * Supprime toutes les défenses d'une guilde pour la guerre active.
 * Usage: node backend/scripts/clear-guild-war-defenses.mjs "Report Waboku"
 */
import { getPool } from '../src/config/db.js';

const guildName = process.argv[2] || 'Report Waboku';

async function main() {
  const pool = getPool();

  const [guildRows] = await pool.execute(
    'SELECT id FROM guilds WHERE name = ? LIMIT 1',
    [guildName]
  );
  if (!guildRows.length) {
    console.error('Guilde non trouvée:', guildName);
    process.exit(1);
  }
  const guildId = guildRows[0].id;

  const [warRows] = await pool.execute(
    `SELECT id FROM guild_wars
     WHERE (guild_a_id = ? OR guild_b_id = ?) AND status != 'finished'
     ORDER BY id DESC LIMIT 1`,
    [guildId, guildId]
  );
  if (!warRows.length) {
    console.error('Aucune guerre active pour cette guilde.');
    process.exit(1);
  }
  const warId = warRows[0].id;

  const [result] = await pool.execute(
    'DELETE FROM guild_war_defenses WHERE war_id = ? AND guild_id = ?',
    [warId, guildId]
  );

  const affected = result?.affectedRows ?? 0;
  console.log(`Défenses supprimées pour ${guildName} (war_id=${warId}): ${affected} slot(s).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
