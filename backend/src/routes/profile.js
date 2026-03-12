import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { query } from '../config/db.js';

const SALT_ROUNDS = 10;
const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_MIMES = new Set(['image/png', 'image/jpeg', 'image/jpg']);
const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'avatars');

function isUploadedAvatar(url) {
  return typeof url === 'string' && url.startsWith('/uploads/avatars/') && url.length > 16;
}

function getOldAvatarPath(oldUrl) {
  if (!isUploadedAvatar(oldUrl)) return null;
  const basename = path.basename(oldUrl);
  if (!basename || basename.includes('..')) return null;
  return path.join(UPLOADS_DIR, basename);
}

export function registerProfileRoutes(fastify, authenticate) {
  // PUT /profile — mise à jour nom et/ou mot de passe
  fastify.put(
    '/profile',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userId = request.user.id;
      const { display_name: displayName, password } = request.body || {};

      if (displayName !== undefined) {
        const name = typeof displayName === 'string' ? displayName.trim() : '';
        if (name.length > 64) {
          return reply.code(400).send({ error: 'DISPLAY_NAME_TOO_LONG' });
        }
        if (name.length > 0) {
          const existing = await query('SELECT id FROM users WHERE display_name = ? AND id != ?', [name, userId]);
          if (existing.length) {
            return reply.code(409).send({ error: 'PSEUDO_ALREADY_EXISTS' });
          }
          await query('UPDATE users SET display_name = ? WHERE id = ?', [name, userId]);
        }
      }

      if (password !== undefined && password !== '') {
        if (typeof password !== 'string' || password.length < 8) {
          return reply.code(400).send({ error: 'PASSWORD_MIN_8' });
        }
        const hash = await bcrypt.hash(password, SALT_ROUNDS);
        await query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, userId]);
      }

      const [row] = await query('SELECT id, email, display_name, avatar_url FROM users WHERE id = ?', [userId]);
      const user = row || request.user;
      return {
        user: {
          id: user.id,
          email: user.email,
          display_name: user.display_name,
          avatar_url: user.avatar_url ?? null
        }
      };
    }
  );

  // POST /profile/avatar — upload avatar (multipart) : resize 512x512, crop cover, webp 80
  fastify.post(
    '/profile/avatar',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userId = request.user.id;
      const data = await request.file();
      if (!data) {
        return reply.code(400).send({ error: 'NO_FILE', message: 'Aucun fichier envoyé.' });
      }

      const mime = (data.mimetype || '').toLowerCase();
      if (!ALLOWED_MIMES.has(mime)) {
        return reply.code(400).send({ error: 'INVALID_TYPE', message: 'Format accepté : PNG ou JPEG uniquement.' });
      }

      let size = 0;
      const chunks = [];
      for await (const chunk of data.file) {
        size += chunk.length;
        if (size > MAX_AVATAR_SIZE) {
          return reply.code(400).send({ error: 'FILE_TOO_LARGE', message: 'Taille max. 2 Mo.' });
        }
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      await fs.promises.mkdir(UPLOADS_DIR, { recursive: true });
      const filename = `${userId}.webp`;
      const filepath = path.join(UPLOADS_DIR, filename);

      await sharp(buffer)
        .resize(512, 512, { fit: 'cover', position: 'center' })
        .webp({ quality: 80 })
        .toFile(filepath);

      const avatarUrl = `/uploads/avatars/${filename}`;

      const [oldRow] = await query('SELECT avatar_url FROM users WHERE id = ?', [userId]);
      const oldPath = getOldAvatarPath(oldRow?.avatar_url);
      if (oldPath && path.resolve(oldPath) !== path.resolve(filepath)) {
        try {
          await fs.promises.unlink(oldPath);
        } catch (_) {}
      }

      await query('UPDATE users SET avatar_url = ? WHERE id = ?', [avatarUrl, userId]);
      return { avatar_url: avatarUrl };
    }
  );

  // DELETE /profile/avatar — supprimer avatar (remet NULL, supprime le fichier uploadé)
  fastify.delete(
    '/profile/avatar',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userId = request.user.id;
      const [row] = await query('SELECT avatar_url FROM users WHERE id = ?', [userId]);
      const oldPath = getOldAvatarPath(row?.avatar_url);
      if (oldPath) {
        try {
          await fs.promises.unlink(oldPath);
        } catch (_) {}
      }
      await query('UPDATE users SET avatar_url = NULL WHERE id = ?', [userId]);
      return { avatar_url: null };
    }
  );
}
