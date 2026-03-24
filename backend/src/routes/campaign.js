import { applyHardChapterPlayerStatModifiers } from '../../../core/campaignHardModifiers.js';
import {
  buildTeamFromDb,
  validateTeamSlots,
  getSelectedNoyau,
  applyNoyauBonus,
  teamHasUnfitUnits
} from '../services/battleTeamService.js';
import {
  getSeasonKey,
  getHardVariantKey,
  isCampaignUnlocked,
  getCampaignStatus,
  buildEnemyTeamFromStage,
  computeStageRewards,
  applyRewardsTransaction,
  markProgress,
  grantCampaignXp,
  applyCampaignFatigue,
  isChapterAvailable,
  isStageAvailable
} from '../services/campaignService.js';
import { query } from '../config/db.js';
import { createPendingBattle, serializePendingBattle } from '../services/pendingBattleService.js';
import { getSkillDescriptionForTooltip } from '../utils/skillDescription.js';

/** Garantit type, sourceName, targetName + champs legacy (actorName, actionType) pour ancien frontend. */
function normalizeBattleLogForApi(battleLog) {
  if (!Array.isArray(battleLog)) return [];
  const typeToActionType = (t, e) => {
    if (!t || t === 'UNKNOWN') return 'unknown';
    const lower = String(t).toLowerCase();
    if (lower === 'turn_start') return 'turn_start';
    if (lower === 'battle_end') return 'battle_end';
    if (lower === 'basic_attack') return 'basic_attack';
    if (lower === 'skill_cast') return 'skill';
    if (lower === 'damage') return 'skill_damage';
    if (lower === 'death') return 'death';
    if (lower === 'heal') return 'heal';
    if (lower === 'shield') return 'shield';
    if (lower === 'buff_apply') return 'buff';
    if (lower === 'debuff_apply') return 'debuff';
    if (lower === 'atb_up') return 'atb_up';
    if (lower === 'reduce_atb') {
      const pct = e?.value != null ? Math.round(Number(e.value) * 100) : 0;
      return `réduit la jauge d'action (${pct}%)`;
    }
    return lower;
  };
  const normalized = battleLog.map((e) => {
    const extra = e?.extra && typeof e.extra === 'object' ? e.extra : {};
    const type = e?.type ?? e?.actionType ?? 'UNKNOWN';
    const sourceName = e?.sourceName ?? e?.actorName ?? e?.actor ?? null;
    const rawMeta = e?.meta && typeof e.meta === 'object' ? e.meta : {};
    const targetName = e?.targetName ?? e?.target ?? extra?.targetName ?? rawMeta?.targetName ?? null;
    const skillName = rawMeta?.skillName ?? extra?.skillName;
    const meta = (skillName === 'GENERIC' || !skillName) ? { ...rawMeta, skillName: null } : rawMeta;
    const extraOut = { ...extra, ...meta };
    if (skillName === 'GENERIC' || !skillName) extraOut.skillName = null;
    const lowerType = String(type).toLowerCase();
    const isGenericSkill = (lowerType === 'skill_cast' || lowerType === 'skill') && (skillName === 'GENERIC' || !skillName);
    const actionType = isGenericSkill
      ? "utilise une attaque spéciale"
      : typeToActionType(type, e);
    return {
      turn: e?.turn ?? 0,
      type,
      sourceId: e?.sourceId ?? e?.actorId ?? null,
      sourceName,
      targetId: e?.targetId ?? null,
      targetName,
      value: e?.value ?? e?.damage ?? e?.heal ?? null,
      meta,
      actionType,
      actorId: e?.sourceId ?? e?.actorId ?? null,
      actorName: sourceName,
      targetId: e?.targetId ?? null,
      isCrit: e?.isCrit ?? false,
      isBlocked: e?.isBlocked ?? false,
      extra: extraOut
    };
  });

  // Pour "utilise une attaque spéciale" (skill dégâts sans nom), récupérer la répartition des dégâts par cible et masquer les lignes DAMAGE.
  for (let i = 0; i < normalized.length; i++) {
    const entry = normalized[i];
    if (entry.actionType !== "utilise une attaque spéciale") continue;
    const turn = entry.turn;
    const srcId = entry.sourceId;
    const srcName = entry.sourceName;
    const damageByTarget = [];
    for (let j = i + 1; j < normalized.length; j++) {
      const next = normalized[j];
      if (next.turn !== turn) break;
      const sameSource = (next.sourceId != null && next.sourceId === srcId) || (next.sourceName != null && next.sourceName === srcName);
      const lower = String(next.type || '').toLowerCase();
      if (sameSource && (lower === 'damage' || lower === 'skill_damage')) {
        const val = Number(next.value) || 0;
        const targetName = next.targetName ?? next.targetId ?? '?';
        damageByTarget.push({ targetName: String(targetName), value: val });
        next.meta = { ...(next.meta || {}), mergedIntoSkillCast: true };
      }
    }
    if (damageByTarget.length > 0) {
      const totalDamage = damageByTarget.reduce((sum, d) => sum + d.value, 0);
      entry.value = totalDamage;
      entry.extra = { ...(entry.extra || {}), skillTotalDamage: totalDamage, skillDamageByTarget: damageByTarget };
    }
  }
  return normalized.filter((e) => !(e.meta && e.meta.mergedIntoSkillCast));
}

