/**
 * Score de cohérence kit / rôle (heuristique, ajustable).
 */
import { normalizeRoleKey } from './roleStatWeights.js';
import { classifyEffectCategory } from './skillEffectValuation.js';

function effectCategories(skill) {
  const effs = skill?.effects || [];
  const set = new Set();
  for (const e of effs) {
    set.add(classifyEffectCategory(e));
  }
  return set;
}

/**
 * @param {object|null} skill1
 * @param {object|null} skill2
 * @param {string} role
 * @param {number} statsScore
 * @returns {number} score ~0–35
 */
export function computeKitSynergyScore(skill1, skill2, role, statsScore) {
  const r = normalizeRoleKey(role);
  const c1 = effectCategories(skill1);
  const c2 = effectCategories(skill2);
  const all = new Set([...c1, ...c2]);

  let bonus = 0;

  if (r === 'tank') {
    if (all.has('sustain') && (all.has('control') || all.has('utility'))) bonus += 12;
    if (c1.has('control') && c2.has('sustain')) bonus += 8;
  } else if (r === 'dps') {
    if (all.has('damage') && all.has('tempo')) bonus += 14;
    if (c1.has('damage') && c2.has('damage')) bonus += 6;
  } else if (r === 'support') {
    if (all.has('sustain') && (all.has('tempo') || all.has('utility'))) bonus += 14;
    if (all.has('control') && all.has('sustain')) bonus += 8;
  } else if (r === 'assassin') {
    if (all.has('damage') && all.has('control')) bonus += 12;
    if (c1.has('damage') && c2.has('damage')) bonus += 5;
  }

  if (statsScore > 55 && all.has('damage')) bonus += 4;
  if (statsScore > 55 && (all.has('sustain') || all.has('utility'))) bonus += 3;

  return Math.min(35, bonus);
}
