/**
 * Routes notifications : liste, compte non lus, marquer lu.
 */
import { query } from '../config/db.js';

const LIST_LIMIT = 20;

export function registerNotificationsRoutes(fastify, authenticate) {
  /** GET /api/notifications - Liste des 20 dernières + compte non lus */
  fastify.get('/notifications', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user.id;
    const rows = await query(
      `SELECT id, type, message, data, created_at, is_read
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [userId, LIST_LIMIT]
    );
    const unreadRows = await query(
      'SELECT COUNT(*) as cnt FROM notifications WHERE user_id = ? AND is_read = 0',
      [userId]
    );
    const unreadCount = Number(unreadRows[0]?.cnt ?? 0);
    const notifications = (rows || []).map((r) => ({
      id: r.id,
      type: r.type,
      message: r.message,
      data: typeof r.data === 'string' ? (r.data ? JSON.parse(r.data) : null) : r.data,
      created_at: r.created_at,
      is_read: Boolean(r.is_read)
    }));
    return { notifications, unreadCount };
  });

  /** POST /api/notifications/mark-read - Marquer des notifications comme lues */
  fastify.post('/notifications/mark-read', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user.id;
    const ids = Array.isArray(request.body?.ids) ? request.body.ids.map(Number).filter((id) => Number.isInteger(id) && id > 0) : [];
    if (ids.length === 0) {
      return { success: true, marked: 0 };
    }
    const placeholders = ids.map(() => '?').join(',');
    const result = await query(
      `UPDATE notifications SET is_read = 1 WHERE user_id = ? AND id IN (${placeholders})`,
      [userId, ...ids]
    );
    const affected = Array.isArray(result) ? 0 : (result?.affectedRows ?? 0);
    return { success: true, marked: affected };
  });
}
