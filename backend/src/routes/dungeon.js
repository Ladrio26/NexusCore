import { getDungeonStatus, startDungeonCombat, continueDungeonCombat } from '../services/dungeonService.js';

export function registerDungeonRoutes(fastify, authenticate) {
  fastify.get('/dungeon/status', { preHandler: [authenticate] }, async (request) => {
    return getDungeonStatus(request.user.id);
  });

  fastify.post('/dungeon/start', { preHandler: [authenticate] }, async (request, reply) => {
    const result = await startDungeonCombat(request.user.id, request.body || {});
    if (!result.success) {
      return reply.code(400).send(result);
    }
    return result;
  });

  fastify.post('/dungeon/continue', { preHandler: [authenticate] }, async (request, reply) => {
    const result = await continueDungeonCombat(request.user.id);
    if (!result.success) {
      return reply.code(400).send(result);
    }
    return result;
  });
}
