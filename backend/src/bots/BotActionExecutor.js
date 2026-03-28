/**
 * BotActionExecutor.js
 * Exécute les actions décidées par BotDecisionEngine en appelant directement les services.
 * Aucune couche HTTP : tout passe par des imports directs (même process Node.js).
 */

import { query as dbQuery } from '../config/db.js';
import { pullMultiple, getWallet } from '../services/gachaService.js';
import {
  equipArtifactById,
  enhanceArtifactById,
  grantCombatArtifactRewards,
} from '../services/artifactService.js';
import {
  getCampaignStatus,
  buildEnemyTeamFromStage,
  computeStageRewards,
  applyRewardsTransaction,
  markProgress,
  grantCampaignXp,
  getSeasonKey,
} from '../services/campaignService.js';
import {
  buildTeamFromDb,
  getSelectedNoyau,
  applyNoyauBonus,
} from '../services/battleTeamService.js';
import { applyCombatStats } from '../services/combatStatsService.js';
import {
  startDungeonCombat,
  continueDungeonCombat,
  finalizeDungeonBattle,
  getDungeonStatus,
} from '../services/dungeonService.js';
import {
  getPendingBattle,
  serializePendingBattle,
  updatePendingBattlePayload,
} from '../services/pendingBattleService.js';
import { simulateBattle } from '../../../core/combatEngine.js';

import { getBestTeamPreset, getUnspecializedMaxLevelUnits } from './BotTeamPlanner.js';
import { getEquipPlan, getUpgradePlan } from './BotArtifactPlanner.js';
import { getDungeonPlan, updateDungeonState } from './BotDungeonPlanner.js';
import { executeWarAttack } from './BotGuildWarPlanner.js';
import { executePvpBattle } from './BotPvpPlanner.js';
import { botLog, jitter } from './BotUtils.js';
import { setCooldown } from './BotStateRepository.js';

/**
 * Point d'entrée principal : exécute l'action choisie par le moteur de décision.
 * Met à jour les cooldowns dans botState (en place).
 * Retourne { ok: boolean, detail: object }.
 */
export async function executeAction(userId, action, profile, botState) {
  switch (action) {
    case 'summon':     return executeSummon(userId, profile, botState);
    case 'specialize': return executeSpecialize(userId, profile, botState);
    case 'equip':      return executeEquip(userId, profile, botState);
    case 'upgrade':    return executeUpgrade(userId, profile, botState);
    case 'guildWar':   return executeGuildWar(userId, profile, botState);
    case 'campaign':   return executeCampaign(userId, profile, botState);
    case 'dungeon':    return executeDungeon(userId, profile, botState);
    case 'pvp':        return executePvp(userId, profile, botState);
    case 'idle':
    default:           return executeIdle(userId, profile, botState);
  }
}

// ── Invocation sanctuaire ────────────────────────────────────────────────────

