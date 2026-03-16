import { query } from '../config/db.js';

const VALID_STATUSES = ['proposes', 'non_prio', 'acceptes', 'en_cours', 'realises', 'disponibles', 'refuser'];

export function registerFeedbackRoutes(fastify, authenticate, requireAdminUser) {
  // ── Utilisateur : créer un ticket ─────────────────────────────────────────
  fastify.post('/feedback/tickets', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const { title, content } = request.body || {};
      const titleStr = typeof title === 'string' ? title.trim() : '';
      const contentStr = typeof content === 'string' ? content.trim() : '';
      if (!titleStr || !contentStr) {
        return reply.code(400).send({
          error: 'TITLE_AND_CONTENT_REQUIRED',
          message: 'Le titre et le contenu sont requis.'
        });
      }
      if (titleStr.length > 255) {
        return reply.code(400).send({
          error: 'TITLE_TOO_LONG',
          message: 'Le titre ne peut pas dépasser 255 caractères.'
        });
      }

      const result = await query(
        'INSERT INTO feedback_tickets (user_id, title, content, status) VALUES (?, ?, ?, ?)',
        [request.user.id, titleStr, contentStr, 'proposes']
      );
      const id = result?.insertId;
      if (!id) {
        return reply.code(500).send({ error: 'CREATE_FAILED', message: 'Échec création du ticket.' });
      }
      const rows = await query(
        'SELECT id, user_id, title, content, status, created_at, updated_at FROM feedback_tickets WHERE id = ?',
        [id]
      );
      return reply.send(rows[0] || { id, user_id: request.user.id, title: titleStr, content: contentStr, status: 'proposes' });
    } catch (err) {
      fastify.log?.error?.(err, '[/feedback/tickets POST] error');
      return reply.code(500).send({
        error: 'CREATE_FAILED',
        message: err?.message || 'Erreur lors de la création du ticket.'
      });
    }
  });

  // ── Utilisateur : parcourir tous les tickets (lecture seule, pour éviter les doublons) ──
  fastify.get('/feedback/browse', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const rows = await query(
        `SELECT t.id, t.user_id, t.title, t.content, t.status, t.created_at, t.updated_at, u.display_name AS author_name
         FROM feedback_tickets t
         LEFT JOIN users u ON u.id = t.user_id
         WHERE t.status != 'refuser'
         ORDER BY t.created_at DESC`
      );
      return reply.send(rows);
    } catch (err) {
      fastify.log?.error?.(err, '[/feedback/browse GET] error');
      return reply.code(500).send({
        error: 'LIST_FAILED',
        message: err?.message || 'Erreur lors du chargement des tickets.'
      });
    }
  });

  // ── Utilisateur : lister ses tickets (sans refuser) ──────────────────────
  fastify.get('/feedback/tickets', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const rows = await query(
        `SELECT id, user_id, title, content, status, created_at, updated_at 
         FROM feedback_tickets 
         WHERE user_id = ? AND status != 'refuser' 
         ORDER BY created_at DESC`,
        [request.user.id]
      );
      return reply.send(rows);
    } catch (err) {
      fastify.log?.error?.(err, '[/feedback/tickets GET] error');
      return reply.code(500).send({
        error: 'LIST_FAILED',
        message: err?.message || 'Erreur lors du chargement des tickets.'
      });
    }
  });

  // ── Utilisateur : détail d'un ticket ─────────────────────────────────────
  fastify.get('/feedback/tickets/:id', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const id = Number(request.params.id);
      if (!Number.isFinite(id) || id < 1) {
        return reply.code(400).send({ error: 'INVALID_ID' });
      }
      const rows = await query(
        'SELECT id, user_id, title, content, status, created_at, updated_at FROM feedback_tickets WHERE id = ? AND user_id = ?',
        [id, request.user.id]
      );
      if (!rows.length) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Ticket non trouvé.' });
      }
      return reply.send(rows[0]);
    } catch (err) {
      fastify.log?.error?.(err, '[/feedback/tickets/:id GET] error');
      return reply.code(500).send({
        error: 'LOAD_FAILED',
        message: err?.message || 'Erreur lors du chargement du ticket.'
      });
    }
  });

  // ── Admin : lister tous les tickets ───────────────────────────────────────
  fastify.get('/admin/feedback/tickets', { preHandler: [authenticate, requireAdminUser] }, async (request, reply) => {
    try {
      const q = request.query || {};
      const includeRefused = String(q.include_refused ?? q.includeRefused ?? '').toLowerCase() === '1' || String(q.include_refused ?? '').toLowerCase() === 'true';
      const statusFilter = q.status ? String(q.status).trim() : null;

      let sql = `
        SELECT t.id, t.user_id, t.title, t.content, t.status, t.created_at, t.updated_at, u.display_name AS author_name
        FROM feedback_tickets t
        LEFT JOIN users u ON u.id = t.user_id
      `;
      const params = [];
      const conditions = [];
      if (!includeRefused) {
        conditions.push("t.status != 'refuser'");
      }
      if (statusFilter && VALID_STATUSES.includes(statusFilter)) {
        conditions.push('t.status = ?');
        params.push(statusFilter);
      }
      if (conditions.length) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }
      sql += ' ORDER BY t.created_at DESC';

      const rows = await query(sql, params);
      return reply.send(rows);
    } catch (err) {
      fastify.log?.error?.(err, '[/admin/feedback/tickets GET] error');
      return reply.code(500).send({
        error: 'LIST_FAILED',
        message: err?.message || 'Erreur lors du chargement des tickets.'
      });
    }
  });

  // ── Admin : mettre à jour le statut d'un ticket ──────────────────────────
  fastify.patch('/admin/feedback/tickets/:id/status', { preHandler: [authenticate, requireAdminUser] }, async (request, reply) => {
    try {
      const id = Number(request.params.id);
      const { status } = request.body || {};
      if (!Number.isFinite(id) || id < 1) {
        return reply.code(400).send({ error: 'INVALID_ID' });
      }
      const statusStr = typeof status === 'string' ? status.trim().toLowerCase() : '';
      if (!VALID_STATUSES.includes(statusStr)) {
        return reply.code(400).send({
          error: 'INVALID_STATUS',
          message: `Statut invalide. Valeurs autorisées : ${VALID_STATUSES.join(', ')}`
        });
      }

      const result = await query('UPDATE feedback_tickets SET status = ?, updated_at = NOW() WHERE id = ?', [statusStr, id]);
      if (result?.affectedRows === 0) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Ticket non trouvé.' });
      }
      const rows = await query(
        'SELECT id, user_id, title, content, status, created_at, updated_at FROM feedback_tickets WHERE id = ?',
        [id]
      );
      return reply.send(rows[0] || { id, status: statusStr });
    } catch (err) {
      fastify.log?.error?.(err, '[/admin/feedback/tickets/:id/status PATCH] error');
      return reply.code(500).send({
        error: 'UPDATE_FAILED',
        message: err?.message || 'Erreur lors de la mise à jour du statut.'
      });
    }
  });
}
