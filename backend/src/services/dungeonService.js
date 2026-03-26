import { query } from '../config/db.js';
import { computeScaledStats } from '../../../core/combatEngine.js';
import {
  buildTeamFromDb,
  validateTeamSlots,
  getSelectedNoyau,
  applyNoyauBonus,
  teamHasUnfitUnits
} from './battleTeamService.js';
import { createPendingBattle, serializePendingBattle, deletePendingBattle } from './pendingBattleService.js';
import { getSkillDescriptionForTooltip } from '../utils/skillDescription.js';
import { applyCombatStats } from './combatStatsService.js';
import { grantDungeonLevelCompleteRewards, grantDungeonFirstClearRewards } from './artifactService.js';
import { applyCampaignFatigue } from './campaignService.js';
import { applyUnitSpecializationToSkillData } from './battleTeamService.js';

export const DUNGEON_ELEMENTS = ['fire', 'water', 'plant', 'light', 'dark'];
const MAX_LEVEL = 10;
const COMBATS_PER_LEVEL = 3;

function parseJson(v) {
  if (v == null) return null;
  if (typeof v === 'object') return v;
  if (typeof v !== 'string') return null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

function normalizeElement(raw) {
  const e = String(raw || '').toLowerCase().trim();
  if (e === 'lumiere' || e === 'light') return 'light';
  if (e === 'tenebres' || e === 'tenebre' || e === 'dark') return 'dark';
  return DUNGEON_ELEMENTS.includes(e) ? e : null;
}

async function getUnitByCode(code) {
  const rows = await query(
    `SELECT id, code, name, rarity, role, attack_type, element, archetype,
            base_hp, base_attack, base_defense, base_speed, mastery, traits, skill_data, image_url,
            specA_bonus_stat, specB_bonus_stat,
            specA_skill_modifier, specB_skill_modifier, specA_passive, specB_passive
     FROM units WHERE code = ?`,
    [code]
  );
  return rows[0] || null;
}

function buildUnitForCombat(unitRow, multiplier, index, levelOverride, specializationOverride) {
  const level = levelOverride ?? 20;
  const specialization = specializationOverride ?? null;
  const skillData = parseJson(unitRow.skill_data);
  const unit = {
    id: unitRow.id,
    name: unitRow.name,
    code: unitRow.code,
    rarity: (unitRow.rarity || 'common').toLowerCase(),
    image_url: unitRow.image_url ?? null,
    element: unitRow.element,
    archetype: unitRow.archetype,
    role: unitRow.role,
    base_hp: unitRow.base_hp,
    base_attack: unitRow.base_attack,
    base_defense: unitRow.base_defense,
    base_speed: unitRow.base_speed,
    mastery: unitRow.mastery ?? 0,
    level,
    specialization,
    fatigue: 0,
    traits: parseJson(unitRow.traits) ?? unitRow.traits,
    skill_data: skillData,
    skillData,
    specA_bonus_stat: unitRow.specA_bonus_stat ?? null,
    specB_bonus_stat: unitRow.specB_bonus_stat ?? null,
    specA_skill_modifier: parseJson(unitRow.specA_skill_modifier) ?? null,
    specB_skill_modifier: parseJson(unitRow.specB_skill_modifier) ?? null,
    specA_passive: parseJson(unitRow.specA_passive) ?? unitRow.specA_passive ?? null,
    specB_passive: parseJson(unitRow.specB_passive) ?? unitRow.specB_passive ?? null,
    rangeType: unitRow.attack_type === 'melee' ? 'melee' : 'ranged',
    position: 'front'
  };
  applyUnitSpecializationToSkillData(unit, { npcCombat: true });
  const stats = computeScaledStats(unit, { level, specialization });
  unit.maxHp = Math.round(stats.maxHp * multiplier);
  unit.attack = Math.round(stats.attack * multiplier);
  unit.defense = Math.round(stats.defense * multiplier);
  unit.speed = Math.round(stats.speed * multiplier);
  unit.mastery = Math.round(stats.mastery * multiplier);
  return unit;
}

/**
 * Charge l’équipe ennemie depuis dungeon_encounters.enemy_template_json (vide = non configuré).
 */
export async function buildDungeonEnemyTeam(element, level, combatIndex) {
  const rows = await query(
    'SELECT enemy_template_json FROM dungeon_encounters WHERE element = ? AND level = ? AND combat_index = ?',
    [element, level, combatIndex]
  );
  if (!rows.length) return null;
  const template = parseJson(rows[0].enemy_template_json);
  const unitSpecs = template?.units;
  if (!Array.isArray(unitSpecs) || unitSpecs.length === 0) return null;
  const mult = Number(template?.stat_multiplier ?? 1) || 1;
  const team = [];
  for (let i = 0; i < unitSpecs.length; i++) {
    const spec = unitSpecs[i];
    const code = spec?.code;
    if (!code) continue;
    const unit = await getUnitByCode(code);
    if (!unit) continue;
    const pos = spec.position === 'back' ? 'back' : 'front';
    const unitLevel = spec.level ?? 20;
    const unitSpec = spec.specialization ?? null;
    const u = buildUnitForCombat(unit, mult, i + 1, unitLevel, unitSpec);
    u.position = pos;
    team.push(u);
  }
  return team.length > 0 ? team : null;
}

async function ensureProgressRows(userId) {
  for (const el of DUNGEON_ELEMENTS) {
    await query(
      'INSERT IGNORE INTO user_dungeon_progress (user_id, element, max_unlocked_level) VALUES (?, ?, 1)',
      [userId, el]
    );
  }
}

export async function getDungeonStatus(userId) {
  await ensureProgressRows(userId);
  const progressRows = await query(
    'SELECT element, max_unlocked_level FROM user_dungeon_progress WHERE user_id = ?',
    [userId]
  );
  const progress = {};
  for (const r of progressRows) {
    progress[r.element] = Math.min(MAX_LEVEL, Math.max(1, Number(r.max_unlocked_level) || 1));
  }
  for (const el of DUNGEON_ELEMENTS) {
    if (progress[el] == null) progress[el] = 1;
  }
  const runRows = await query('SELECT element, level, combats_cleared FROM user_dungeon_run WHERE user_id = ?', [userId]);
  const activeRun = runRows[0]
    ? {
        element: runRows[0].element,
        level: Number(runRows[0].level),
        combats_cleared: Number(runRows[0].combats_cleared ?? 0)
      }
    : null;
  return { elements: DUNGEON_ELEMENTS, progress, activeRun, maxLevel: MAX_LEVEL, combatsPerLevel: COMBATS_PER_LEVEL };
}

function hashSeed(str) {
  let h = 0;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h) || 1;
}