async function executeSummon(userId, profile, botState) {
  let wallet;
  try {
    wallet = await getWallet(userId);
  } catch (err) {
    setCooldown(botState, 'summon', jitter(profile.cooldowns.summon));
    return { ok: false, detail: { error: err.message } };
  }

  // Coûts par tirage unitaire pour chacun des 6 portails (source : gachaService constants)
  const PORTALS = [
    { type: 'standard',        walletKey: 'credits',         costPerPull: 100 },
    { type: 'core',            walletKey: 'cores',           costPerPull: 10  },
    { type: 'resonance',       walletKey: 'fragments',       costPerPull: 100 },
    { type: 'divine_standard', walletKey: 'divine_credits',  costPerPull: 100 },
    { type: 'divine_core',     walletKey: 'divine_cores',    costPerPull: 10  },
    { type: 'divine_resonance',walletKey: 'divine_fragments',costPerPull: 100 },
  ];

  const summary = {}; // { type: { total, units, errors } }
  let anySuccess = false;

  for (const { type, walletKey, costPerPull } of PORTALS) {
    const balance = wallet[walletKey] ?? 0;
    const totalPulls = Math.floor(balance / costPerPull);
    if (totalPulls === 0) continue;

    const batchesOf10 = Math.floor(totalPulls / 10);
    const singles     = totalPulls % 10;
    let typeUnits = 0;
    let typeTotal = 0;
    const typeErrors = [];

    // Lots de 10
    for (let b = 0; b < batchesOf10; b++) {
      try {
        const res = await pullMultiple(userId, type, 10);
        if (res.success === false) {
          typeErrors.push(res.error ?? 'pull_failed');
          break; // plus la peine de continuer sur ce portail
        }
        typeTotal += 10;
        typeUnits += (res.pulls?.length ?? 10);
        anySuccess = true;
      } catch (err) {
        typeErrors.push(err.message);
        break;
      }
    }

    // Tirages unitaires restants
    for (let s = 0; s < singles; s++) {
      try {
        const res = await pullMultiple(userId, type, 1);
        if (res.success === false) {
          typeErrors.push(res.error ?? 'pull_failed');
          break;
        }
        typeTotal += 1;
        typeUnits += 1;
        anySuccess = true;
      } catch (err) {
        typeErrors.push(err.message);
        break;
      }
    }

    if (typeTotal > 0 || typeErrors.length > 0) {
      summary[type] = { total: typeTotal, units: typeUnits, ...(typeErrors.length ? { errors: typeErrors } : {}) };
    }
  }

  setCooldown(botState, 'summon', jitter(profile.cooldowns.summon));

  if (!anySuccess && Object.keys(summary).length === 0) {
    return { ok: false, detail: { reason: 'insufficient_wallet' } };
  }

  const totalPulled = Object.values(summary).reduce((a, v) => a + v.total, 0);
  const totalUnits  = Object.values(summary).reduce((a, v) => a + v.units, 0);
  return { ok: anySuccess, detail: { summary, totalPulled, totalUnits } };
}

// ── Spécialisation des unités niveau 50 ──────────────────────────────────────

async function executeSpecialize(userId, profile, botState) {
  const units = await getUnspecializedMaxLevelUnits(userId).catch(() => []);

  if (!units.length) {
    setCooldown(botState, 'specialize', jitter(profile.cooldowns?.specialize ?? 60_000));
    return { ok: false, detail: { reason: 'nothing_to_specialize' } };
  }

  const preferred = String(profile.preferredSpec ?? 'random').toUpperCase();
  const specFor = (unit) => {
    if (preferred === 'A') return 'A';
    if (preferred === 'B') return 'B';
    // 'random' : si l'unité n'a qu'une seule spé disponible, la choisir
    const hasA = unit.specA_passive != null && unit.specA_passive !== '';
    const hasB = unit.specB_passive != null && unit.specB_passive !== '';
    if (hasA && !hasB) return 'A';
    if (hasB && !hasA) return 'B';
    return Math.random() < 0.5 ? 'A' : 'B';
  };

  const results = [];
  for (const unit of units) {
    const spec = specFor(unit);
    try {
      await dbQuery(
        'UPDATE user_units SET specialization = ? WHERE id = ? AND user_id = ?',
        [spec, unit.user_unit_id, Number(userId)]
      );
      results.push({ user_unit_id: unit.user_unit_id, spec });
      botLog(userId, `Spécialisation ${spec} appliquée à l'unité #${unit.user_unit_id}`);
    } catch (err) {
      results.push({ user_unit_id: unit.user_unit_id, error: err.message });
    }
  }

  setCooldown(botState, 'specialize', jitter(profile.cooldowns?.specialize ?? 60_000));
  const ok = results.some((r) => !r.error);
  return { ok, detail: { specialized: results } };
}

// ── Équipement artefacts ─────────────────────────────────────────────────────

async function executeEquip(userId, profile, botState) {
  const plan = await getEquipPlan(userId).catch(() => []);
  if (!plan.length) {
    setCooldown(botState, 'artifactEquip', jitter(profile.cooldowns.artifactEquip));
    return { ok: false, detail: { reason: 'nothing_to_equip' } };
  }

  const { artifactId, userUnitId } = plan[0];
  try {
    await equipArtifactById(userId, { artifactId, userUnitId });
    setCooldown(botState, 'artifactEquip', jitter(profile.cooldowns.artifactEquip));
    return { ok: true, detail: { artifactId, userUnitId } };
  } catch (err) {
    setCooldown(botState, 'artifactEquip', jitter(profile.cooldowns.artifactEquip, 0.5));
    return { ok: false, detail: { error: err.message, artifactId, userUnitId } };
  }
}

