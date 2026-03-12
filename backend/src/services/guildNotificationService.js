import { query } from '../config/db.js';

export const GUILD_NOTIFICATION_TYPES = Object.freeze({
  MEMBER_JOIN: 'member_join',
  SUMMON_MYTHIC: 'summon_mythic',
  SUMMON_LEGENDARY: 'summon_legendary',
  CAMPAIGN_BOSS_KILL: 'campaign_boss_kill'
});

const MAX_NOTIFICATIONS_PER_GUILD = 500;
const FETCH_LIMIT = 50;

/**
 * Crée une notification pour la guilde d'un utilisateur.
 * Silencieuse : ne lève jamais d'exception pour ne pas bloquer les flux existants.
 * Appeler sans await si l'on ne veut pas attendre.
 */
export async function createGuildNotification(guildId, userId, type, data = {}) {
  try {
    const normalizedGuildId = Number(guildId);
    const normalizedUserId = Number(userId);
    if (!normalizedGuildId || !normalizedUserId || !type) return;

    await query(
      `INSERT INTO guild_notifications (guild_id, user_id, type, data, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [normalizedGuildId, normalizedUserId, String(type), JSON.stringify(data)]
    );

    // Nettoyage asynchrone sans bloquer
    void cleanupOldGuildNotifications(normalizedGuildId);
  } catch {
    // Silencieux — les notifications ne doivent jamais casser un flux principal
  }
}

/**
 * Supprime les notifications excédentaires pour une guilde (garde MAX_NOTIFICATIONS_PER_GUILD).
 */
export async function cleanupOldGuildNotifications(guildId) {
  try {
    const rows = await query(
      `SELECT id FROM guild_notifications
       WHERE guild_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT 1 OFFSET ?`,
      [Number(guildId), MAX_NOTIFICATIONS_PER_GUILD - 1]
    );
    if (!rows.length) return;
    const cutoffId = Number(rows[0].id);
    await query(
      'DELETE FROM guild_notifications WHERE guild_id = ? AND id < ?',
      [Number(guildId), cutoffId]
    );
  } catch {
    // Silencieux
  }
}

/**
 * Récupère les FETCH_LIMIT notifications les plus récentes d'une guilde.
 * Retourne les données enrichies avec le pseudo de l'utilisateur.
 */
export async function getGuildNotifications(guildId) {
  const rows = await query(
    `SELECT gn.id,
            gn.type,
            gn.data,
            gn.created_at,
            u.display_name AS username
     FROM guild_notifications gn
     JOIN users u ON u.id = gn.user_id
     WHERE gn.guild_id = ?
     ORDER BY gn.created_at DESC, gn.id DESC
     LIMIT ?`,
    [Number(guildId), FETCH_LIMIT]
  );

  return rows.map((row) => ({
    id: Number(row.id),
    type: String(row.type),
    username: row.username ?? 'Inconnu',
    data: typeof row.data === 'string' ? JSON.parse(row.data) : (row.data ?? {}),
    created_at: row.created_at
  }));
}

/**
 * Résout le guild_id d'un utilisateur à partir de guild_members.
 * Retourne null si le joueur n'est pas en guilde.
 */
export async function resolveUserGuildId(userId) {
  try {
    const rows = await query(
      'SELECT guild_id FROM guild_members WHERE user_id = ? LIMIT 1',
      [Number(userId)]
    );
    return rows.length ? Number(rows[0].guild_id) : null;
  } catch {
    return null;
  }
}
