import {
  destroyArtifactById,
  enhanceArtifactById,
  equipArtifactById,
  getArtifactInventory,
  unequipArtifact
} from '../services/artifactService.js';

export function registerArtifactRoutes(fastify, authenticate) {
  fastify.get('/artifacts', { preHandler: [authenticate] }, async (request) => {
    return getArtifactInventory(request.user.id);
  });

  fastify.post('/artifacts/equip', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      return await equipArtifactById(request.user.id, {
        artifactId: request.body?.artifact_id,
        userUnitId: request.body?.user_unit_id
      });
    } catch (err) {
      const message = err?.message || 'ARTIFACT_EQUIP_FAILED';
      const status = ['INVALID_ARTIFACT_ID', 'INVALID_USER_UNIT_ID', 'ARTIFACT_SLOTS_FULL', 'DUPLICATE_ARTIFACT_STAT', 'ARTIFACT_NOT_FOUND', 'USER_UNIT_NOT_FOUND', 'ARTIFACT_ALREADY_EQUIPPED'].includes(message)
        ? 400
        : 500;
      return reply.code(status).send({ error: message });
    }
  });

  fastify.post('/artifacts/unequip', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      return await unequipArtifact(request.user.id, request.body?.artifact_id);
    } catch (err) {
      const message = err?.message || 'ARTIFACT_UNEQUIP_FAILED';
      const status = ['INVALID_ARTIFACT_ID', 'ARTIFACT_NOT_EQUIPPED', 'INSUFFICIENT_GOLD'].includes(message) ? 400 : 500;
      return reply.code(status).send({ error: message });
    }
  });

  fastify.post('/artifacts/enhance', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      return await enhanceArtifactById(request.user.id, request.body?.artifact_id);
    } catch (err) {
      const message = err?.message || 'ARTIFACT_ENHANCE_FAILED';
      const status = ['INVALID_ARTIFACT_ID', 'ARTIFACT_NOT_FOUND', 'INSUFFICIENT_GOLD'].includes(message) ? 400 : 500;
      return reply.code(status).send({ error: message });
    }
  });

  fastify.post('/artifacts/destroy', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      return await destroyArtifactById(request.user.id, request.body?.artifact_id);
    } catch (err) {
      const message = err?.message || 'ARTIFACT_DESTROY_FAILED';
      const status = ['INVALID_ARTIFACT_ID', 'ARTIFACT_NOT_FOUND'].includes(message) ? 400 : 500;
      return reply.code(status).send({ error: message });
    }
  });
}
