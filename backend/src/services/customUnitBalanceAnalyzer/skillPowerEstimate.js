import { valuateEffect } from './skillEffectValuation.js';
import { CD_PRESSURE } from './coefficients.js';

function getCooldown(skill) {
  if (!skill) return 3;
  const t = String(skill.type || '').toUpperCase();
  if (t === 'PASSIVE') {
    const c = skill.cooldown ?? skill.cd_actions;
    if (c != null && Number(c) > 0) return Number(c);
    return 0;
  }
  const cd = skill.cd_actions ?? skill.cooldown ?? skill.cooldown_actions;
  return Math.max(1, Number(cd) || 3);
}

function targetingScopeScore(effects) {
  if (!Array.isArray(effects) || effects.length === 0) return 1;
  let maxT = 1;
  for (const e of effects) {
    const k = String(e.target || '').toUpperCase();
    if (k === 'TEAM_ENEMY' || k === 'TEAM_ALLY') maxT = Math.max(maxT, 1.45);
    else if (k === 'ENEMY_SINGLE' || k === 'ALLY_SINGLE') maxT = Math.max(maxT, 1.08);
  }
  return Math.min(1.75, maxT);
}

/**
 * @param {object|null} skill — ACTIVE ou PASSIVE avec effects[]
 * @param {object} ctx — { role, skillSlot }
 * @returns {{ score: number, breakdown: object }}
 */
export function estimateSkillPower(skill, ctx = {}) {
  if (!skill || typeof skill !== 'object') {
    return { score: 0, breakdown: { rawEffects: 0, cd: 0, cdEff: 0, scope: 1 } };
  }
  const effects = Array.isArray(skill.effects) ? skill.effects : [];
  let raw = 0;
  for (const eff of effects) {
    raw += valuateEffect(eff, { ...ctx, skillSlot: ctx.skillSlot ?? 1 });
  }
  const cd = getCooldown(skill);
  const isPassive = String(skill.type || '').toUpperCase() === 'PASSIVE';
  const cdEff = isPassive && cd <= 0 ? 0.88 : 1 / (1 + CD_PRESSURE * Math.max(0, cd - 1));
  const scope = targetingScopeScore(effects);
  const scopeMult = 0.72 + 0.28 * scope;
  const score = raw * cdEff * scopeMult;
  return {
    score,
    breakdown: { rawEffects: raw, cd, cdEff, scope, scopeMult }
  };
}