// ── Amélioration artefacts ───────────────────────────────────────────────────

async function executeUpgrade(userId, profile, botState) {
  const plan = await getUpgradePlan(userId, profile.maxArtifactUpgradeLevel).catch(() => []);
  if (!plan.length) {
    setCooldown(botState, 'artifactUpgrade', jitter(profile.cooldowns.artifactUpgrade));
    return { ok: false, detail: { reason: 'nothing_to_upgrade' } };
  }

  const artifactId = plan[0];
  try {
    const result = await enhanceArtifactById(userId, artifactId);
    setCooldown(botState, 'artifactUpgrade', jitter(profile.cooldowns.artifactUpgrade));
    return { ok: true, detail: { artifactId, upgraded: result.success, newLevel: result.new_level } };
  } catch (err) {
    setCooldown(botState, 'artifactUpgrade', jitter(profile.cooldowns.artifactUpgrade, 0.5));
    return { ok: false, detail: { error: err.message, artifactId } };
  }
}

// ── Guerre de guilde ─────────────────────────────────────────────────────────

async function executeGuildWar(userId, profile, botState) {
  try {
    const result = await executeWarAttack(userId);
    setCooldown(botState, 'guildWarAttack', jitter(profile.cooldowns.guildWarAttack));
    if (!result) return { ok: false, detail: { reason: 'no_attack_available' } };
    return { ok: true, detail: result };
  } catch (err) {
    setCooldown(botState, 'guildWarAttack', jitter(profile.cooldowns.guildWarAttack, 0.5));
    return { ok: false, detail: { error: err.message } };
  }
}

// ── Campagne ─────────────────────────────────────────────────────────────────

async function executeCampaign(userId, profile, botState) {
  const teamPreset = await getBestTeamPreset(userId, profile.maxFatigueForCombat).catch(() => null);
  if (!teamPreset) {
    setCooldown(botState, 'campaignBattle', jitter(profile.cooldowns.campaignBattle));
    return { ok: false, detail: { reason: 'no_valid_team' } };
  }

  // Si un étage était bloqué, on tente l'étage juste en dessous (farm pour XP)
  // puis on réessaie l'étage bloqué au tick suivant.
  const blocked = botState.campaignBlocked ?? null;
  const target  = blocked
    ? (getCampaignFallbackTarget(blocked) ?? await findNextCampaignTarget(userId))
    : await findNextCampaignTarget(userId);

  if (!target) {
    setCooldown(botState, 'campaignBattle', jitter(profile.cooldowns.campaignBattle * 3));
    return { ok: false, detail: { reason: 'no_target_stage' } };
  }

  const { chapter, stage, mode } = target;
  const isFallback = blocked &&
    (target.chapter !== blocked.chapter || target.stage !== blocked.stage || target.mode !== blocked.mode);
  const seasonKey  = getSeasonKey();

  let enemyData;
  try {
    enemyData = await buildEnemyTeamFromStage(chapter, stage, mode, seasonKey);
  } catch (err) {
    setCooldown(botState, 'campaignBattle', jitter(profile.cooldowns.campaignBattle));
    return { ok: false, detail: { error: err.message, chapter, stage, mode } };
  }

  let playerTeam;
  try {
    playerTeam = await buildTeamFromDb(userId, teamPreset.slots);
  } catch (err) {
    setCooldown(botState, 'campaignBattle', jitter(profile.cooldowns.campaignBattle));
    return { ok: false, detail: { error: err.message } };
  }

  const noyau = getSelectedNoyau(playerTeam, teamPreset.selectedNoyauIndex ?? 0);
  applyNoyauBonus(playerTeam, noyau);

  const seed = Date.now() % 2_147_483_647;
  const log  = simulateBattle(playerTeam, enemyData.team, {
    seed,
    bossModifier: enemyData.bossModifier ?? undefined,
  });

  const won            = log.summary?.winner === 'A';
  const isBoss         = stage === 10;
  const allUserUnitIds = teamPreset.slots.map((s) => Number(s.user_unit_id)).filter(Boolean);

  // ── Mise à jour de l'état de blocage ────────────────────────────────────
  if (!isFallback) {
    if (won) {
      // Victoire sur l'étage cible (normal ou bloqué) → progression normale
      botState.campaignBlocked = null;
    } else {
      // Défaite → mémoriser le blocage pour retourner au Stage 1 du chapitre
      botState.campaignBlocked = { chapter, stage, mode };
    }
  } else {
    // On jouait le Stage 1 de repli
    if (won) {
      // Victoire sur S1 → effacer pour retenter l'étage bloqué au prochain tick
      botState.campaignBlocked = null;
    }
    // Défaite sur S1 → garder campaignBlocked : on reviendra sur S1 au prochain tick
    // jusqu'à pouvoir le passer, puis on retentera l'étage bloqué
  }

  if (won) {
    await grantCampaignXp(
      userId,
      teamPreset.slots,
      allUserUnitIds.map((id) => ({ user_unit_id: id })),
      isBoss,
      mode,
      chapter
    ).catch(() => {});

    try {
      const rewards = await computeStageRewards(userId, chapter, stage, mode, seasonKey);
      await markProgress(userId, chapter, stage, mode, seasonKey);
      if (rewards) await applyRewardsTransaction(userId, rewards);
    } catch { /* non-critique */ }
  }
  // Les bots ne subissent pas la fatigue — reset à 0 après chaque combat
  await resetBotUnitsFatigue(allUserUnitIds).catch(() => {});

  await grantCombatArtifactRewards(userId, { victory: won, battleType: 'campaign' }).catch(() => {});
  await applyCombatStats({ userUnitIds: allUserUnitIds, winner: won ? 'win' : 'loss', combatStats: {} }).catch(() => {});

  setCooldown(botState, 'campaignBattle', jitter(profile.cooldowns.campaignBattle));
  return {
    ok: won,
    detail: { chapter, stage, mode, won, fallback: isFallback || undefined },
  };
}