function hashSeed(str) {
  let h = 0;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h) || 1;
}

export function registerCampaignRoutes(fastify, authenticate) {
  fastify.get('/campaign/status', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user?.id;
    if (userId == null) {
      return reply.code(401).send({ error: 'UNAUTHORIZED' });
    }
    const mode = (request.query?.mode || 'normal').toLowerCase();
    if (mode !== 'normal' && mode !== 'hard') {
      return reply.code(400).send({ error: 'INVALID_MODE', message: 'mode doit être normal ou difficile' });
    }
    const seasonKey = mode === 'hard' ? getSeasonKey() : null;
    const status = await getCampaignStatus(userId, mode, seasonKey);
    if (!status.unlocked) {
      return reply.code(403).send({
        error: 'CAMPAIGN_LOCKED',
        requiredUnits: status.requiredUnits ?? 5
      });
    }
    return status;
  });

  fastify.get('/campaign/rewards', { preHandler: [authenticate] }, async (request, reply) => {
    const chapter = Number(request.query?.chapter);
    const stage = Number(request.query?.stage);
    const mode = (request.query?.mode || 'normal').toLowerCase();
    if (!Number.isInteger(chapter) || chapter < 1 || chapter > 10 || !Number.isInteger(stage) || stage < 1 || stage > 10 || (mode !== 'normal' && mode !== 'hard')) {
      return reply.code(400).send({ error: 'INVALID_PARAMS' });
    }
    const [row] = await query(
      'SELECT credits, cores, fragments, ascension_essence FROM campaign_rewards WHERE chapter = ? AND stage = ? AND mode = ?',
      [chapter, stage, mode]
    );
    if (!row) return reply.code(404).send({ error: 'NOT_FOUND' });
    return { credits: row.credits ?? 0, cores: row.cores ?? 0, fragments: row.fragments ?? 0, ascension_essence: row.ascension_essence ?? 0 };
  });

  fastify.post('/campaign/start', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user?.id;
    if (userId == null) {
      return reply.code(401).send({ error: 'UNAUTHORIZED' });
    }
    const { mode, chapter, stage, team, selected_noyau_index: selectedNoyauIndex } = request.body || {};
    const m = (mode || 'normal').toLowerCase();
    if (m !== 'normal' && m !== 'hard') {
      return reply.code(400).send({ error: 'INVALID_MODE' });
    }
    const ch = Number(chapter);
    const st = Number(stage);
    if (!Number.isInteger(ch) || ch < 1 || ch > 10 || !Number.isInteger(st) || st < 1 || st > 10) {
      return reply.code(400).send({ error: 'INVALID_CHAPTER_STAGE' });
    }
    const valid = validateTeamSlots(team);
    if (!valid.ok) {
      return reply.code(400).send({ error: valid.error, message: valid.message });
    }

    const unlocked = await isCampaignUnlocked(userId);
    if (!unlocked) {
      return reply.code(403).send({ error: 'CAMPAIGN_LOCKED', requiredUnits: 5 });
    }

    const seasonKey = m === 'hard' ? getSeasonKey() : null;
    const chapterAvailable = await isChapterAvailable(userId, ch, m, seasonKey);
    if (!chapterAvailable) {
      return reply.code(403).send({ error: 'CHAPTER_LOCKED', message: 'Chapitre non débloqué' });
    }

    const available = await isStageAvailable(userId, ch, st, m, seasonKey);
    if (!available) {
      return reply.code(400).send({ error: 'STAGE_NOT_AVAILABLE', message: 'Stage non débloqué ou déjà complété dans ce mode.' });
    }

    let playerTeam;
    try {
      playerTeam = await buildTeamFromDb(userId, team);
    } catch (e) {
      request.log.error(e, 'buildTeamFromDb failed');
      return reply.code(400).send({
        error: 'TEAM_BUILD_FAILED',
        message: 'Équipe invalide.',
        details: process.env.NODE_ENV !== 'production' ? (e?.message || String(e)) : undefined
      });
    }
    if (playerTeam.length === 0) {
      return reply.code(400).send({ error: 'INVALID_TEAM', message: 'Aucune unité valide.' });
    }
    const noyau = getSelectedNoyau(playerTeam, selectedNoyauIndex ?? 0);
    applyNoyauBonus(playerTeam, noyau);
    if (m === 'hard') {
      applyHardChapterPlayerStatModifiers(playerTeam, ch);
    }

    if (teamHasUnfitUnits(playerTeam)) {
      return reply.code(400).send({
        error: 'UNIT_CANNOT_FIGHT',
        message:
          "Impossible de lancer le combat : au moins une unité du preset a des PV à zéro ou est blessée. Soigne tes unités dans la collection."
      });
    }

    let enemyData;
    try {
      enemyData = await buildEnemyTeamFromStage(ch, st, m, seasonKey);
    } catch (e) {
      request.log.error(e);
      return reply.code(500).send({ error: 'STAGE_BUILD_FAILED' });
    }
    const enemyTeam = enemyData.team || [];
    if (enemyTeam.length === 0) {
      return reply.code(500).send({ error: 'NO_ENEMY_TEAM' });
    }

    const variantKey = m === 'hard' ? getHardVariantKey(seasonKey, ch) : null;
    const seedStr = m === 'normal'
      ? `${userId}-${ch}-${st}`
      : `${userId}-${seasonKey}-${ch}-${st}-${variantKey}`;
    const seed = hashSeed(seedStr);

    const initialUnits = [
      ...playerTeam.map((u, i) => ({
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
        skillDescription: getSkillDescriptionForTooltip(u),
        rarity: (u.rarity || 'common').toLowerCase(),
        archetype: u.archetype ?? null,
        role: u.role ?? null,
        fatigue: u.fatigue ?? 0
      })),
      ...enemyTeam.map((u, i) => ({
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
        skillDescription: getSkillDescriptionForTooltip(u),
        rarity: (u.rarity || 'common').toLowerCase(),
        archetype: u.archetype ?? null,
        role: u.role ?? null
      }))
    ];

    const rewardsPreview = await computeStageRewards(userId, ch, st, m, seasonKey);
    const isBoss = st === 10;
    const allUserUnitIds = team.map((s) => Number(s.user_unit_id)).filter(Boolean);

    const pendingBattle = await createPendingBattle(userId, 'campaign', {
      title: `Chapitre ${ch} - Stage ${st}`,
      mode: m,
      chapter: ch,
      stage: st,
      seasonKey,
      result: null,
      success: null,
      initialUnits,
      interactiveSession: {
        seed,
        bossModifier: enemyData.bossModifier || null,
        teamA: playerTeam,
        teamB: enemyTeam
      },
      rewardsPreview: rewardsPreview || null,
      finalizeData: {
        team,
        allUserUnitIds,
        isBoss
      }
    });

    return {
      pendingBattle: serializePendingBattle(pendingBattle)
    };
  });
}
