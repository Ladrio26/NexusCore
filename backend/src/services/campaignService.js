import { query, getPool } from '../config/db.js';
import { computeScaledStats } from '../../../core/combatEngine.js';
import { addXp } from './xpService.js';
import { computeCurrentFatigue } from '../utils/fatigueUtils.js';

const MIN_UNITS_TO_UNLOCK = 5;
const HARD_MODE_UNLOCK_NORMAL_CHAPTER = 5;
const HARD_MODE_UNLOCK_NORMAL_STAGE = 10;
const XP_NORMAL_TRASH = 1600;
const XP_NORMAL_BOSS = 4000;
const XP_HARD_TRASH = 3000;
const XP_HARD_BOSS = 8000;
const FATIGUE_PER_COMBAT = 3;
const FATIGUE_XP_HALF_THRESHOLD = 50;
const NORMAL_TRASH_XP_BY_CHAPTER = [1000, 1150, 1300, 1450, 1575, 1675, 1775, 1875, 1975, 2225];
const HARD_TRASH_XP_BY_CHAPTER = [2000, 2250, 2500, 2750, 3000, 3000, 3250, 3500, 3750, 4000];

function getCampaignXpChapterIndex(chapter) {
  const index = Math.max(0, Math.min(9, Number(chapter || 1) - 1));
  return index;
}

export function getCampaignXpPerUnit(mode, isBoss, chapter = 1) {
  const index = getCampaignXpChapterIndex(chapter);
  if (mode === 'hard') {
    const trashXp = HARD_TRASH_XP_BY_CHAPTER[index];
    return isBoss ? Math.round(trashXp * (XP_HARD_BOSS / XP_HARD_TRASH)) : trashXp;
  }
  const trashXp = NORMAL_TRASH_XP_BY_CHAPTER[index];
  return isBoss ? Math.round(trashXp * (XP_NORMAL_BOSS / XP_NORMAL_TRASH)) : trashXp;
}

/**
 * @param {Date} [dateNow]
 * @returns {string} "YYYY-MM"
 */
