/** @typedef {'tank'|'dps'|'support'|'assassin'} NormalizedRole */

import { REF_STAT_MAX } from './coefficients.js';

/**
 * Mappe les rôles DB vers une famille de pondération (ranged = DPS).
 * @param {string} role
 * @returns {NormalizedRole}
 */
export function normalizeRoleKey(role) {
  const r = String(role || '').toLowerCase();
  if (r === 'ranged') return 'dps';
  if (r === 'tank') return 'tank';
  if (r === 'support') return 'support';
  if (r === 'assassin') return 'assassin';
  return 'dps';
}

/**
 * Pondérations par rôle (somme = 1).
 */
export const ROLE_STAT_WEIGHTS = {
  tank: { hp: 0.35, attack: 0.08, defense: 0.32, speed: 0.1, mastery: 0.15 },
  dps: { hp: 0.12, attack: 0.38, defense: 0.12, speed: 0.28, mastery: 0.1 },
  support: { hp: 0.15, attack: 0.08, defense: 0.12, speed: 0.28, mastery: 0.37 },
  assassin: { hp: 0.14, attack: 0.32, defense: 0.2, speed: 0.26, mastery: 0.08 }
};

/**
 * @param {object} unit — base_hp, base_attack, base_defense, base_speed, mastery
 * @param {string} role
 * @returns {number} score stats normalisé (échelle ~0–100+)
 */
export function computeStatsScore(unit, role) {
  const nr = normalizeRoleKey(role);
  const w = ROLE_STAT_WEIGHTS[nr] || ROLE_STAT_WEIGHTS.dps;
  const hp = Number(unit.base_hp ?? unit.baseHp ?? 0);
  const atk = Number(unit.base_attack ?? unit.baseAttack ?? 0);
  const def = Number(unit.base_defense ?? unit.baseDefense ?? 0);
  const spd = Number(unit.base_speed ?? unit.baseSpeed ?? 0);
  const mast = Number(unit.mastery ?? 0);

  const n = {
    hp: hp / REF_STAT_MAX.hp,
    attack: atk / REF_STAT_MAX.attack,
    defense: def / REF_STAT_MAX.defense,
    speed: spd / REF_STAT_MAX.speed,
    mastery: mast / REF_STAT_MAX.mastery
  };

  let s = 0;
  for (const k of Object.keys(w)) {
    s += w[k] * Math.min(1.2, n[k]);
  }
  return s * 100;
}
