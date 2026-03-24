/**
 * Génération d'équipes PNJ pour le PvP selon le palier Elo.
 * Utilise le même format d'unités que buildTeamFromDb pour le moteur de combat.
 */
import { query } from '../config/db.js';
import { computeScaledStats } from '../../../core/combatEngine.js';

const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

/**
 * Grille PvP PNJ selon le tableau de config joint.
 * Bronze 3 → Challenger 1 : niveau unités, rareté min/max, bonus artefacts.
 * Les boss de campagne sont exclus (géré par getBossUnitCodes).
 */
const ELO_TIERS = [
  { min: 0, max: 99, level: 1, rarityMin: 'common', rarityMax: 'common', artifactBonus: 0, specCount: 0 }, // Bronze 3
  { min: 100, max: 199, level: 5, rarityMin: 'common', rarityMax: 'uncommon', artifactBonus: 0, specCount: 0 }, // Bronze 2
  { min: 200, max: 299, level: 10, rarityMin: 'common', rarityMax: 'uncommon', artifactBonus: 0, specCount: 0 }, // Bronze 1
  { min: 300, max: 399, level: 15, rarityMin: 'common', rarityMax: 'uncommon', artifactBonus: 0, specCount: 0 }, // Argent 3
  { min: 400, max: 499, level: 20, rarityMin: 'common', rarityMax: 'rare', artifactBonus: 0, specCount: 0 }, // Argent 2
  { min: 500, max: 599, level: 25, rarityMin: 'common', rarityMax: 'rare', artifactBonus: 10, specCount: 0 }, // Argent 1
  { min: 600, max: 699, level: 30, rarityMin: 'uncommon', rarityMax: 'rare', artifactBonus: 10, specCount: 0 }, // Or 3
  { min: 700, max: 799, level: 35, rarityMin: 'uncommon', rarityMax: 'epic', artifactBonus: 20, specCount: 0 }, // Or 2
  { min: 800, max: 899, level: 40, rarityMin: 'uncommon', rarityMax: 'epic', artifactBonus: 30, specCount: 0 }, // Or 1
  { min: 900, max: 999, level: 45, rarityMin: 'uncommon', rarityMax: 'epic', artifactBonus: 40, specCount: 0 }, // Platine 3
  { min: 1000, max: 1099, level: 50, rarityMin: 'uncommon', rarityMax: 'legendary', artifactBonus: 50, specCount: 0 }, // Platine 2
  { min: 1100, max: 1199, level: 50, rarityMin: 'uncommon', rarityMax: 'legendary', artifactBonus: 60, specCount: 0 }, // Platine 1
  { min: 1200, max: 1299, level: 50, rarityMin: 'epic', rarityMax: 'legendary', artifactBonus: 70, specCount: 0 }, // Diamant 3
  { min: 1300, max: 1399, level: 50, rarityMin: 'epic', rarityMax: 'mythic', artifactBonus: 80, specCount: 0 }, // Diamant 2
  { min: 1400, max: 1499, level: 50, rarityMin: 'epic', rarityMax: 'mythic', artifactBonus: 90, specCount: 0 }, // Diamant 1
  { min: 1500, max: 1599, level: 50, rarityMin: 'epic', rarityMax: 'mythic', artifactBonus: 100, specCount: 0 }, // Master 1
  { min: 1600, max: 1699, level: 50, rarityMin: 'epic', rarityMax: 'mythic', artifactBonus: 150, specCount: 0 }, // Grand Master 1
  { min: 1700, max: 9999, level: 50, rarityMin: 'epic', rarityMax: 'mythic', artifactBonus: 200, specCount: 0 } // Challenger 1
];

function getTierForElo(elo) {
  const e = Math.max(0, Number(elo) || 0);
  for (const tier of ELO_TIERS) {
    if (e >= tier.min && e <= tier.max) return tier;
  }
  return ELO_TIERS[ELO_TIERS.length - 1];
}

