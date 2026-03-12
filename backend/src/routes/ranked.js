import { enqueueRanked, cancelQueue, getQueueStatus, createGhostIfNecessary } from '../services/matchmakingService.js';

export function registerRankedRoutes(fastify, authenticate) {
  fastify.post('/ranked/queue', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user.id;
    try {
      const match = await enqueueRanked(userId);
      let ghost = null;
      if (!match.matched) {
        ghost = await createGhostIfNecessary(userId);
      }
      return { queued: true, match, ghost };
    } catch (err) {
      request.log.error(err);
      if (err.message === 'USER_NOT_FOUND') {
        return reply.code(404).send({ error: 'USER_NOT_FOUND' });
      }
      return reply.code(500).send({ error: 'INTERNAL_ERROR' });
    }
  });

  fastify.post('/ranked/cancel', { preHandler: [authenticate] }, async (request, reply) => {
    await cancelQueue(request.user.id);
    return { cancelled: true };
  });

  fastify.get('/ranked/status', { preHandler: [authenticate] }, async (request) => {
    const status = await getQueueStatus(request.user.id);
    return status;
  });
}

