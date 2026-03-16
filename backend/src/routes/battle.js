import { query } from '../config/db.js';
import { simulateBattle } from '../../../core/combatEngine.js';
import { computeEloChange } from '../services/matchmakingService.js';
import { addXp } from '../services/xpService.js';
import {
  assertNoClientStats,
  validateTeamSlots,
  buildTeamFromDb,
  getSelectedNoyau,
  applyNoyauBonus
} from '../services/battleTeamService.js';
import {
  computeStageRewards,
  applyRewardsTransaction,
  markProgress,
  grantCampaignXp,
  applyCampaignFatigue,
  getSeasonKey
} from '../services/campaignService.js';
import { recordPvpBattle, grantPvpXp, applyPvpFatigue } from '../services/pvpService.js';
import { deletePendingBattle, getPendingBattle, serializePendingBattle, updatePendingBattlePayload } from '../services/pendingBattleService.js';
import { grantCombatArtifactRewards } from '../services/artifactService.js';
import {
  createGuildNotification,
  resolveUserGuildId,
  GUILD_NOTIFICATION_TYPES
} from '../services/guildNotificationService.js';
import { finalizeWarAttack } from '../services/guildWarService.js';

export function registerBattleRoutes(fastify, authenticate) {
  function recomputeInteractivePayload(payload) {
    const session = payload?.interactiveSession;
    if (!session || !Array.isArray(session.teamA) || !Array.isArray(session.teamB)) return payload;
    const seed = Number(session.seed) || 1;
    const bossModifier = session.bossModifier || undefined;
    const decisions = Array.isArray(session.decisions) ? session.decisions : [];
    const log = simulateBattle(session.teamA, session.teamB, {
      seed,
      bossModifier,
      interactive: true,
      decisions
    });
    const winner = log.summary?.winner;
    return {
      ...payload,
      result: winner === 'A' ? 'win' : winner === 'B' ? 'loss' : (winner === 'draw' ? 'draw' : null),
      success: winner === 'A' ? true : (winner === 'B' || winner === 'draw' ? false : null),
      battleLog: log.battleLog ?? [],
      replay: log.replay ? { seed: log.replay.seed, frames: log.replay.frames ?? [] } : undefined,
      summary: {
        totalTurns: log.summary?.totalTurns ?? log.summary?.totalRounds ?? 0,
        playerUnitsAlive: log.summary?.playerUnitsAlive ?? 0,
        enemyUnitsAlive: log.summary?.enemyUnitsAlive ?? 0
      },
      decisionRequest: log.decisionRequest ?? null,
      interactiveSession: {
        ...session,
        seed,
        decisions
      }
    };
  }

  async function finalizePendingBattleForUser(userId, pendingBattleId, clientWinner = null) {
    const pendingRow = await getPendingBattle(userId);
    if (!pendingRow || Number(pendingRow.id) !== Number(pendingBattleId)) {
      return null;
    }

    const pendingBattle = serializePendingBattle(pendingRow);
    if (!pendingBattle) return null;

    // Si le résultat n'est pas encore persisté mais que le frontend a envoyé le gagnant,
    // l'appliquer directement ici (évite tout problème de race condition entre les deux requêtes DB).
    if (pendingBattle.result == null && clientWinner != null) {
      const isWin = clientWinner === 'win';
      const isDraw = clientWinner === 'draw';
      pendingBattle.result = clientWinner;
      pendingBattle.success = isWin;
      pendingBattle.finalizeData = {
        ...(pendingBattle.finalizeData || {}),
        attackerWon: isWin,
        isDraw
      };
      await updatePendingBattlePayload(userId, pendingBattleId, pendingBattle);
    }

    if (pendingBattle.result == null) {
      return { battleType: pendingBattle.battleType, inProgress: true };
    }

    if (pendingBattle.battleType === 'campaign') {
      const mode = String(pendingBattle.mode || 'normal').toLowerCase();
      const chapter = Number(pendingBattle.chapter);
      const stage = Number(pendingBattle.stage);
      const seasonKey = mode === 'hard' ? (pendingBattle.seasonKey || getSeasonKey()) : null;
      const finalizeData = pendingBattle.finalizeData || {};
      const allUserUnitIds = Array.isArray(finalizeData.allUserUnitIds) ? finalizeData.allUserUnitIds.map(Number).filter(Boolean) : [];
      const isBoss = Boolean(finalizeData.isBoss);
      let rewardsGranted = null;

      if (pendingBattle.success) {
        await grantCampaignXp(userId, finalizeData.team || [], allUserUnitIds.map((id) => ({ user_unit_id: id })), isBoss, mode, chapter);
        await applyCampaignFatigue(allUserUnitIds);
        const firstClearRewards = await computeStageRewards(userId, chapter, stage, mode, seasonKey);
        await markProgress(userId, chapter, stage, mode, seasonKey);
        if (firstClearRewards) {
          await applyRewardsTransaction(userId, firstClearRewards);
          rewardsGranted = firstClearRewards;
        }
      }

      const artifactRewards = await grantCombatArtifactRewards(userId, { victory: !!pendingBattle.success, battleType: 'campaign' });

      // Notification guilde pour boss vaincu (silencieuse, non-bloquante)
      if (pendingBattle.success && isBoss) {
        void resolveUserGuildId(userId).then((guildId) => {
          if (!guildId) return;
          return createGuildNotification(guildId, userId, GUILD_NOTIFICATION_TYPES.CAMPAIGN_BOSS_KILL, {
            chapter,
            difficulty: mode === 'hard' ? 'hard' : 'normal'
          });
        }).catch(() => {});
      }

      await deletePendingBattle(userId, pendingBattleId);
      return {
        battleType: 'campaign',
        success: !!pendingBattle.success,
        rewardsGranted,
        progressUpdated: !!pendingBattle.success,
        gold_gained: artifactRewards.goldGained,
        artifact_drop: artifactRewards.artifactDrop,
        wallet: artifactRewards.wallet
      };
    }

    if (pendingBattle.battleType === 'pvp') {
      const finalizeData = pendingBattle.finalizeData || {};
      const {
        attackerEloBefore,
        defenderId,
        defenderType,
        attackerWon,
        isDraw,
        defenderEloBefore,
        attackerUserUnitIds
      } = finalizeData;
      const {
        attackerEloBefore: eloBefore,
        attackerEloAfter,
        attackerRankRewards
      } = await recordPvpBattle(
        userId,
        defenderId ?? null,
        defenderType || 'npc',
        !!attackerWon,
        Number(attackerEloBefore ?? 0),
        !!isDraw,
        defenderEloBefore ?? null
      );
      const ids = Array.isArray(attackerUserUnitIds) ? attackerUserUnitIds.map(Number).filter(Boolean) : [];
      if (!isDraw) {
        await grantPvpXp(ids, !!attackerWon);
        await applyPvpFatigue(ids);
      }
      const creditsBonus = attackerWon && !isDraw ? 1 : 0;
      const artifactRewards = await grantCombatArtifactRewards(userId, { victory: !!attackerWon, creditsBonus, battleType: 'pvp' });
      await deletePendingBattle(userId, pendingBattleId);
      return {
        battleType: 'pvp',
        elo_before: eloBefore,
        elo_after: attackerEloAfter,
        rank_rewards: attackerRankRewards,
        credits_gained: creditsBonus,
        gold_gained: artifactRewards.goldGained,
        artifact_drop: artifactRewards.artifactDrop,
        wallet: artifactRewards.wallet,
        xp_granted: isDraw ? 0 : (attackerWon ? 800 : 400),
        survivors: pendingBattle.result === 'win' ? ids : []
      };
    }

    if (pendingBattle.battleType === 'guild_war') {
      const finalizeData = pendingBattle.finalizeData || {};
      const {
        warId,
        attackerGuildId,
        targetSlotIndex,
        targetGuildId,
        attackerUnitIds,
        attackerWon
      } = finalizeData;

      const unitIds = Array.isArray(attackerUnitIds) ? attackerUnitIds.map(Number).filter(Boolean) : [];

      // Finaliser la guerre (marquer unités, détruire défense si win, log)
      try {
        await finalizeWarAttack(
          Number(warId),
          userId,
          Number(attackerGuildId),
          Number(targetSlotIndex),
          Number(targetGuildId),
          unitIds,
          !!attackerWon
        );
      } catch (err) {
        console.error('[Battle] guild_war finalizeWarAttack error:', err.message);
      }

      await deletePendingBattle(userId, pendingBattleId);
      return {
        battleType: 'guild_war',
        success: !!attackerWon,
        war_id: Number(warId),
        slot_index: Number(targetSlotIndex)
      };
    }

    return null;
  }

  async function requireAuthIfUsers(req, reply) {
    const body = req.body || {};
    if (body.userAId || body.userBId) {
      await authenticate(req, reply);
      if (reply.sent) return;
      const id = req.user.id;
      if (Number(body.userAId) !== id && Number(body.userBId) !== id) {
        return reply.code(403).send({ error: 'FORBIDDEN', message: 'You can only simulate as yourself' });
      }
    }
  }

  fastify.post('/battle/simulate', { preHandler: [requireAuthIfUsers] }, async (request, reply) => {
    const { teamA, teamB, config, userAId, userBId, isGhost } = request.body || {};
    if (!Array.isArray(teamA) || !Array.isArray(teamB)) {
      return reply.code(400).send({ error: 'INVALID_TEAMS' });
    }

    const noStatsA = assertNoClientStats(teamA);
    if (!noStatsA.ok) {
      return reply.code(400).send({ error: noStatsA.error, message: noStatsA.message });
    }
    const noStatsB = assertNoClientStats(teamB);
    if (!noStatsB.ok) {
      return reply.code(400).send({ error: noStatsB.error, message: noStatsB.message });
    }

    const validA = validateTeamSlots(teamA);
    if (!validA.ok) {
      return reply.code(400).send({ error: validA.error, message: validA.message });
    }
    const validB = validateTeamSlots(teamB);
    if (!validB.ok) {
      return reply.code(400).send({ error: validB.error, message: validB.message });
    }

    let builtTeamA = teamA;
    let builtTeamB = teamB;

    if (userAId && userBId) {
      try {
        builtTeamA = await buildTeamFromDb(userAId, teamA);
        builtTeamB = await buildTeamFromDb(userBId, teamB);
      } catch (err) {
        request.log.error(err);
        return reply.code(500).send({ error: 'TEAM_BUILD_FAILED', message: 'Impossible de charger les équipes.' });
      }
      if (builtTeamA.length === 0 || builtTeamB.length === 0) {
        return reply.code(400).send({ error: 'INVALID_TEAMS', message: 'Équipes vides ou unités inconnues.' });
      }
      const selectedNoyauA = Number(request.body?.selectedNoyauA) || 0;
      const selectedNoyauB = Number(request.body?.selectedNoyauB) || 0;
      const noyauA = getSelectedNoyau(builtTeamA, selectedNoyauA);
      const noyauB = getSelectedNoyau(builtTeamB, selectedNoyauB);
      applyNoyauBonus(builtTeamA, noyauA);
      applyNoyauBonus(builtTeamB, noyauB);
    } else {
      return reply.code(400).send({
        error: 'USER_IDS_REQUIRED',
        message: 'userAId et userBId sont requis pour simuler un combat (équipes construites côté serveur).'
      });
    }

    const log = simulateBattle(builtTeamA, builtTeamB, config || {});

    let userA = null;
    let userB = null;
    if (userAId && userBId) {
      const rows = await query(
        'SELECT id, elo FROM users WHERE id IN (?, ?)',
        [userAId, userBId]
      );
      userA = rows.find((r) => r.id === userAId);
      userB = rows.find((r) => r.id === userBId);
    }

    let eloDeltaA = 0;
    let eloDeltaB = 0;
    const winner = log.summary?.winner;
    if (userA && userB && (winner === 'A' || winner === 'B')) {
      const scoreA = winner === 'A' ? 1 : 0;
      const { deltaA, deltaB } = computeEloChange(userA.elo, userB.elo, scoreA, {
        kFactor: 32
      });

      if (isGhost) {
        // Combat contre fantôme : on applique le nerf -10% sur le delta final
        eloDeltaA = Math.round(deltaA * 0.9);
        eloDeltaB = Math.round(deltaB * 0.9);
      } else {
        eloDeltaA = deltaA;
        eloDeltaB = deltaB;
      }

      await query(
        'UPDATE users SET elo = elo + ? WHERE id = ?',
        [eloDeltaA, userAId]
      );
      await query(
        'UPDATE users SET elo = elo + ? WHERE id = ?',
        [eloDeltaB, userBId]
      );

      await query(
        'UPDATE users SET last_opponent_id = ? WHERE id = ?',
        [userBId, userAId]
      );
      await query(
        'UPDATE users SET last_opponent_id = ? WHERE id = ?',
        [userAId, userBId]
      );
    }

    const isGhostBattle = Boolean(isGhost);

    if (userAId && userBId && (winner === 'A' || winner === 'B')) {
      const xpWinner = 50;
      const xpLoser = 20;
      const grantXp = async (team, isWinner) => {
        const amount = isWinner ? xpWinner : xpLoser;
        for (const u of team) {
          const userUnitId = u.id ?? u.user_unit_id;
          if (!userUnitId) continue;
          let xpAmount = amount;
          const fatigue = u.fatigue ?? 0;
          if (fatigue > 50) xpAmount = Math.floor(xpAmount / 2);
          try {
            await addXp(userUnitId, xpAmount);
          } catch (_) {}
        }
      };
      await grantXp(builtTeamA, winner === 'A');
      await grantXp(builtTeamB, winner === 'B');
      const allParticipantIds = [
        ...builtTeamA.map((u) => u.id ?? u.user_unit_id).filter(Boolean),
        ...builtTeamB.map((u) => u.id ?? u.user_unit_id).filter(Boolean)
      ];
      if (allParticipantIds.length) await applyCampaignFatigue(allParticipantIds);
    }

    let battleId = null;
    if (userAId && userBId) {
      const resultEnum = winner === 'A' ? 'a_win' : winner === 'B' ? 'b_win' : 'draw';
      const [res] = await query(
        `INSERT INTO battles
         (user_a_id, user_b_id, is_ghost, result, elo_delta_a, elo_delta_b, team_a_snapshot, team_b_snapshot, battle_log)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userAId,
          userBId,
          isGhostBattle ? 1 : 0,
          resultEnum,
          eloDeltaA,
          eloDeltaB,
          JSON.stringify(builtTeamA),
          JSON.stringify(builtTeamB),
          JSON.stringify(log)
        ]
      );
      battleId = res.insertId;
    }

    return {
      battleId,
      log,
      eloDeltaA,
      eloDeltaB
    };
  });

  fastify.get('/battle/pending', { preHandler: [authenticate] }, async (request) => {
    // Nettoyer les doublons éventuels (anciens combats résiduels) : ne conserver que le plus récent
    await query(
      'DELETE FROM pending_battles WHERE user_id = ? AND id NOT IN (SELECT id FROM (SELECT id FROM pending_battles WHERE user_id = ? ORDER BY id DESC LIMIT 1) AS t)',
      [request.user.id, request.user.id]
    );
    const pendingBattle = await getPendingBattle(request.user.id);
    const serialized = serializePendingBattle(pendingBattle);
    return { pendingBattle: serialized };
  });

  fastify.post('/battle/action', async (_request, reply) => {
    return reply.code(410).send({ error: 'ENDPOINT_REMOVED', message: 'Le moteur de combat tourne désormais en frontend. Utilisez /battle/finalize.' });
  });

  fastify.post('/battle/finalize', { preHandler: [authenticate] }, async (request, reply) => {
    const pendingBattleId = Number(request.body?.id);
    if (!Number.isInteger(pendingBattleId) || pendingBattleId <= 0) {
      return reply.code(400).send({ error: 'INVALID_PENDING_BATTLE_ID' });
    }

    // Le frontend envoie le résultat du combat calculé localement ('win' | 'loss' | 'draw').
    const clientWinner = request.body?.winner ?? null;

    const result = await finalizePendingBattleForUser(request.user.id, pendingBattleId, clientWinner);
    if (!result) {
      return reply.code(404).send({ error: 'PENDING_BATTLE_NOT_FOUND' });
    }
    if (result.inProgress) {
      // Le combat est toujours en cours et aucun gagnant n'a été fourni.
      return reply.code(409).send({ error: 'BATTLE_IN_PROGRESS' });
    }
    return result;
  });

  fastify.get('/battle/:id', async (request, reply) => {
    const id = Number(request.params.id);
    if (!id) {
      return reply.code(400).send({ error: 'INVALID_ID' });
    }
    const rows = await query('SELECT * FROM battles WHERE id = ?', [id]);
    if (!rows.length) {
      return reply.code(404).send({ error: 'NOT_FOUND' });
    }
    const battle = rows[0];
    return {
      id: battle.id,
      userAId: battle.user_a_id,
      userBId: battle.user_b_id,
      isGhost: Boolean(battle.is_ghost),
      result: battle.result,
      eloDeltaA: battle.elo_delta_a,
      eloDeltaB: battle.elo_delta_b,
      teamA: JSON.parse(battle.team_a_snapshot),
      teamB: JSON.parse(battle.team_b_snapshot),
      log: JSON.parse(battle.battle_log),
      createdAt: battle.created_at
    };
  });
}