async function buildInitialUnitsPayload(playerTeam, enemyTeam) {
  return [
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
}

/**
 * Démarre le combat 1 d’un niveau (nouvelle série : efface la série en cours).
 */
export async function startDungeonCombat(userId, body) {
  const element = normalizeElement(body?.element);
  const level = Number(body?.level);
  const team = body?.team;
  const selectedNoyauIndex = Number(body?.selected_noyau_index ?? body?.selectedNoyauIndex ?? 0) || 0;

  if (!element || !Number.isInteger(level) || level < 1 || level > MAX_LEVEL) {
    return { success: false, error: 'INVALID_PARAMS', message: 'Élément ou niveau invalide.' };
  }
  await ensureProgressRows(userId);
  const progRows = await query(
    'SELECT max_unlocked_level FROM user_dungeon_progress WHERE user_id = ? AND element = ?',
    [userId, element]
  );
  const maxUnlocked = progRows[0] ? Number(progRows[0].max_unlocked_level) || 1 : 1;
  if (level > maxUnlocked) {
    return { success: false, error: 'LEVEL_LOCKED', message: 'Ce niveau est encore verrouillé.' };
  }
  const valid = validateTeamSlots(team);
  if (!valid.ok) {
    return { success: false, error: valid.error, message: valid.message };
  }
  const playerTeam = await buildTeamFromDb(userId, team);
  if (playerTeam.length === 0) {
    return { success: false, error: 'EMPTY_TEAM', message: 'Équipe vide.' };
  }
  const unfit = teamHasUnfitUnits(playerTeam);
  if (unfit.length > 0) {
    return { success: false, error: 'UNFIT_UNITS', message: 'Certaines unités ne peuvent pas combattre.', unfit };
  }
  const noyau = getSelectedNoyau(playerTeam, selectedNoyauIndex);
  applyNoyauBonus(playerTeam, noyau);

  const enemyTeam = await buildDungeonEnemyTeam(element, level, 1);
  if (!enemyTeam) {
    return {
      success: false,
      error: 'ENCOUNTER_NOT_CONFIGURED',
      message: "Cette rencontre n'est pas encore configurée (équipe ennemie vide)."
    };
  }

  const runRows = await query(
    'SELECT element, level, combats_cleared FROM user_dungeon_run WHERE user_id = ?',
    [userId]
  );
  if (runRows.length) {
    const r = runRows[0];
    const sameSeriesInProgress =
      String(r.element) === element &&
      Number(r.level) === level &&
      Number(r.combats_cleared ?? 0) > 0;
    if (sameSeriesInProgress) {
      return {
        success: false,
        error: 'DUNGEON_USE_CONTINUE',
        message: 'Tu dois enchaîner avec « Combat suivant » depuis le visualiseur, ou abandonner la série.'
      };
    }
  }

  const seed = hashSeed(`dungeon-${userId}-${element}-${level}-1-${Date.now()}`);
  await query('DELETE FROM user_dungeon_run WHERE user_id = ?', [userId]);
  await query(
    `INSERT INTO user_dungeon_run (user_id, element, level, combats_cleared, team_json, selected_noyau_index)
     VALUES (?, ?, ?, 0, ?, ?)`,
    [userId, element, level, JSON.stringify(team), selectedNoyauIndex]
  );

  const allUserUnitIds = team.map((s) => Number(s.user_unit_id)).filter(Boolean);
  const initialUnits = await buildInitialUnitsPayload(playerTeam, enemyTeam);

  const pendingBattle = await createPendingBattle(userId, 'dungeon', {
    title: `Donjon ${element} · Niv. ${level} — Combat 1/3`,
    dungeonElement: element,
    dungeonLevel: level,
    dungeonCombatIndex: 1,
    result: null,
    success: null,
    initialUnits,
    interactiveSession: {
      seed,
      bossModifier: null,
      teamA: playerTeam,
      teamB: enemyTeam
    },
    finalizeData: {
      team,
      allUserUnitIds,
      selectedNoyauIndex
    }
  });

  return { success: true, pendingBattle: serializePendingBattle(pendingBattle) };
}

/**
 * Combat suivant (2 ou 3) — même équipe que la série en cours.
 */
export async function continueDungeonCombat(userId) {
  const runRows = await query(
    'SELECT element, level, combats_cleared, team_json, selected_noyau_index FROM user_dungeon_run WHERE user_id = ?',
    [userId]
  );
  if (!runRows.length) {
    return { success: false, error: 'NO_ACTIVE_RUN', message: 'Aucune série en cours. Lance le combat 1.' };
  }
  const run = runRows[0];
  const element = run.element;
  const level = Number(run.level);
  const cleared = Number(run.combats_cleared ?? 0);
  const nextCombat = cleared + 1;
  if (nextCombat < 2 || nextCombat > COMBATS_PER_LEVEL) {
    return { success: false, error: 'INVALID_RUN_STATE', message: 'État de série invalide.' };
  }
  let team;
  try {
    team = typeof run.team_json === 'string' ? JSON.parse(run.team_json) : run.team_json;
  } catch {
    team = null;
  }
  if (!Array.isArray(team) || team.length === 0) {
    return { success: false, error: 'RUN_CORRUPT', message: 'Équipe de série invalide.' };
  }
  const selectedNoyauIndex = Number(run.selected_noyau_index ?? 0) || 0;
  const valid = validateTeamSlots(team);
  if (!valid.ok) {
    return { success: false, error: valid.error, message: valid.message };
  }
  const playerTeam = await buildTeamFromDb(userId, team);
  if (playerTeam.length === 0) {
    return { success: false, error: 'EMPTY_TEAM', message: 'Équipe vide.' };
  }
  const noyau = getSelectedNoyau(playerTeam, selectedNoyauIndex);
  applyNoyauBonus(playerTeam, noyau);

  const enemyTeam = await buildDungeonEnemyTeam(element, level, nextCombat);
  if (!enemyTeam) {
    return {
      success: false,
      error: 'ENCOUNTER_NOT_CONFIGURED',
      message: "Cette rencontre n'est pas encore configurée (équipe ennemie vide)."
    };
  }

  const seed = hashSeed(`dungeon-${userId}-${element}-${level}-${nextCombat}-${Date.now()}`);
  const allUserUnitIds = team.map((s) => Number(s.user_unit_id)).filter(Boolean);
  const initialUnits = await buildInitialUnitsPayload(playerTeam, enemyTeam);

  const pendingBattle = await createPendingBattle(userId, 'dungeon', {
    title: `Donjon ${element} · Niv. ${level} — Combat ${nextCombat}/3`,
    dungeonElement: element,
    dungeonLevel: level,
    dungeonCombatIndex: nextCombat,
    result: null,
    success: null,
    initialUnits,
    interactiveSession: {
      seed,
      bossModifier: null,
      teamA: playerTeam,
      teamB: enemyTeam
    },
    finalizeData: {
      team,
      allUserUnitIds,
      selectedNoyauIndex
    }
  });

  return { success: true, pendingBattle: serializePendingBattle(pendingBattle) };
}

/**
 * Finalisation après résultat client (appelée depuis battle/finalize).
 */
export async function finalizeDungeonBattle(userId, pendingBattleId, pendingBattle, success, clientCombatStats) {
  const fd = pendingBattle.finalizeData || {};
  const team = fd.team || [];
  const allUserUnitIds = Array.isArray(fd.allUserUnitIds)
    ? fd.allUserUnitIds.map(Number).filter(Boolean)
    : team.map((s) => Number(s.user_unit_id)).filter(Boolean);
  const dungeonElement = pendingBattle.dungeonElement;
  const dungeonLevel = Number(pendingBattle.dungeonLevel);
  const dungeonCombatIndex = Number(pendingBattle.dungeonCombatIndex);

  const winnerForStats = success ? 'win' : 'loss';
  try {
    await applyCombatStats({ userUnitIds: allUserUnitIds, winner: winnerForStats, combatStats: clientCombatStats || {} });
  } catch (err) {
    console.error('[Dungeon] applyCombatStats', err?.message);
  }

  if (!success) {
    await query('DELETE FROM user_dungeon_run WHERE user_id = ?', [userId]);
    await deletePendingBattle(userId, pendingBattleId);
    return {
      battleType: 'dungeon',
      success: false,
      progressUpdated: false,
      dungeonChainNext: false,
      dungeonRunReset: true
    };
  }

  /** Fatigue uniquement après le 3e combat gagné (fin de niveau), pas après les combats 1 et 2. */
  let artifactRewards = { goldGained: 0, artifactDrop: null, wallet: null };
  if (dungeonCombatIndex === COMBATS_PER_LEVEL) {
    await applyCampaignFatigue(allUserUnitIds);
    artifactRewards = await grantDungeonLevelCompleteRewards(userId, dungeonElement, dungeonLevel);
  }

  if (dungeonCombatIndex < COMBATS_PER_LEVEL) {
    await query(
      'UPDATE user_dungeon_run SET combats_cleared = ? WHERE user_id = ?',
      [dungeonCombatIndex, userId]
    );
    await deletePendingBattle(userId, pendingBattleId);
    return {
      battleType: 'dungeon',
      success: true,
      progressUpdated: false,
      dungeonChainNext: true,
      dungeonElement,
      dungeonLevel,
      dungeonNextCombat: dungeonCombatIndex + 1,
      gold_gained: artifactRewards.goldGained,
      artifact_drop: artifactRewards.artifactDrop,
      wallet: artifactRewards.wallet
    };
  }

  // Combat 3 : récompenses + déblocage niveau suivant (1er clear) + reset série (combats 1–2 à refaire)
  await query('DELETE FROM user_dungeon_run WHERE user_id = ?', [userId]);

  const insResult = await query(
    'INSERT IGNORE INTO user_dungeon_floor_clear (user_id, element, level) VALUES (?, ?, ?)',
    [userId, dungeonElement, dungeonLevel]
  );
  let progressUpdated = false;
  const inserted =
    insResult &&
    typeof insResult === 'object' &&
    'affectedRows' in insResult &&
    Number(insResult.affectedRows) === 1;

  let dungeonFirstClearRewards = null;
  let finalWallet = artifactRewards.wallet;

  if (inserted) {
    const fcr = await grantDungeonFirstClearRewards(userId, dungeonLevel);
    dungeonFirstClearRewards = {
      level: dungeonLevel,
      credits: fcr.credits,
      cores: fcr.cores,
      fragments: fcr.fragments,
      divine_credits: fcr.divine_credits,
      divine_cores: fcr.divine_cores,
      divine_fragments: fcr.divine_fragments
    };
    finalWallet = fcr.wallet;

    const progRows = await query(
      'SELECT max_unlocked_level FROM user_dungeon_progress WHERE user_id = ? AND element = ?',
      [userId, dungeonElement]
    );
    const maxU = progRows[0] ? Number(progRows[0].max_unlocked_level) || 1 : 1;
    if (dungeonLevel === maxU && maxU < MAX_LEVEL) {
      await query(
        'UPDATE user_dungeon_progress SET max_unlocked_level = ? WHERE user_id = ? AND element = ?',
        [maxU + 1, userId, dungeonElement]
      );
      progressUpdated = true;
    }
  }

  await deletePendingBattle(userId, pendingBattleId);

  return {
    battleType: 'dungeon',
    success: true,
    progressUpdated,
    dungeonChainNext: false,
    dungeonLevelComplete: true,
    dungeonRewardsGranted: true,
    gold_gained: artifactRewards.goldGained,
    artifact_drop: artifactRewards.artifactDrop,
    wallet: finalWallet,
    dungeonFirstClearRewards
  };
}
