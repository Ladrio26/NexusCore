/**
 * Routes Guerres de Guilde
 *
 * Préfixe : /guild-war
 * Toutes les routes nécessitent une authentification.
 */
import {
  buildTeamFromDb,
  getSelectedNoyau,
  applyNoyauBonus
} from '../services/battleTeamService.js';
import { getSkillDescriptionForTooltip } from '../utils/skillDescription.js';
import { createPendingBattle, serializePendingBattle } from '../services/pendingBattleService.js';
import {
  getFullWarStatus,
  getWarDefenses,
  getWarLogs,
  getWarNotifications,
  getOrCreateGuildElo,
  getMyDefensePresets,
  getGuildDefensePresets,
  saveDefensePreset,
  updateDefensePreset,
  deleteDefensePreset,
  placeDefense,
  placeDefenseFromPreset,
  prepareWarAttack,
  finalizeWarAttack,
  getNextWarSchedule,
  getGuildWarHistory,
  runDailyMatchmaking
} from '../services/guildWarService.js';
import { query } from '../config/db.js';

function sendWarError(reply, err) {
  const code = String(err?.code ?? '');
  const warClientCodes = new Set([
    'WAR_NOT_FOUND', 'WRONG_PHASE', 'NOT_IN_GUILD', 'NOT_IN_WAR',
    'INSUFFICIENT_PERMISSIONS', 'INVALID_SLOT', 'INVALID_UNITS',
    'INVALID_POSITION', 'UNITS_IN_OTHER_DEFENSE', 'DEFENSE_EMPTY', 'ALREADY_DESTROYED', 'UNITS_ALREADY_USED',
    'UNIT_NOT_OWNED', 'INVALID_DEFENDER', 'PRESET_NOT_FOUND', 'PRESET_ALREADY_USED',
    'MAX_PRESETS', 'PENDING_BATTLE'
  ]);
  if (warClientCodes.has(code)) {
    return reply.code(400).send({ success: false, error: code, message: err.message });
  }
  if (code === 'NOT_IN_GUILD') return reply.code(403).send({ success: false, error: code, message: err.message });
  return reply.code(500).send({ success: false, error: 'INTERNAL_ERROR', message: err.message });
}

