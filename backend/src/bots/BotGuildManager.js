/**
 * BotGuildManager.js
 * Gère l'appartenance des bots à leurs guildes.
 *
 * Logique de rotation :
 *  - Tous les BOTS_PER_GUILD (6) bots auto-créés, le 6e crée une nouvelle guilde
 *    (géré dans BotAutoSpawner.createAutoBot).
 *  - Les autres bots rejoignent la guilde de bots la plus récente ayant encore de la place.
 *  - Une "guilde de bots" = guilde dont le propriétaire est lui-même un bot (dans bot_profiles).
 *  - Capacité par guilde : BOTS_PER_GUILD membres.
 */

import { query, withTransaction } from '../config/db.js';
import { ensureGuildCurrency, GUILD_ROLES } from '../services/guildService.js';
import { botLog } from './BotUtils.js';

const BOTS_PER_GUILD = 6;

// ── Requêtes internes ─────────────────────────────────────────────────────────

/** Vérifie si le bot est déjà membre d'une guilde. */
async function getBotGuildMembership(userId) {
  const rows = await query(
    'SELECT guild_id FROM guild_members WHERE user_id = ? LIMIT 1',
    [Number(userId)]
  );
  return rows.length ? Number(rows[0].guild_id) : null;
}

/**
 * Retourne la guilde de bots la plus récente ayant encore de la place.
 * Critère "guilde de bots" : le propriétaire (owner_user_id) est dans bot_profiles.
 */
async function getLatestOpenBotGuild() {
  const rows = await query(
    `SELECT g.id, COUNT(gm.user_id) AS member_count
       FROM guilds g
       JOIN bot_profiles bp ON bp.user_id = g.owner_user_id
       JOIN guild_members gm ON gm.guild_id = g.id
      GROUP BY g.id
     HAVING member_count < ?
      ORDER BY g.created_at DESC
      LIMIT 1`,
    [BOTS_PER_GUILD]
  );
  return rows.length ? Number(rows[0].id) : null;
}

// ── API publique ──────────────────────────────────────────────────────────────

/**
 * S'assure que le bot est membre d'une guilde de bots.
 *
 * - Si déjà dans une guilde : rien à faire.
 * - Sinon : cherche la guilde de bots la plus récente avec de la place et l'y ajoute.
 * - Si aucune guilde disponible (le créateur n'est pas encore passé) : skip silencieux,
 *   la fonction sera rappelée au prochain tick.
 *
 * @param {number} userId
 */
export async function ensureBotInGuild(userId) {
  const currentGuild = await getBotGuildMembership(userId);
  if (currentGuild !== null) return;

  const guildId = await getLatestOpenBotGuild();
  if (!guildId) {
    // Pas encore de guilde disponible — sera résolu au prochain tick
    return;
  }

  // Double-check (race condition légère possible si deux bots tickent en parallèle)
  const already = await getBotGuildMembership(userId);
  if (already !== null) return;

  await withTransaction(async (tx) => {
    await tx.query(
      `INSERT IGNORE INTO guild_members (guild_id, user_id, role, joined_at)
       VALUES (?, ?, ?, NOW())`,
      [guildId, Number(userId), GUILD_ROLES.MEMBER]
    );
    await ensureGuildCurrency(userId, tx);
  });

  botLog(userId, `Rejoint la guilde id=${guildId}`);
}
