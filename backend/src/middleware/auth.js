import jwt from 'jsonwebtoken';
import { getJwtSecret, resolveEffectiveRole } from '../config/auth.js';

export async function authMiddleware(request, reply) {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, getJwtSecret());
    request.user = {
      id: payload.id,
      email: payload.email,
      display_name: payload.display_name ?? payload.email?.split('@')[0],
      role: resolveEffectiveRole(payload)
    };
  } catch (err) {
    return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Invalid or expired token' });
  }
}
