/**
 * Routes PvP : défense, matchmaking, combat.
 * Réutilise simulateBattle (moteur de combat) et buildTeamFromDb.
 */
import {
  buildTeamFromDb,
  getSelectedNoyau,
  applyNoyauBonus,
  validateTeamSlots
} from '../services/battleTeamService.js';
import {
  getPlayerElo,
  setDefense,
  getDefense,
  getPresetSlots,
  findOpponent,
  recordPvpBattle,
  grantPvpXp,
  applyPvpFatigue
} from '../services/pvpService.js';
import { generateNpcDefense } from '../services/pvpNpcService.js';
import { query } from '../config/db.js';
import { createPendingBattle, serializePendingBattle } from '../services/pendingBattleService.js';
import { getSkillDescriptionForTooltip } from '../utils/skillDescription.js';

export function registerPvpRoutes(fastify, authenticate) {
  /** GET /api/pvp/me - Elo et défense actuelle */
  fastify.get('/pvp/me', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user.id;
    const elo = await getPlayerElo(userId);
    const defense = await getDefense(userId);
    return {
      pvp_elo: elo,
      defense: defense ? { preset_id: defense.preset_id } : null
    };
  });

  /** POST /api/pvp/set-defense - Définir le preset de défense */
  fastify.post('/pvp/set-defense', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user.id;
    const { preset_id: presetId } = request.body || {};
    if (presetId == null) {
      return reply.code(400).send({ error: 'PRESET_ID_REQUIRED', message: 'preset_id requis.' });
    }
    try {
      await setDefense(userId, presetId);
      return { success: true };
    } catch (err) {
      if (err.message === 'INVALID_PRESET_ID') {
        return reply.code(400).send({ error: 'INVALID_PRESET_ID', message: 'preset_id invalide (1-10).' });
      }
      throw err;
    }
  });

  /** GET /api/pvp/find-opponent - Matchmaking : joueur ±50 Elo ou PNJ. Query: exclude_defender_id pour ne pas retomber sur le même joueur. */
  fastify.get('/pvp/find-opponent', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user.id;
    const defense = await getDefense(userId);
    if (!defense) {
      return reply.code(400).send({
        error: 'NO_DEFENSE',
        message: 'Configurez une défense (preset) pour accéder au PvP.'
      });
    }
    const excludeDefenderId = request.query?.exclude_defender_id != null ? Number(request.query.exclude_defender_id) : null;
    const opponent = await findOpponent(userId, excludeDefenderId);
    return opponent;
  });

  /** POST /api/pvp/start-battle - Lancer un combat PvP */
  fastify.post('/pvp/start-battle', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user.id;
    const { attacker_preset_id: attackerPresetId, defender_id: defenderId, defender_type: defenderType } = request.body || {};
    if (!attackerPresetId) {
      return reply.code(400).send({ error: 'ATTACKER_PRESET_REQUIRED' });
    }

    const attackerPresetIndex = Number(attackerPresetId);
    if (!Number.isInteger(attackerPresetIndex) || attackerPresetIndex < 1 || attackerPresetIndex > 10) {
      return reply.code(400).send({ error: 'INVALID_PRESET_ID' });
    }

    const attackerSlotsData = await getPresetSlots(userId, attackerPresetIndex);
    if (!attackerSlotsData || !attackerSlotsData.slots.length) {
      return reply.code(400).send({ error: 'ATTACKER_PRESET_EMPTY', message: 'Le preset attaquant est vide.' });
    }

    const valid = validateTeamSlots(attackerSlotsData.slots);
    if (!valid.ok) {
      return reply.code(400).send({ error: valid.error, message: valid.message });
    }

    let teamA;
    try {
      teamA = await buildTeamFromDb(userId, attackerSlotsData.slots);
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: 'TEAM_BUILD_FAILED', message: 'Impossible de charger l\'équipe attaquante.' });
    }
    if (teamA.length === 0) {
      return reply.code(400).send({ error: 'ATTACKER_TEAM_EMPTY' });
    }

    const noyauA = getSelectedNoyau(teamA, attackerSlotsData.selected_noyau_index || 0);
    applyNoyauBonus(teamA, noyauA);

    let teamB;
    let defenderIdResolved = defenderId ? Number(defenderId) : null;
    const isNpc = defenderType === 'npc' || !defenderIdResolved;

    if (isNpc) {
      const elo = await getPlayerElo(userId);
      teamB = await generateNpcDefense(elo);
      if (!teamB || teamB.length === 0) {
        return reply.code(500).send({ error: 'NPC_GENERATION_FAILED' });
      }
    } else {
      const defenseRows = await getDefense(defenderIdResolved);
      if (!defenseRows) {
        return reply.code(400).send({ error: 'DEFENDER_NO_DEFENSE' });
      }
      const defenderSlotsData = await getPresetSlots(defenderIdResolved, defenseRows.preset_id);
      if (!defenderSlotsData || !defenderSlotsData.slots.length) {
        return reply.code(400).send({ error: 'DEFENDER_PRESET_EMPTY' });
      }
      try {
        teamB = await buildTeamFromDb(defenderIdResolved, defenderSlotsData.slots);
      } catch (err) {
        request.log.error(err);
        return reply.code(500).send({ error: 'TEAM_BUILD_FAILED', message: 'Impossible de charger la défense.' });
      }
      if (teamB.length === 0) {
        return reply.code(400).send({ error: 'DEFENDER_TEAM_EMPTY' });
      }
      const noyauB = getSelectedNoyau(teamB, defenderSlotsData.selected_noyau_index || 0);
      applyNoyauBonus(teamB, noyauB);
    }

    const seed = Date.now() % 2147483647;

    const attackerElo = await getPlayerElo(userId);
    let defenderEloBefore = null;
    let defenderDisplayName = null;
    if (!isNpc && defenderIdResolved) {
      const defRows = await query('SELECT pvp_elo, display_name FROM users WHERE id = ?', [defenderIdResolved]);
      defenderEloBefore = defRows[0]?.pvp_elo ?? 0;
      defenderDisplayName = defRows[0]?.display_name ?? null;
    }
    const attackerUserUnitIds = attackerSlotsData.slots.map((s) => Number(s.user_unit_id)).filter(Boolean);

    const initialUnits = [
      ...teamA.map((u, i) => ({
        id: `A-${i}`,
        name: u.name ?? `Unité ${i + 1}`,
        image_url: u.image_url ?? null,
        maxHp: u.maxHp ?? 100,
        element: (u.element || 'neutral').toUpperCase(),
        side: 'A',
        position: u.position === 'back' ? 'back' : 'front',
        level: u.level,
        attack: u.attack,
        defense: u.defense,
        speed: u.speed,
        traits: Array.isArray(u.traits) ? u.traits : [],
        skillDescription: getSkillDescriptionForTooltip(u)
      })),
      ...teamB.map((u, i) => ({
        id: `B-${i}`,
        name: u.name ?? `Ennemi ${i + 1}`,
        image_url: u.image_url ?? null,
        maxHp: u.maxHp ?? 100,
        element: (u.element || 'neutral').toUpperCase(),
        side: 'B',
        position: u.position === 'back' ? 'back' : 'front',
        level: u.level,
        attack: u.attack,
        defense: u.defense,
        speed: u.speed,
        traits: Array.isArray(u.traits) ? u.traits : [],
        skillDescription: getSkillDescriptionForTooltip(u)
      }))
    ];

    const pendingBattle = await createPendingBattle(userId, 'pvp', {
      title: 'Combat PvP',
      result: null,
      success: null,
      initialUnits,
      interactiveSession: {
        seed,
        bossModifier: null,
        teamA,
        teamB
      },
      enemyTeamLabel: isNpc ? 'PNJ' : `Équipe de ${defenderDisplayName || 'l\'adversaire'}`,
      finalizeData: {
        attackerEloBefore: attackerElo,
        defenderId: isNpc ? null : defenderIdResolved,
        defenderType: isNpc ? 'npc' : 'player',
        attackerWon: null,
        isDraw: null,
        defenderEloBefore,
        attackerUserUnitIds
      }
    });

    return {
      pendingBattle: serializePendingBattle(pendingBattle)
    };
  });

  /** GET /api/pvp/notifications - Liste des notifications (optionnel, pour la page PvP) */
  fastify.get('/pvp/notifications', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user.id;
    const rows = await query(
      'SELECT id, type, message, created_at, is_read FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [userId]
    );
    return { notifications: rows || [] };
  });
}
