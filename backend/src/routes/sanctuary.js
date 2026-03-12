import { pullMultiple } from '../services/gachaService.js';

const PULL_TYPES = ['standard', 'core', 'resonance'];

export function registerSanctuaryRoutes(fastify, authenticate) {
  fastify.post('/sanctuary/pull', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user?.id;
    if (userId == null) {
      return reply.code(401).send({ success: false, error: 'UNAUTHORIZED' });
    }
    const type = (request.body && request.body.type) ? String(request.body.type).toLowerCase() : '';
    const count = Number(request.body?.count) === 10 ? 10 : 1;
    if (!PULL_TYPES.includes(type)) {
      return reply.code(400).send({
        success: false,
        error: 'INVALID_TYPE',
        message: 'type doit être "standard", "core" ou "resonance".'
      });
    }
    const result = await pullMultiple(userId, type, count);

    if (!result.success) {
      const code = result.error === 'INSUFFICIENT_CREDITS' || result.error === 'INSUFFICIENT_CORES' || result.error === 'INSUFFICIENT_FRAGMENTS' ? 400 : 400;
      return reply.code(code).send(result);
    }
    return result;
  });
}
