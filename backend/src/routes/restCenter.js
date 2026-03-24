import {
  saveRestCenterSlots,
  getRestCenterSlotsForUser,
  REST_CENTER_MAX_SLOTS,
  REST_CENTER_FATIGUE_RECOVERY_PER_MINUTE,
  DEFAULT_FATIGUE_RECOVERY_PER_MINUTE
} from '../services/restCenterService.js';

export function registerRestCenterRoutes(fastify, authenticate) {
  fastify.get('/rest-center', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user.id;
    try {
      const slots = await getRestCenterSlotsForUser(userId);
      const occupied = slots.filter((x) => x != null).length;
      return {
        slots,
        maxSlots: REST_CENTER_MAX_SLOTS,
        occupied,
        recoveryPerMinute: REST_CENTER_FATIGUE_RECOVERY_PER_MINUTE,
        defaultRecoveryPerMinute: DEFAULT_FATIGUE_RECOVERY_PER_MINUTE
      };
    } catch (err) {
      const msg = (err?.message || '').toString();
      if (msg.includes('rest_center_slots')) {
        return reply.code(503).send({
          error: 'REST_CENTER_SCHEMA',
          message: 'Migration base en cours. Réessaie dans un instant.'
        });
      }
      throw err;
    }
  });

  fastify.put('/rest-center', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user.id;
    const body = request.body || {};
    const rawSlots = body.slots;
    if (!Array.isArray(rawSlots)) {
      return reply.code(400).send({ error: 'INVALID_BODY', message: 'slots doit être un tableau' });
    }
    try {
      const slots = await saveRestCenterSlots(userId, rawSlots);
      const occupied = slots.filter((x) => x != null).length;
      return {
        ok: true,
        slots,
        occupied,
        recoveryPerMinute: REST_CENTER_FATIGUE_RECOVERY_PER_MINUTE,
        defaultRecoveryPerMinute: DEFAULT_FATIGUE_RECOVERY_PER_MINUTE
      };
    } catch (err) {
      const code = err?.code || err?.message;
      if (code === 'REST_CENTER_DUPLICATE_UNIT') {
        return reply.code(400).send({ error: 'DUPLICATE_UNIT', message: 'Une unité ne peut être placée qu’une fois.' });
      }
      if (code === 'REST_CENTER_INVALID_UNIT') {
        return reply.code(400).send({ error: 'INVALID_UNIT', message: 'Unité inconnue ou pas dans ta collection.' });
      }
      const msg = (err?.message || '').toString();
      if (msg.includes('rest_center_slots')) {
        return reply.code(503).send({
          error: 'REST_CENTER_SCHEMA',
          message: 'Migration base en cours.'
        });
      }
      throw err;
    }
  });
}