/**
 * Retourne le Stage 1 du même chapitre comme cible de repli.
 * Le bot le joue pour accumuler de l'XP, puis retente l'étage bloqué.
 * - stage > 1 → même chapitre, stage 1 (farm XP)
 * - stage === 1 → déjà au minimum du chapitre, pas de repli possible
 */
function getCampaignFallbackTarget(blocked) {
  const { chapter, stage, mode } = blocked;
  if (stage > 1) return { chapter, stage: 1, mode };
  return null; // déjà au stage 1, on retentera directement
}

/**
 * Trouve le prochain stage de campagne à jouer (premier non complété disponible).
 * Tente normal d'abord, puis hard. Si tout est terminé, rejoue le dernier boss hard pour l'XP.
 */
async function findNextCampaignTarget(userId) {
  for (const mode of ['normal', 'hard']) {
    try {
      const status = await getCampaignStatus(userId, mode);
      if (!status.unlocked) continue;
      if (mode === 'hard' && !status.hardUnlocked) continue;

      for (let ch = 1; ch <= 10; ch++) {
        const chapter = status.chapters?.[ch];
        if (!chapter?.chapterAvailable) continue;
        for (const stageInfo of chapter.stages) {
          if (stageInfo.available && !stageInfo.cleared) {
            return { chapter: ch, stage: stageInfo.stage, mode };
          }
        }
      }
    } catch { continue; }
  }

  // Tout terminé : rejouer un boss hard pour l'XP (répétable)
  try {
    const status = await getCampaignStatus(userId, 'hard');
    if (status.unlocked && status.hardUnlocked) {
      for (let ch = 10; ch >= 1; ch--) {
        const chapter = status.chapters?.[ch];
        if (chapter?.chapterAvailable) {
          return { chapter: ch, stage: 10, mode: 'hard' };
        }
      }
    }
  } catch { /* skip */ }

  return null;
}

// ── Donjon ───────────────────────────────────────────────────────────────────