function getRarityRange(rarityMin, rarityMax) {
  const minIdx = Math.max(0, RARITIES.indexOf(String(rarityMin || 'common')));
  const maxIdxRaw = RARITIES.indexOf(String(rarityMax || 'mythic'));
  const maxIdx = Math.max(minIdx, maxIdxRaw >= 0 ? maxIdxRaw : RARITIES.length - 1);
  return RARITIES.slice(minIdx, maxIdx + 1);
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

function shuffle(array) {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** True si l'unité DB est considérée comme CAC (même règle que la composition d'équipe joueur). */
function isMeleeRow(row) {
  return (row?.attack_type || '').toLowerCase() === 'melee';
}

/** Compte CAC vs Distance dans une liste d'unités (rows). */
function countAttackTypes(rows) {
  let cac = 0;
  let ranged = 0;
  for (const r of rows) {
    if (isMeleeRow(r)) cac++;
    else ranged++;
  }
  return { cac, ranged };
}

/** Vérifie que l'équipe respecte max 5 CAC et max 5 Distance. */
function isValidTeamComposition(rows) {
  const { cac, ranged } = countAttackTypes(rows);
  return cac <= 5 && ranged <= 5;
}

import { applySpecModifier } from './battleTeamService.js';

/**
 * @param {'front'|'back'} battlePosition - Ligne combat : CAC uniquement devant, distance uniquement derrière.
 */
function buildCombatUnitFromRowSync(unitRow, level, specialization, index, battlePosition) {
  const skillData = parseJson(unitRow.skill_data);
  let finalSkillData = skillData;
  if (specialization != null && String(specialization).trim() !== '') {
    const spec = String(specialization).toUpperCase() === 'B'
      ? parseJson(unitRow.specB_skill_modifier)
      : parseJson(unitRow.specA_skill_modifier);
    if (spec && typeof spec === 'object') {
      try {
        finalSkillData = applySpecModifier(skillData, spec) || skillData;
      } catch (_) {}
    }
  }
  const pos = battlePosition === 'back' ? 'back' : 'front';
  const unit = {
    id: `npc-${index}`,
    user_unit_id: `npc-${index}`,
    position: pos,
    rangeType: isMeleeRow(unitRow) ? 'melee' : 'ranged',
    name: unitRow.name,
    code: unitRow.code,
    rarity: unitRow.rarity,
    element: unitRow.element,
    archetype: unitRow.archetype,
    image_url: unitRow.image_url ?? null,
    role: unitRow.role,
    base_hp: unitRow.base_hp,
    base_attack: unitRow.base_attack,
    base_defense: unitRow.base_defense,
    base_speed: unitRow.base_speed,
    mastery: unitRow.mastery ?? 0,
    level: level ?? 1,
    /** Pas de système de puissance joueur pour les PNJ (évite tout héritage erroné). */
    power_level: 1,
    specialization: specialization ?? null,
    fatigue: 0,
    traits: parseJson(unitRow.traits),
    skill_data: finalSkillData,
    skillData: finalSkillData,
    basic_targeting: 'NO_FOCUS',
    skill_targeting: 'NO_FOCUS',
    /** Les PNJ n’ont jamais d’artefacts joueur (buildTeamFromDb n’est pas utilisé ici). */
    equipped_artifacts: []
  };
  const userUnit = { level: unit.level, specialization: unit.specialization };
  const stats = computeScaledStats(unit, userUnit);
  unit.maxHp = stats.maxHp;
  unit.attack = stats.attack;
  unit.defense = stats.defense;
  unit.speed = stats.speed;
  unit.mastery = stats.mastery;
  return unit;
}

/**
 * Simule un bonus d'artefacts agrégé sur toutes les stats.
 * Le score provient de la grille de difficulté PNJ PvP.
 * Aligné sur les artefacts joueurs : maxHp = 50 + level*50 par artefact (≈2 par point de score).
 */
/**
 * Simule un léger bonus de stats type « difficulté » (pas des artefacts réels).
 * Au max (score 200) : +400 PV, +200 ATK/DEF, etc. — insuffisant pour expliquer des centaines de milliers de PV.
 */
function applyNpcArtifactBonus(unit, artifactBonusScore) {
  const score = Math.max(0, Number(artifactBonusScore) || 0);
  if (!score) return;
  unit.attack = Math.max(1, Math.round((unit.attack ?? 0) + score));
  unit.defense = Math.max(1, Math.round((unit.defense ?? 0) + score));
  unit.speed = Math.max(1, Math.round((unit.speed ?? 0) + score * 0.5));
  unit.mastery = Math.max(0, Math.round((unit.mastery ?? 0) + score * 0.75));
  unit.maxHp = Math.max(1, Math.round((unit.maxHp ?? 0) + score * 2));
}

/** PV max plausibles pour un PNJ PvP après scaling (alerte logs si dépassé — bug ou données corrompues). */
const WARN_NPC_MAX_HP = 25000;

function warnIfAbnormalNpcStats(unit, context) {
  const maxHp = Number(unit?.maxHp);
  if (!Number.isFinite(maxHp) || maxHp <= WARN_NPC_MAX_HP) return;
  console.warn('[pvpNpc] PV PNJ anormalement élevés (pas causés par les artefacts simulés)', {
    code: unit?.code,
    name: unit?.name,
    maxHp,
    base_hp: unit?.base_hp,
    level: unit?.level,
    ...context
  });
}

/** Codes d'unités qui sont des boss de chapitre (campagne). À exclure des équipes PNJ PvP. */
async function getBossUnitCodes() {
  const rows = await query(
    'SELECT DISTINCT boss_unit_code FROM campaign_stages WHERE boss_unit_code IS NOT NULL AND boss_unit_code != ""'
  );
  return rows.map((r) => r.boss_unit_code);
}

/**
 * Génère une équipe PNJ de 6 unités pour le PvP.
 * Pas de doublon d'unité, max 5 CAC / 5 Distance. Exclut les boss de chapitre campagne.
 * @param {number} elo
 * @returns {Promise<Array>} unités prêtes pour simulateBattle (side B)
 */
export async function generateNpcDefense(elo) {
  const tier = getTierForElo(elo);
  const rarities = getRarityRange(tier.rarityMin, tier.rarityMax);
  const bossCodes = await getBossUnitCodes();
  const excludeBossClause = bossCodes.length > 0
    ? ` AND code NOT IN (${bossCodes.map(() => '?').join(',')})`
    : '';
  const placeholders = rarities.map(() => '?').join(',');
  const params = [...rarities, ...bossCodes];
  const rows = await query(
    `SELECT id, code, name, rarity, role, attack_type, element, archetype,
            base_hp, base_attack, base_defense, base_speed, mastery, traits, skill_data, image_url,
            specA_bonus_stat, specB_bonus_stat, specA_skill_modifier, specB_skill_modifier, specA_passive, specB_passive
     FROM units WHERE COALESCE(is_boss, 0) = 0 AND rarity IN (${placeholders})${excludeBossClause} ORDER BY RAND()`,
    params
  );
  if (!rows || rows.length < 6) {
    const fallbackParams = bossCodes.length > 0 ? [...bossCodes] : [];
    const fallback = await query(
      `SELECT id, code, name, rarity, role, attack_type, element, archetype,
              base_hp, base_attack, base_defense, base_speed, mastery, traits, skill_data, image_url,
              specA_bonus_stat, specB_bonus_stat, specA_skill_modifier, specB_skill_modifier, specA_passive, specB_passive
       FROM units WHERE COALESCE(is_boss, 0) = 0${excludeBossClause} ORDER BY RAND() LIMIT 20`,
      fallbackParams
    );
    if (!fallback || fallback.length === 0) return [];
    return buildNpcTeamFromPool(fallback, tier, Math.min(6, fallback.length));
  }
  return buildNpcTeamFromPool(rows, tier, 6);
}

function buildNpcTeamFromPool(pool, tier, targetSize = 6) {
  const desiredSize = Math.max(1, Math.min(Number(targetSize) || 0, pool.length));
  if (!desiredSize) return [];
  const maxAttempts = 50;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const shuffled = shuffle(pool);
    const selected = [];
    const seenIds = new Set();
    for (const row of shuffled) {
      if (selected.length >= desiredSize) break;
      const id = row.id;
      if (seenIds.has(id)) continue;
      selected.push(row);
      seenIds.add(id);
    }
    if (selected.length < desiredSize) continue;
    if (!isValidTeamComposition(selected)) continue;

    const specCount = Math.min(tier.specCount || 0, desiredSize);
    const specIndices = new Set();
    while (specIndices.size < specCount) {
      specIndices.add(Math.floor(Math.random() * desiredSize));
    }
    const melees = selected.filter((r) => isMeleeRow(r));
    const rangeds = selected.filter((r) => !isMeleeRow(r));
    const orderedRows = [...melees, ...rangeds];

    const team = [];
    for (let i = 0; i < desiredSize; i++) {
      const row = orderedRows[i];
      const battlePosition = isMeleeRow(row) ? 'front' : 'back';
      const spec = specIndices.has(i) ? (Math.random() < 0.5 ? 'A' : 'B') : null;
      const unit = buildCombatUnitFromRowSync(row, tier.level, spec, i, battlePosition);
      applyNpcArtifactBonus(unit, tier.artifactBonus);
      unit.equipped_artifacts = [];
      warnIfAbnormalNpcStats(unit, { eloTier: `${tier.min}-${tier.max}`, artifactBonus: tier.artifactBonus });
      team.push(unit);
    }
    return team;
  }
  return [];
}
