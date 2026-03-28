import { query } from '../config/db.js';
import {
  startCombatTutorialForUser,
  markCombatTutorialCompleted,
  getCombatTutorialCompleted,
  getCombatTutorialScript
} from '../services/tutorialCombatService.js';

export function registerTutorialRoutes(fastify, authenticate) {
  fastify.post(
    '/tutorial/start-battle',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const force = request.body?.force === true;
      const userId = request.user.id;
      try {
        const done = await getCombatTutorialCompleted(userId);
        if (done && !force) {
          return reply.code(409).send({ error: 'COMBAT_TUTORIAL_ALREADY_DONE' });
        }
        const pendingBattle = await startCombatTutorialForUser(userId);
        return { pendingBattle, tutorialScript: getCombatTutorialScript() };
      } catch (err) {
        if (err?.code === 'TUTORIAL_UNITS_MISSING') {
          return reply.code(503).send({
            error: 'TUTORIAL_UNITS_MISSING',
            message: 'Catalogue unités insuffisant pour le tutoriel.'
          });
        }
        request.log?.error?.(err, 'tutorial/start-battle');
        return reply.code(500).send({ error: 'SERVER_ERROR' });
      }
    }
  );

  /** Marque le tutoriel combat comme terminé et supprime le pending (passer sans jouer). */
  fastify.post(
    '/tutorial/skip-combat',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userId = request.user.id;
      await markCombatTutorialCompleted(userId);
      await query('DELETE FROM pending_battles WHERE user_id = ?', [userId]);
      return { success: true, combat_tutorial_completed: true };
    }
  );
}
