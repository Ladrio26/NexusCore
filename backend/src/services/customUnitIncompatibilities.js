import { normalizeSkillEffectEntries } from './customUnitEffectEntry.js';

function wantSkill2(config) {
  return config?.hasSkill2 !== false;
}

function ids(skill) {
  const rows = normalizeSkillEffectEntries(skill, 'ENEMY_SINGLE');
  return rows.map((r) => r.id).filter(Boolean);
}

function duplicateEffectError(skill, label) {
  const rows = normalizeSkillEffectEntries(skill, 'ENEMY_SINGLE');
  const seen = new Set();
  for (const r of rows) {
    if (!r.id) continue;
    if (seen.has(r.id)) return `${label} : l’effet ${r.id} est utilisé plusieurs fois.`;
    seen.add(r.id);
  }
  return null;
}

function bigAoeTarget(t) {
  const u = String(t || '').toUpperCase();
  return u === 'TEAM_ENEMY' || u === 'TEAM_ALLY' || u === 'TEAM';
}

/**
 * @param {object} config — customUnitConfig
 * @returns {string[]} messages d’erreur
 */
export function findCustomUnitIncompatibilities(config) {
  const errors = [];
  if (!config || typeof config !== 'object') return errors;

  const s1 = config.skill1 || {};
  const s2 = config.skill2 || {};
  const dup1 = duplicateEffectError(s1, 'Compétence 1');
  if (dup1) errors.push(dup1);
  if (wantSkill2(config)) {
    const dup2 = duplicateEffectError(s2, 'Compétence 2');
    if (dup2) errors.push(dup2);
  }

  const e1 = ids(s1);
  const e2 = wantSkill2(config) ? ids(s2) : [];

  const all = [...e1, ...e2];

  if (e1.includes('DAMAGE_HP_TARGET') && all.includes('LIFESTEAL')) {
    errors.push('DAMAGE_HP_TARGET et LIFESTEAL ne peuvent pas être combinés.');
  }
  if (e1.includes('RESURRECT') && e1.includes('INVINCIBILITY')) {
    errors.push('RESURRECT et INVINCIBILITY ne peuvent pas être sur la même compétence.');
  }
  if (wantSkill2(config) && e2.includes('RESURRECT') && e2.includes('INVINCIBILITY')) {
    errors.push('RESURRECT et INVINCIBILITY ne peuvent pas être sur la même compétence.');
  }

  const n1 = normalizeSkillEffectEntries(s1, 'ENEMY_SINGLE');
  const hasReset = e1.includes('RESET_SKILL_CD');
  const hasBigAoeDamage = n1.some((row) => row.id === 'DAMAGE' && bigAoeTarget(row.target));

  if (hasReset && hasBigAoeDamage) {
    errors.push('RESET_SKILL_CD n’est pas autorisé avec des dégâts de zone sur la même compétence.');
  }

  const atbUp = (arr) =>
    arr.some((x) => x === 'ATB_UP_50' || x === 'ATB_UP_100');
  const atbDown = (arr) => arr.some((x) => x === 'REDUCE_ATB_50' || x === 'REDUCE_ATB_100');

  if (atbUp(e1) && atbDown(e1)) {
    errors.push('ATB_UP et REDUCE_ATB ne peuvent pas coexister sur la compétence 1.');
  }
  if (wantSkill2(config) && atbUp(e2) && atbDown(e2)) {
    errors.push('ATB_UP et REDUCE_ATB ne peuvent pas coexister sur la compétence 2.');
  }

  return errors;
}
