import { pullUnit, getWallet, getFragments, getPity } from '../services/gachaService.js';

export function registerGachaRoutes(fastify, authenticate) {
  fastify.post(
    '/gacha/pull',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userId = request.user.id;
      const { bannerKey } = request.body || {};
      const key = typeof bannerKey === 'string' && bannerKey.trim() ? bannerKey.trim() : 'standard';
      const result = await pullUnit(userId, key);
      if (!result.success) {
        return reply.code(400).send(result);
      }
      return result;
    }
  );

  fastify.get('/wallet', { preHandler: [authenticate] }, async (request) => {
    const wallet = await getWallet(request.user.id);
    return wallet;
  });

  fastify.get('/fragments', { preHandler: [authenticate] }, async (request) => {
    const data = await getFragments(request.user.id);
    return data;
  });

  fastify.get('/gacha/pity', { preHandler: [authenticate] }, async (request) => {
    const bannerKey = (request.query && request.query.bannerKey) || 'standard';
    const pity = await getPity(request.user.id, bannerKey);
    return pity;
  });
}
