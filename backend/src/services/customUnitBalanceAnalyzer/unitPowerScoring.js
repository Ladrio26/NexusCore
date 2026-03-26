/**
 * Score de puissance agrégé pour une unité roster ou un build custom.
 */
import { computeStatsScore, normalizeRoleKey } from './roleStatWeights.js';
import { estimateSkillPower } from './skillPowerEstimate.js';
import { computeKitSynergyScore } from './kitSynergyScoring.js';
import { UNIT_SCORE_WEIGHTS } from './coefficients.js';
import { classifyEffectCategory } from './skillEffectValuation.js';
import { buildCustomSkillData, buildStatPreview } from '../customUnitSkillFactory.js';
import { computePowerBudget } from '../customUnitPowerBudget.js';

function parseSkillData(raw) {
  if (raw == null) return null;
  if (typeof raw === 'object') return raw;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Extrait actifs / passifs depuis skill_data (formats legacy + skills[]).
 * @param {object|null} skillData
 */
export function extractSkillsFromSkillData(skillData) {
  if (!skillData || typeof skillData !== 'object') {
    return { actives: [], passives: [], rawList: [] };
  }
  let list = [];
  if (Array.isArray(skillData.skills)) {
    list = skillData.skills;
  } else if (skillData.skill != null) {
    const s = skillData.skill;
    list = Array.isArray(s) ? [...s] : [s];
  } else if (Array.isArray(skillData.effects)) {
    list = [{ ...skillData, type: 'ACTIVE', priority: 1, name: skillData.name || 'Skill' }];
  }
  const actives = list
    .filter((s) => s && String(s.type || '').toUpperCase() === 'ACTIVE')
    .sort((a, b) => Number(a.priority) - Number(b.priority));
  const passives = list.filter((s) => s && String(s.type || '').toUpperCase() === 'PASSIVE');
  return { actives, passives, rawList: list };
}

export function pickSkill1Skill2(actives, passives) {
  const skill1 = actives[0] || null;
  const skill2 = actives[1] || passives[0] || null;
  return { skill1, skill2 };
}

function collectTags(skill1, skill2) {
  const tags = new Set();
  for (const sk of [skill1, skill2]) {
    if (!sk?.effects) continue;
    for (const e of sk.effects) {
      tags.add(classifyEffectCategory(e));
    }
  }
  return [...tags].filter((t) => t !== 'unknown');
}

/**
 * @param {object} unit — id, name, rarity, role, attack_type, base_*, mastery, skill_data
 * @returns {object}
 */
export function computeUnitPowerScore(unit) {
  const role = unit.role || 'ranged';
  const skillData = parseSkillData(unit.skill_data);
  const { actives, passives } = extractSkillsFromSkillData(skillData);
  const { skill1, skill2 } = pickSkill1Skill2(actives, passives);

  const statsScore = computeStatsScore(unit, role);
  const s1 = estimateSkillPower(skill1, { role, skillSlot: 1 });
  const s2 = estimateSkillPower(skill2, { role, skillSlot: 2 });
  const syn = computeKitSynergyScore(skill1, skill2, role, statsScore);

  const finalScore =
    statsScore * UNIT_SCORE_WEIGHTS.stats +
    s1.score * UNIT_SCORE_WEIGHTS.skill1 +
    s2.score * UNIT_SCORE_WEIGHTS.skill2 +
    syn * UNIT_SCORE_WEIGHTS.synergy;

  return {
    unitId: unit.id ?? null,
    name: unit.name ?? '',
    rarity: unit.rarity ?? 'common',
    role,
    attackType: unit.attack_type ?? unit.attackType ?? 'melee',
    statsScore,
    skill1Score: s1.score,
    skill2Score: s2.score,
    kitSynergyScore: syn,
    finalScore,
    tags: collectTags(skill1, skill2),
    _breakdown: {
      skill1: s1.breakdown,
      skill2: s2.breakdown
    }
  };
}

/**
 * Segment pour benchmarks : rareté + rôle normalisé.
 */
export function benchmarkKey(unitLike) {
  const r = normalizeRoleKey(unitLike.role);
  const rarity = String(unitLike.rarity || 'common').toLowerCase();
  return `${rarity}::${r}`;
}

/**
 * Score d’un build custom (même pipeline que le roster, stats preview + skill_data généré).
 * @param {string} role
 * @param {string} element
 * @param {string[]} selectedKeys
 */
export function computeCustomBuildPowerScore(role, element, selectedKeys) {
  const stats = buildStatPreview(role, element, selectedKeys);
  const pb = computePowerBudget(selectedKeys);
  const sd = buildCustomSkillData(role, element, selectedKeys, pb);
  const fakeUnit = {
    id: null,
    name: 'CUSTOM_BUILD',
    rarity: 'epic',
    role,
    attack_type: stats.attack_type,
    base_hp: stats.hp,
    base_attack: stats.attack,
    base_defense: stats.defense,
    base_speed: stats.speed,
    mastery: stats.mastery,
    skill_data: { skills: sd.skills }
  };
  return computeUnitPowerScore(fakeUnit);
}
