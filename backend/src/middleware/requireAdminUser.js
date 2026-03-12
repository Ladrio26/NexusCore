import { isAdminRole, resolveEffectiveRole } from '../config/auth.js';

export async function requireAdminUser(request, reply) {
  const user = request.user;
  if (!user) {
    return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Authentication required' });
  }

  const role = resolveEffectiveRole(user);
  if (!isAdminRole(role)) {
    return reply.code(403).send({ error: 'FORBIDDEN', message: 'Admin role required' });
  }

  request.user.role = role;
}
