import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query, withTransaction } from '../config/db.js';
import { getJwtSecret, resolveEffectiveRole } from '../config/auth.js';
import { claimDailyReward } from '../services/dailyRewardService.js';

const SALT_ROUNDS = 10;
const JWT_EXPIRES_IN = '7d';
const MIN_PASSWORD_LENGTH = 8;

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      role: resolveEffectiveRole(user)
    },
    getJwtSecret(),
    { expiresIn: JWT_EXPIRES_IN }
  );
}

export function registerAuthRoutes(fastify) {
  fastify.post('/auth/register', async (request, reply) => {
    try {
      const { pseudo, email, password } = request.body || {};
      const displayName = pseudo != null ? String(pseudo).trim() : '';
      const normalizedEmail = email != null ? String(email).trim().toLowerCase() : '';
      if (!displayName || !normalizedEmail || !password) {
        return reply.code(400).send({ error: 'PSEUDO_EMAIL_AND_PASSWORD_REQUIRED' });
      }
      if (displayName.length > 64) {
        return reply.code(400).send({ error: 'PSEUDO_TOO_LONG' });
      }
      if (String(password).length < MIN_PASSWORD_LENGTH) {
        return reply.code(400).send({
          error: 'PASSWORD_TOO_SHORT',
          message: `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`
        });
      }

      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      const user = await withTransaction(async (tx) => {
        const existingEmail = await tx.query('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
        if (existingEmail.length) {
          const err = new Error('EMAIL_ALREADY_EXISTS');
          err.code = 'EMAIL_ALREADY_EXISTS';
          throw err;
        }

        const existingPseudo = await tx.query('SELECT id FROM users WHERE display_name = ?', [displayName]);
        if (existingPseudo.length) {
          const err = new Error('PSEUDO_ALREADY_EXISTS');
          err.code = 'PSEUDO_ALREADY_EXISTS';
          throw err;
        }

        const insertResult = await tx.query(
          'INSERT INTO users (email, password_hash, display_name, role, elo) VALUES (?, ?, ?, ?, ?)',
          [normalizedEmail, passwordHash, displayName, 'player', 0]
        );
        const insertId = insertResult?.insertId;
        if (insertId == null) {
          request.log?.error?.({ insertResult }, 'Register: no insertId from INSERT users');
          throw new Error('REGISTRATION_FAILED');
        }

        await tx.query(
          'INSERT INTO user_wallet (user_id, credits, cores, fragments, ascension_essence) VALUES (?, 500, 0, 0, 0)',
          [insertId]
        );

        return {
          id: insertId,
          email: normalizedEmail,
          display_name: displayName,
          role: 'player'
        };
      });

      const token = createToken(user);
      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          display_name: user.display_name,
          role: resolveEffectiveRole(user)
        }
      };
    } catch (err) {
      if (err?.code === 'ER_DUP_ENTRY') {
        const duplicateMessage = String(err?.sqlMessage || err?.message || '');
        if (duplicateMessage.includes('uq_users_email')) {
          return reply.code(409).send({ error: 'EMAIL_ALREADY_EXISTS' });
        }
        if (duplicateMessage.includes('uq_users_display_name')) {
          return reply.code(409).send({ error: 'PSEUDO_ALREADY_EXISTS' });
        }
      }
      if (err?.code === 'EMAIL_ALREADY_EXISTS' || err?.message === 'EMAIL_ALREADY_EXISTS') {
        return reply.code(409).send({ error: 'EMAIL_ALREADY_EXISTS' });
      }
      if (err?.code === 'PSEUDO_ALREADY_EXISTS' || err?.message === 'PSEUDO_ALREADY_EXISTS') {
        return reply.code(409).send({ error: 'PSEUDO_ALREADY_EXISTS' });
      }
      request.log?.error?.(err, 'Register error');
      return reply.code(500).send({ error: 'REGISTRATION_FAILED' });
    }
  });

  fastify.post('/auth/login', async (request, reply) => {
    const { pseudo, password } = request.body || {};
    const displayName = pseudo != null ? String(pseudo).trim() : '';
    if (!displayName || !password) {
      return reply.code(400).send({ error: 'PSEUDO_AND_PASSWORD_REQUIRED' });
    }

    const rows = await query(
      'SELECT id, email, display_name, password_hash, role FROM users WHERE display_name = ?',
      [displayName]
    );
    if (!rows.length) {
      return reply.code(401).send({ error: 'INVALID_CREDENTIALS' });
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return reply.code(401).send({ error: 'INVALID_CREDENTIALS' });
    }

    await query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);

    const token = createToken({
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      role: user.role
    });
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        role: resolveEffectiveRole(user)
      }
    };
  });

  fastify.get(
    '/auth/me',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      let rows;
      try {
        rows = await query(
          'SELECT id, email, display_name, avatar_url, role FROM users WHERE id = ?',
          [request.user.id]
        );
      } catch (err) {
        const missingColumn = err.code === 'ER_BAD_FIELD_ERROR' ||
          (err.message && (
            err.message.includes('avatar_url')
            || err.message.includes('role')
            || err.message.includes('Unknown column')
          ));
        if (missingColumn) {
          rows = await query(
            'SELECT id, email, display_name FROM users WHERE id = ?',
            [request.user.id]
          );
          if (rows.length) rows[0].avatar_url = null;
        } else {
          request.log?.error?.(err, 'auth/me error');
          return reply.code(500).send({ error: 'SERVER_ERROR' });
        }
      }
      const user = rows.length ? rows[0] : request.user;
      return {
        user: {
          id: user.id,
          email: user.email,
          display_name: user.display_name,
          avatar_url: user.avatar_url ?? null,
          role: resolveEffectiveRole(user)
        }
      };
    }
  );

  fastify.post(
    '/auth/daily-reward/claim',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      try {
        return await claimDailyReward(request.user.id);
      } catch (err) {
        if (err?.code === 'USER_NOT_FOUND') {
          return reply.code(404).send({ error: 'USER_NOT_FOUND' });
        }
        request.log?.error?.(err, 'daily reward claim error');
        return reply.code(500).send({ error: 'SERVER_ERROR' });
      }
    }
  );
}