async function executeDungeon(userId, profile, botState) {
  const teamPreset = await getBestTeamPreset(userId, profile.maxFatigueForCombat).catch(() => null);
  if (!teamPreset) {
    setCooldown(botState, 'dungeonBattle', jitter(profile.cooldowns.dungeonBattle));
    return { ok: false, detail: { reason: 'no_valid_team' } };
  }

  const plan = await getDungeonPlan(userId, botState, profile).catch(() => null);
  if (!plan) {
    setCooldown(botState, 'dungeonBattle', jitter(profile.cooldowns.dungeonBattle * 2));
    return { ok: false, detail: { reason: 'no_dungeon_plan' } };
  }

  const { element, level, mode: planMode, hasActiveRun } = plan;
  const teamBody = {
    element,
    level,
    team:                  teamPreset.slots,
    selected_noyau_index:  teamPreset.selectedNoyauIndex ?? 0,
  };

  let levelSuccess = false;
  let combatsDone  = 0;
  // Démarrer sur le bon combat selon l'état (run actif = continuer, sinon démarrer)
  let startFromCombat = hasActiveRun ? 2 : 1;

  for (let combatNum = startFromCombat; combatNum <= 3; combatNum++) {
    let startResult;
    try {
      startResult = combatNum === 1
        ? await startDungeonCombat(userId, teamBody)
        : await continueDungeonCombat(userId);
    } catch (err) {
      botLog(userId, `dungeon_start_c${combatNum}_failed`, { error: err.message });
      levelSuccess = false;
      break;
    }

    if (!startResult?.success) {
      botLog(userId, `dungeon_start_c${combatNum}_rejected`, { reason: startResult?.error });
      levelSuccess = false;
      break;
    }

    const pb = startResult.pendingBattle;
    if (!pb?.interactiveSession?.teamA || !pb.interactiveSession.teamB) {
      levelSuccess = false;
      break;
    }

    const seed = Number(pb.interactiveSession.seed) || (Date.now() % 2_147_483_647);
    const log  = simulateBattle(pb.interactiveSession.teamA, pb.interactiveSession.teamB, { seed });
    const won  = log.summary?.winner === 'A';

    // Persister le résultat avant d'appeler finalizeDungeonBattle
    pb.result  = won ? 'win' : 'loss';
    pb.success = won;
    try {
      await updatePendingBattlePayload(userId, pb.id, pb);
    } catch { /* best effort */ }

    let finalResult;
    try {
      finalResult = await finalizeDungeonBattle(userId, pb.id, pb, won, null);
    } catch (err) {
      botLog(userId, `dungeon_finalize_c${combatNum}_failed`, { error: err.message });
      levelSuccess = false;
      break;
    }

    combatsDone++;

    if (!won) {
      levelSuccess = false;
      break;
    }

    if (finalResult?.dungeonLevelComplete || finalResult?.dungeonChainNext === false) {
      levelSuccess = true;
      break;
    }
    // dungeonChainNext === true → continuer vers le combat suivant
  }

  // Les bots ne subissent pas la fatigue — reset à 0 après chaque séquence de donjon
  const dungeonUnitIds = teamPreset.slots.map((s) => Number(s.user_unit_id)).filter(Boolean);
  await resetBotUnitsFatigue(dungeonUnitIds).catch(() => {});

  updateDungeonState(botState, element, level, levelSuccess, profile);
  setCooldown(botState, 'dungeonBattle', jitter(profile.cooldowns.dungeonBattle));
  return { ok: levelSuccess, detail: { element, level, planMode, combatsDone } };
}

// ── PvP ──────────────────────────────────────────────────────────────────────

async function executePvp(userId, profile, botState) {
  try {
    const result = await executePvpBattle(userId);
    setCooldown(botState, 'pvpBattle', jitter(profile.cooldowns.pvpBattle));
    if (!result) return { ok: false, detail: { reason: 'pvp_unavailable' } };
    return { ok: result.success, detail: result };
  } catch (err) {
    setCooldown(botState, 'pvpBattle', jitter(profile.cooldowns.pvpBattle, 0.5));
    return { ok: false, detail: { error: err.message } };
  }
}

// ── Helpers bots ─────────────────────────────────────────────────────────────

/**
 * Remet la fatigue à 0 pour les unités du bot.
 * Les bots n'ont aucune limite de combat liée à la fatigue.
 */
async function resetBotUnitsFatigue(userUnitIds) {
  if (!userUnitIds?.length) return;
  const placeholders = userUnitIds.map(() => '?').join(',');
  await dbQuery(
    `UPDATE user_units SET fatigue = 0, fatigue_last_update = NOW() WHERE id IN (${placeholders})`,
    userUnitIds
  );
}

// ── Idle ─────────────────────────────────────────────────────────────────────

async function executeIdle(userId, profile, botState) {
  setCooldown(botState, '_idle', jitter(profile.cooldowns.idle));
  return { ok: true, detail: { reason: 'idle' } };
}