export function registerGuildWarRoutes(fastify, authenticate) {
  const preAuth = { preHandler: [authenticate] };

  // ── État général ────────────────────────────────────────────────────────────

  /** GET /guild-war/status - État complet de la guerre pour l'utilisateur */
  fastify.get('/guild-war/status', preAuth, async (request, reply) => {
    try {
      const status = await getFullWarStatus(request.user.id);
      const schedule = await getNextWarSchedule();
      return { success: true, war: status, schedule };
    } catch (err) {
      return sendWarError(reply, err);
    }
  });

  /** GET /guild-war/schedule - Planning de guerre (phase actuelle, prochain cycle) */
  fastify.get('/guild-war/schedule', preAuth, async (request, reply) => {
    try {
      const schedule = await getNextWarSchedule();
      return { success: true, ...schedule };
    } catch (err) {
      return sendWarError(reply, err);
    }
  });

  // ── Elo de guilde ───────────────────────────────────────────────────────────

  /** GET /guild-war/history - Historique des guerres terminées de la guilde */
  fastify.get('/guild-war/history', preAuth, async (request, reply) => {
    try {
      const history = await getGuildWarHistory(request.user.id);
      return { success: true, history };
    } catch (err) {
      return sendWarError(reply, err);
    }
  });

  /** GET /guild-war/elo - Elo de la guilde de l'utilisateur */
  fastify.get('/guild-war/elo', preAuth, async (request, reply) => {
    try {
      const membership = await query(
        'SELECT guild_id FROM guild_members WHERE user_id = ? LIMIT 1',
        [Number(request.user.id)]
      );
      if (!membership.length) {
        return reply.code(403).send({ success: false, error: 'NOT_IN_GUILD' });
      }
      const elo = await getOrCreateGuildElo(Number(membership[0].guild_id));
      return { success: true, elo };
    } catch (err) {
      return sendWarError(reply, err);
    }
  });

  // ── Défenses ────────────────────────────────────────────────────────────────

  /** GET /guild-war/defenses/:warId - Défenses d'une guerre */
  fastify.get('/guild-war/defenses/:warId', preAuth, async (request, reply) => {
    try {
      const warId = Number(request.params.warId);
      if (!warId) return reply.code(400).send({ error: 'INVALID_WAR_ID' });
      // Vérifier que l'utilisateur est bien dans cette guerre
      const membership = await query(
        'SELECT guild_id FROM guild_members WHERE user_id = ? LIMIT 1',
        [Number(request.user.id)]
      );
      if (!membership.length) return reply.code(403).send({ error: 'NOT_IN_GUILD' });
      const warRows = await query(
        'SELECT id FROM guild_wars WHERE id = ? AND (guild_a_id = ? OR guild_b_id = ?) LIMIT 1',
        [warId, Number(membership[0].guild_id), Number(membership[0].guild_id)]
      );
      if (!warRows.length) return reply.code(403).send({ error: 'NOT_IN_WAR' });
      const defenses = await getWarDefenses(warId);
      return { success: true, defenses };
    } catch (err) {
      return sendWarError(reply, err);
    }
  });

  /** POST /guild-war/defenses/place - Placer une défense (par preset_id) */
  fastify.post('/guild-war/defenses/place', preAuth, async (request, reply) => {
    try {
      const { war_id: warId, slot_index: slotIndex, preset_id: presetId } = request.body || {};
      if (!warId || !slotIndex) {
        return reply.code(400).send({ error: 'MISSING_PARAMS', message: 'war_id et slot_index requis.' });
      }
      await placeDefenseFromPreset(
        request.user.id,
        Number(warId),
        Number(slotIndex),
        presetId ? Number(presetId) : null
      );
      const defenses = await getWarDefenses(Number(warId));
      return { success: true, defenses };
    } catch (err) {
      return sendWarError(reply, err);
    }
  });

  /** GET /guild-war/guild-defense-presets - Tous les presets de la guilde (leader/officer) */
  fastify.get('/guild-war/guild-defense-presets', preAuth, async (request, reply) => {
    try {
      const membership = await query(
        'SELECT guild_id FROM guild_members WHERE user_id = ? LIMIT 1',
        [Number(request.user.id)]
      );
      if (!membership.length) return reply.code(403).send({ error: 'NOT_IN_GUILD' });
      const presets = await getGuildDefensePresets(Number(membership[0].guild_id));
      return { success: true, presets };
    } catch (err) {
      return sendWarError(reply, err);
    }
  });

  // ── Presets de défense ──────────────────────────────────────────────────────

  /** GET /guild-war/defense-presets - Mes presets de défense */
  fastify.get('/guild-war/defense-presets', preAuth, async (request, reply) => {
    try {
      const presets = await getMyDefensePresets(request.user.id);
      return { success: true, presets };
    } catch (err) {
      return sendWarError(reply, err);
    }
  });

  /** POST /guild-war/defense-presets - Créer un preset */
  fastify.post('/guild-war/defense-presets', preAuth, async (request, reply) => {
    try {
      const { name, units } = request.body || {};
      const preset = await saveDefensePreset(request.user.id, name || 'Défense', Array.isArray(units) ? units : []);
      return { success: true, preset };
    } catch (err) {
      return sendWarError(reply, err);
    }
  });

  /** PUT /guild-war/defense-presets/:id - Modifier un preset */
  fastify.put('/guild-war/defense-presets/:id', preAuth, async (request, reply) => {
    try {
      const { name, units } = request.body || {};
      await updateDefensePreset(request.user.id, Number(request.params.id), name, units);
      const presets = await getMyDefensePresets(request.user.id);
      return { success: true, presets };
    } catch (err) {
      return sendWarError(reply, err);
    }
  });

  /** DELETE /guild-war/defense-presets/:id - Supprimer un preset */
  fastify.delete('/guild-war/defense-presets/:id', preAuth, async (request, reply) => {
    try {
      await deleteDefensePreset(request.user.id, Number(request.params.id));
      return { success: true };
    } catch (err) {
      return sendWarError(reply, err);
    }
  });

  // ── Attaque ─────────────────────────────────────────────────────────────────

  /**
   * POST /guild-war/attack/start
   * Lance un combat de guerre de guilde.
   * Body: { war_id, target_slot_index, attacker_units: [{user_unit_id, position}] }
   */
  fastify.post('/guild-war/attack/start', preAuth, async (request, reply) => {
    try {
      const { war_id: warId, target_slot_index: targetSlot, attacker_units: attackerUnits } = request.body || {};
      if (!warId || !targetSlot) {
        return reply.code(400).send({ error: 'MISSING_PARAMS' });
      }

      const prepData = await prepareWarAttack(
        request.user.id,
        Number(warId),
        Number(targetSlot),
        Array.isArray(attackerUnits) ? attackerUnits : []
      );

      // Construire les équipes
      let teamA;
      try {
        teamA = await buildTeamFromDb(request.user.id, prepData.attackerSlots);
      } catch (err) {
        return reply.code(500).send({ error: 'TEAM_BUILD_FAILED', message: 'Impossible de charger votre équipe.' });
      }
      if (!teamA || teamA.length === 0) {
        return reply.code(400).send({ error: 'ATTACKER_TEAM_EMPTY' });
      }

      const noyauA = getSelectedNoyau(teamA, 0);
      applyNoyauBonus(teamA, noyauA);

      let teamB;
      if (!prepData.defenderUserId || !prepData.defenderSlots.length) {
        return reply.code(400).send({ error: 'DEFENSE_EMPTY', message: "Ce slot de défense est vide." });
      }
      try {
        teamB = await buildTeamFromDb(prepData.defenderUserId, prepData.defenderSlots);
      } catch (err) {
        return reply.code(500).send({ error: 'TEAM_BUILD_FAILED', message: 'Impossible de charger la défense.' });
      }
      if (!teamB || teamB.length === 0) {
        return reply.code(400).send({ error: 'DEFENDER_TEAM_EMPTY' });
      }

      const noyauB = getSelectedNoyau(teamB, 0);
      applyNoyauBonus(teamB, noyauB);

      const seed = Date.now() % 2147483647;

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

      const attackerUnitIds = prepData.attackerSlots.map((s) => Number(s.user_unit_id)).filter(Boolean);

      const pendingBattle = await createPendingBattle(request.user.id, 'guild_war', {
        title: `Guerre de Guilde — Défense #${targetSlot}`,
        result: null,
        success: null,
        initialUnits,
        interactiveSession: {
          seed,
          bossModifier: null,
          teamA,
          teamB
        },
        enemyTeamLabel: 'Défense adverse',
        finalizeData: {
          warId: Number(warId),
          attackerGuildId: prepData.attackerGuildId,
          targetSlotIndex: Number(targetSlot),
          targetGuildId: prepData.targetGuildId,
          attackerUnitIds,
          attackerWon: null
        }
      });

      return {
        success: true,
        pendingBattle: serializePendingBattle(pendingBattle)
      };
    } catch (err) {
      return sendWarError(reply, err);
    }
  });

  // ── Logs & Notifications ────────────────────────────────────────────────────

  /** GET /guild-war/logs/:warId */
  fastify.get('/guild-war/logs/:warId', preAuth, async (request, reply) => {
    try {
      const logs = await getWarLogs(Number(request.params.warId));
      return { success: true, logs };
    } catch (err) {
      return sendWarError(reply, err);
    }
  });

  /** GET /guild-war/notifications/:warId */
  fastify.get('/guild-war/notifications/:warId', preAuth, async (request, reply) => {
    try {
      const membership = await query(
        'SELECT guild_id FROM guild_members WHERE user_id = ? LIMIT 1',
        [Number(request.user.id)]
      );
      if (!membership.length) return reply.code(403).send({ error: 'NOT_IN_GUILD' });
      const notifications = await getWarNotifications(
        Number(request.params.warId),
        Number(membership[0].guild_id)
      );
      return { success: true, notifications };
    } catch (err) {
      return sendWarError(reply, err);
    }
  });

  // ── Unités disponibles ──────────────────────────────────────────────────────

  /**
   * GET /guild-war/available-units/:warId
   * Retourne les unités de l'utilisateur non encore utilisées dans cette guerre.
   */
  fastify.get('/guild-war/available-units/:warId', preAuth, async (request, reply) => {
    try {
      const warId = Number(request.params.warId);
      const userId = Number(request.user.id);

      const usedRows = await query(
        'SELECT user_unit_id FROM guild_war_used_units WHERE war_id = ? AND user_id = ?',
        [warId, userId]
      );
      const usedIds = new Set(usedRows.map((r) => Number(r.user_unit_id)));

      const unitRows = await query(
        `SELECT uu.id AS user_unit_id, u.name, u.code, u.rarity, u.element, u.role, u.archetype,
                u.image_url, uu.level, uu.power_level
         FROM user_units uu
         JOIN units u ON u.id = uu.unit_id
         WHERE uu.user_id = ?
         ORDER BY u.rarity DESC, uu.level DESC`,
        [userId]
      );

      return {
        success: true,
        units: unitRows.map((r) => ({
          user_unit_id: Number(r.user_unit_id),
          name: r.name,
          code: r.code,
          rarity: r.rarity,
          element: r.element,
          role: r.role,
          archetype: r.archetype,
          image_url: r.image_url ?? null,
          level: Number(r.level),
          power_level: Number(r.power_level ?? 1),
          used: usedIds.has(Number(r.user_unit_id))
        }))
      };
    } catch (err) {
      return sendWarError(reply, err);
    }
  });

  // ── Admin / Debug ───────────────────────────────────────────────────────────

  /** POST /guild-war/admin/matchmaking - Déclencher le matchmaking manuellement */
  fastify.post('/guild-war/admin/matchmaking', preAuth, async (request, reply) => {
    // Restriction admin
    const adminRows = await query('SELECT role FROM users WHERE id = ? LIMIT 1', [request.user.id]).catch(() => []);
    if (!adminRows.length || adminRows[0].role !== 'admin') {
      return reply.code(403).send({ error: 'FORBIDDEN' });
    }
    try {
      const result = await runDailyMatchmaking();
      return { success: true, ...result };
    } catch (err) {
      return sendWarError(reply, err);
    }
  });
}
