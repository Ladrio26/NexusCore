#!/usr/bin/env node
/**
 * Supprime une notification de guilde spécifique.
 * Usage: node backend/scripts/delete-guild-notification.mjs "Report Waboku" "Ladrio" "Eggman, Le Penseur Discret" summon_mythic
 */
import { getPool } from '../src/config/db.js';

const guildName = process.argv[2] || 'Report Waboku';
const username = process.argv[3] || 'Ladrio';
const unitName = process.argv[4] || 'Eggman, Le Penseur Discret';
const notifType = process.argv[5] || 'summon_mythic';

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

  const [userRows] = await pool.execute(
    'SELECT id FROM users WHERE display_name = ? LIMIT 1',
    [username]
  );
  if (!userRows.length) {
    console.error('Utilisateur non trouvé:', username);
    process.exit(1);
  }
  const userId = userRows[0].id;

  // Chercher la notification correspondante (type + user + guild + data.unit_name)
  const [notifRows] = await pool.execute(
    `SELECT id FROM guild_notifications
     WHERE guild_id = ? AND user_id = ? AND type = ?
       AND JSON_UNQUOTE(JSON_EXTRACT(data, '$.unit_name')) = ?`,
    [guildId, userId, notifType, unitName]
  );

  if (!notifRows.length) {
    console.log('Aucune notification correspondante trouvée.');
    process.exit(0);
  }

  const notifId = notifRows[0].id;
  await pool.execute('DELETE FROM guild_notifications WHERE id = ?', [notifId]);

  console.log(`Notification supprimée (id=${notifId}): "${username} a invoqué ${unitName} (Mythique) !"`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