export function getSeasonKey(dateNow = new Date()) {
  const y = dateNow.getFullYear();
  const m = String(dateNow.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Variant Hard déterministe par mois/chapitre (A|B|C).
 */
export function getHardVariantKey(seasonKey, chapter) {
  let h = 0;
  const s = `${seasonKey}-${chapter}`;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(h) % 3;
  return ['A', 'B', 'C'][idx];
}

export async function isCampaignUnlocked(userId) {
  const rows = await query('SELECT COUNT(*) AS n FROM user_units WHERE user_id = ?', [userId]);
  const n = Number(rows[0]?.n ?? 0);
  return n >= MIN_UNITS_TO_UNLOCK;
}

export async function isHardCampaignUnlocked(userId) {
  const rows = await query(
    'SELECT cleared FROM campaign_progress_normal WHERE user_id = ? AND chapter = ? AND stage = ? LIMIT 1',
    [userId, HARD_MODE_UNLOCK_NORMAL_CHAPTER, HARD_MODE_UNLOCK_NORMAL_STAGE]
  );
  return !!rows[0]?.cleared;
}

/**
 * @param {number} userId
 * @param {'normal'|'hard'} mode
 * @param {string} [seasonKey] requis si mode === 'hard'
 */
export async function getCampaignStatus(userId, mode, seasonKey = null) {
  const unlocked = await isCampaignUnlocked(userId);
  if (!unlocked) {
    return { unlocked: false, requiredUnits: MIN_UNITS_TO_UNLOCK, hardUnlocked: false, chapters: null };
  }
  const hardUnlocked = await isHardCampaignUnlocked(userId);
  const key = mode === 'hard' ? (seasonKey || getSeasonKey()) : null;
  const progressRows = mode === 'normal'
    ? await query('SELECT chapter, stage, cleared, reward_claimed FROM campaign_progress_normal WHERE user_id = ?', [userId])
    : await query('SELECT chapter, stage, cleared, reward_claimed FROM campaign_progress_hard WHERE user_id = ? AND season_key = ?', [userId, key]);

  const byKey = new Map(progressRows.map((r) => [`${r.chapter}-${r.stage}`, r]));
  let byKeyNormal = null;
  if (mode === 'normal') {
    const normalProgressRows = await query('SELECT chapter, stage, cleared FROM campaign_progress_normal WHERE user_id = ?', [userId]);
    byKeyNormal = new Map(normalProgressRows.map((r) => [`${r.chapter}-${r.stage}`, r]));
  }

  const stages = await query('SELECT chapter, stage, is_boss FROM campaign_stages ORDER BY chapter, stage');
  const stageMap = new Map(stages.map((row) => [`${row.chapter}-${row.stage}`, row]));
  const chapters = {};
  for (let c = 1; c <= 10; c++) {
    const chapterHasStages = stages.some((row) => row.chapter === c);
    const chapterAvailable = mode === 'normal'
      ? (chapterHasStages && (c === 1 || !!byKeyNormal?.get(`${c - 1}-10`)?.cleared))
      : (chapterHasStages && hardUnlocked && !!key && (c === 1 || !!byKey.get(`${c - 1}-10`)?.cleared));
    chapters[c] = { chapterAvailable, stages: [] };
    for (let s = 1; s <= 10; s++) {
      const row = stageMap.get(`${c}-${s}`);
      const prog = byKey.get(`${c}-${s}`);
      const cleared = !!prog?.cleared;
      const rewardClaimed = !!prog?.reward_claimed;
      const prevStage = s === 1 ? null : byKey.get(`${c}-${s - 1}`);
      const available = !!row && chapterAvailable && (s === 1 ? true : !!prevStage?.cleared);
      const isBoss = !!row?.is_boss;
      chapters[c].stages.push({
        stage: s,
        isBoss,
        cleared,
        rewardClaimed,
        available,
        xpPerUnitNormal: getCampaignXpPerUnit('normal', isBoss, c),
        xpPerUnitHard: getCampaignXpPerUnit('hard', isBoss, c)
      });
    }
  }
  return {
    unlocked: true,
    requiredUnits: MIN_UNITS_TO_UNLOCK,
    hardUnlocked,
    hardUnlockRequirement: {
      chapter: HARD_MODE_UNLOCK_NORMAL_CHAPTER,
      stage: HARD_MODE_UNLOCK_NORMAL_STAGE
    },
    mode,
    seasonKey: key,
    chapters
  };
}

/**
 * Charge une unité par code (pour ennemis campagne).
 */
async function getUnitByCode(code) {
  const rows = await query(
    `SELECT id, code, name, rarity, role, attack_type, element, archetype,
            base_hp, base_attack, base_defense, base_speed, mastery, traits, skill_data, image_url
     FROM units WHERE code = ?`,
    [code]
  );
  return rows[0] || null;
}

/**
 * Construit l'équipe ennemie pour un stage. Applique le multiplicateur de stats.
 * Pour les boss, retourne aussi le modifier à passer au combat (config.bossModifier).
 */
export async function buildEnemyTeamFromStage(chapter, stage, mode, seasonKey = null) {
  const rows = await query(
    'SELECT * FROM campaign_stages WHERE chapter = ? AND stage = ?',
    [chapter, stage]
  );
  if (!rows.length) throw new Error('STAGE_NOT_FOUND');
  const row = rows[0];
  const mult = mode === 'hard' ? Number(row.hard_multiplier) : Number(row.normal_multiplier);
  const isBoss = !!row.is_boss;
  let bossModifier = null;

  if (isBoss) {
    const template =
      row.enemy_template && (typeof row.enemy_template === 'string' ? JSON.parse(row.enemy_template) : row.enemy_template);
    const unitSpecs = template?.units || [];
    const team = [];
    for (let i = 0; i < unitSpecs.length; i++) {
      const spec = unitSpecs[i];
      const code = spec?.code;
      if (!code) continue;
      const unit = await getUnitByCode(code);
      if (!unit) continue;
      const pos = spec.position === 'back' ? 'back' : 'front';
      const u = buildUnitForCombat(unit, mult, i + 1, false);
      u.position = pos;
      team.push(u);
    }

    const unit = await getUnitByCode(row.boss_unit_code);
    if (!unit) throw new Error('BOSS_UNIT_NOT_FOUND');
    const modRows = await query('SELECT normal_modifier, hard_modifier FROM campaign_boss_modifiers WHERE chapter = ? AND stage = ?', [chapter, stage]);
    const mod = mode === 'hard' && modRows[0]?.hard_modifier
      ? (typeof modRows[0].hard_modifier === 'string' ? JSON.parse(modRows[0].hard_modifier) : modRows[0].hard_modifier)
      : (modRows[0]?.normal_modifier ? (typeof modRows[0].normal_modifier === 'string' ? JSON.parse(modRows[0].normal_modifier) : modRows[0].normal_modifier) : null);
    if (mode === 'hard' && seasonKey) {
      const variantKey = getHardVariantKey(seasonKey, chapter);
      if (mod && typeof mod === 'object') mod.variantKey = variantKey;
    }
    bossModifier = mod || null;
    const enemy = buildUnitForCombat(unit, mult, team.length + 1, true);
    enemy.isBoss = true;
    team.push(enemy);
    return { team, bossModifier };
  }

  const template = row.enemy_template && (typeof row.enemy_template === 'string' ? JSON.parse(row.enemy_template) : row.enemy_template);
  const unitSpecs = template?.units || [];
  const team = [];
  for (let i = 0; i < unitSpecs.length; i++) {
    const spec = unitSpecs[i];
    const code = spec?.code;
    if (!code) continue;
    const unit = await getUnitByCode(code);
    if (!unit) continue;
    const pos = spec.position === 'back' ? 'back' : 'front';
    const u = buildUnitForCombat(unit, mult, i + 1, false);
    u.position = pos;
    team.push(u);
  }
  return { team, bossModifier: null };
}

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

function buildUnitForCombat(unitRow, multiplier, index, isBoss) {
  const level = 20;
  const skillData = parseJson(unitRow.skill_data);
  const unit = {
    id: unitRow.id,
    name: unitRow.name,
    code: unitRow.code,
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
    specialization: null,
    fatigue: 0,
    traits: parseJson(unitRow.traits) ?? unitRow.traits,
    skill_data: skillData,
    skillData,
    rangeType: unitRow.attack_type === 'melee' ? 'melee' : 'ranged',
    position: isBoss ? 'front' : 'front'
  };
  const stats = computeScaledStats(unit, { level, specialization: null });
  unit.maxHp = Math.round(stats.maxHp * multiplier);
  unit.attack = Math.round(stats.attack * multiplier);
  unit.defense = Math.round(stats.defense * multiplier);
  unit.speed = Math.round(stats.speed * multiplier);
  unit.mastery = Math.round(stats.mastery * multiplier);
  return unit;
}

/**
 * Retourne les rewards du stage si first clear non claimé.
 */
export async function computeStageRewards(userId, chapter, stage, mode, seasonKey = null) {
  const rewardRows = await query(
    'SELECT credits, cores, fragments, ascension_essence FROM campaign_rewards WHERE chapter = ? AND stage = ? AND mode = ?',
    [chapter, stage, mode]
  );
  if (!rewardRows.length) return null;
  const reward = rewardRows[0];
  const progressTable = mode === 'normal' ? 'campaign_progress_normal' : 'campaign_progress_hard';
  const progressWhere = mode === 'normal'
    ? 'user_id = ? AND chapter = ? AND stage = ?'
    : 'user_id = ? AND season_key = ? AND chapter = ? AND stage = ?';
  const progressParams = mode === 'normal' ? [userId, chapter, stage] : [userId, seasonKey || getSeasonKey(), chapter, stage];
  const progressRows = await query(
    `SELECT cleared, reward_claimed FROM ${progressTable} WHERE ${progressWhere}`,
    progressParams
  );
  const prog = progressRows[0];
  if (prog?.reward_claimed) return null;
  {
    return {
      credits: Number(reward.credits ?? 0),
      cores: Number(reward.cores ?? 0),
      fragments: Number(reward.fragments ?? 0),
      ascension_essence: Number(reward.ascension_essence ?? 0)
    };
  }
  return null;
}

export async function applyRewardsTransaction(userId, rewards) {
  if (!rewards) return;
  await query(
    `UPDATE user_wallet SET credits = credits + ?, cores = cores + ?, fragments = fragments + ?, ascension_essence = ascension_essence + ?
     WHERE user_id = ?`,
    [rewards.credits ?? 0, rewards.cores ?? 0, rewards.fragments ?? 0, rewards.ascension_essence ?? 0, userId]
  );
}

export async function markProgress(userId, chapter, stage, mode, seasonKey = null) {
  const key = mode === 'hard' ? (seasonKey || getSeasonKey()) : null;
  if (mode === 'normal') {
    await query(
      `INSERT INTO campaign_progress_normal (user_id, chapter, stage, cleared, reward_claimed, cleared_at)
       VALUES (?, ?, ?, 1, 1, NOW())
       ON DUPLICATE KEY UPDATE cleared = 1, reward_claimed = 1, cleared_at = NOW()`,
      [userId, chapter, stage]
    );
  } else {
    await query(
      `INSERT INTO campaign_progress_hard (user_id, season_key, chapter, stage, cleared, reward_claimed, cleared_at)
       VALUES (?, ?, ?, ?, 1, 1, NOW())
       ON DUPLICATE KEY UPDATE cleared = 1, reward_claimed = 1, cleared_at = NOW()`,
      [userId, key, chapter, stage]
    );
  }
}

/**
 * XP répétable : progressive par chapitre, total global inchangé par difficulté.
 * Uniquement aux survivants. XP /2 si fatigue > 50.
 */
export async function grantCampaignXp(userId, teamSlots, survivors, isBoss, mode, chapter = 1) {
  const baseXp = getCampaignXpPerUnit(mode, isBoss, chapter);
  const ids = survivors.map((s) => (s.user_unit_id != null ? s.user_unit_id : s)).filter(Boolean);
  if (!ids.length) return [];
  const placeholders = ids.map(() => '?').join(',');
  let rows;
  let useComputedFatigue = false;
  try {
    rows = await query(
      `SELECT id, fatigue, fatigue_last_update FROM user_units WHERE id IN (${placeholders})`,
      ids
    );
    useComputedFatigue = true;
  } catch (err) {
    const msg = (err?.message || err?.code || '').toString();
    if (msg.includes('fatigue_last_update') || err?.code === 'ER_BAD_FIELD_ERROR') {
      rows = await query(`SELECT id, fatigue FROM user_units WHERE id IN (${placeholders})`, ids);
    } else {
      throw err;
    }
  }
  const fatigueById = new Map(
    rows.map((r) => {
      const fatigue = useComputedFatigue
        ? computeCurrentFatigue({
            fatigue: r.fatigue ?? 0,
            fatigue_last_update: r.fatigue_last_update
          }).fatigue
        : (r.fatigue ?? 0);
      return [r.id, fatigue];
    })
  );
  const results = [];
  for (const id of ids) {
    const fatigue = fatigueById.get(id) ?? 0;
    let amount = baseXp;
    if (fatigue > FATIGUE_XP_HALF_THRESHOLD) amount = Math.floor(amount / 2);
    try {
      const r = await addXp(id, amount);
      results.push({ userUnitId: id, ...r });
    } catch (_) {
      results.push({ userUnitId: id, error: true });
    }
  }
  return results;
}

/**
 * Applique +fatigue aux unités utilisées en combat (campagne ou battle).
 * Calcule d'abord la fatigue actuelle (décrément par minute), puis ajoute FATIGUE_PER_COMBAT.
 */
export async function applyCampaignFatigue(userUnitIds) {
  if (!userUnitIds.length) return;
  const placeholders = userUnitIds.map(() => '?').join(',');
  let rows;
  let hasFatigueLastUpdate = false;
  try {
    rows = await query(
      `SELECT id, fatigue, fatigue_last_update FROM user_units WHERE id IN (${placeholders})`,
      userUnitIds
    );
    hasFatigueLastUpdate = true;
  } catch (err) {
    const msg = (err?.message || err?.code || '').toString();
    if (msg.includes('fatigue_last_update') || err?.code === 'ER_BAD_FIELD_ERROR') {
      await query(
        `UPDATE user_units SET fatigue = LEAST(100, fatigue + ?) WHERE id IN (${placeholders})`,
        [FATIGUE_PER_COMBAT, ...userUnitIds]
      );
      return;
    }
    throw err;
  }
  for (const r of rows) {
    const { fatigue: current, minutesPassed } = hasFatigueLastUpdate
      ? computeCurrentFatigue({
          fatigue: r.fatigue ?? 0,
          fatigue_last_update: r.fatigue_last_update
        })
      : { fatigue: r.fatigue ?? 0, minutesPassed: 0 };
    const newFatigue = Math.min(100, current + FATIGUE_PER_COMBAT);
    await query(
      'UPDATE user_units SET fatigue = ?, fatigue_last_update = NOW() WHERE id = ?',
      [newFatigue, r.id]
    );
    console.log('Fatigue recalculated:', { id: r.id, old: current, minutesPassed, new: newFatigue, afterCombat: true });
  }
}

/**
 * Vérifie si le chapitre est débloqué pour ce user/mode.
 * Normal: ch 1 toujours; ch N si stage 10 du ch N-1 cleared en normal.
 * Difficile: ch 1 si le boss 5-10 normal est battu; ch N si stage 10 du ch N-1 cleared en Difficile (même saison).
 */
export async function isChapterAvailable(userId, chapter, mode, seasonKey = null) {
  if (mode === 'normal') {
    const normalRows = await query('SELECT chapter, stage, cleared FROM campaign_progress_normal WHERE user_id = ?', [userId]);
    const byKey = new Map(normalRows.map((r) => [`${r.chapter}-${r.stage}`, r]));
    return chapter === 1 || !!byKey.get(`${chapter - 1}-10`)?.cleared;
  }
  if (!seasonKey) return false;
  const hardUnlocked = await isHardCampaignUnlocked(userId);
  if (!hardUnlocked) return false;
  if (chapter === 1) return true;
  const hardRows = await query('SELECT chapter, stage, cleared FROM campaign_progress_hard WHERE user_id = ? AND season_key = ?', [userId, seasonKey]);
  const byKey = new Map(hardRows.map((r) => [`${r.chapter}-${r.stage}`, r]));
  return !!byKey.get(`${chapter - 1}-10`)?.cleared;
}

/**
 * Vérifie si le stage est available pour ce user/mode.
 */
export async function isStageAvailable(userId, chapter, stage, mode, seasonKey = null) {
  const status = await getCampaignStatus(userId, mode, seasonKey);
  if (!status.unlocked) return false;
  const ch = status.chapters?.[chapter];
  if (!ch || !ch.chapterAvailable) return false;
  const st = ch.stages.find((s) => s.stage === stage);
  return !!st?.available;
}
