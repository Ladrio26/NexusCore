#!/usr/bin/env node
/**
 * Supprime la défense #slot pour un joueur (par display_name).
 * Usage: node backend/scripts/delete-guild-war-defense.mjs Ladrio 2
 */
import { getPool } from '../src/config/db.js';

const displayName = process.argv[2] || 'Ladrio';
const slot = parseInt(process.argv[3] || '2', 10);

async function main() {
  const pool = getPool();
  const [userRows] = await pool.execute('SELECT id FROM users WHERE display_name = ? LIMIT 1', [displayName]);
  if (!userRows.length) {
    console.error('Joueur non trouvé:', displayName);
    process.exit(1);
  }
  const userId = userRows[0].id;

  const [memberRows] = await pool.execute('SELECT guild_id FROM guild_members WHERE user_id = ? LIMIT 1', [userId]);
  if (!memberRows.length) {
    console.error('Le joueur n\'est dans aucune guilde.');
    process.exit(1);
  }
  const guildId = memberRows[0].guild_id;

  const [warRows] = await pool.execute(
    `SELECT id FROM guild_wars WHERE (guild_a_id = ? OR guild_b_id = ?) AND status != 'finished' ORDER BY id DESC LIMIT 1`,
    [guildId, guildId]
  );
  if (!warRows.length) {
    console.error('Aucune guerre active pour cette guilde.');
    process.exit(1);
  }
  const warId = warRows[0].id;

  const [delResult] = await pool.execute(
    'DELETE FROM guild_war_defenses WHERE war_id = ? AND guild_id = ? AND slot_index = ?',
    [warId, guildId, slot]
  );

  const affected = delResult?.affectedRows ?? 0;
  if (affected > 0) {
    console.log(`Défense #${slot} du joueur ${displayName} supprimée (war_id=${warId}, guild_id=${guildId}).`);
  } else {
    console.log('Aucune défense trouvée à supprimer.');
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
