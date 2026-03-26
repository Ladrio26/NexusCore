import {
  EFFECT_BASE_COSTS,
  MODIFIER_COSTS,
  TARGET_COST_MULTIPLIER_BY_TARGET,
  RECHARGE_RAPIDE_BUDGET_COST,
  PASSIVE_MULTIPLIER_NORMAL,
  PASSIVE_MULTIPLIER_CRITICAL,
  PASSIVE_CRITICAL_EFFECT_IDS
} from '../data/customUnitPointCosts.js';
import { normalizeSkillEffectEntries } from './customUnitEffectEntry.js';

function targetMultiplierForRow(target) {
  const u = String(target || '')
    .toUpperCase()
    .trim();
  const m = TARGET_COST_MULTIPLIER_BY_TARGET[u];
  return Number.isFinite(m) ? m : 1;
}

/**
 * @param {object} skillConfig
 * @param {{ isPassive?: boolean }} opts
 * @returns {{ totalCost: number, breakdown: Array<{ key: string, cost: number, note?: string }> }}
 */
export function computeSkillCost(skillConfig, opts = {}) {
  const isPassive = opts.isPassive === true;
  const breakdown = [];

  const entries = normalizeSkillEffectEntries(skillConfig, 'ENEMY_SINGLE');

  let sum = 0;
  for (let i = 0; i < entries.length; i++) {
    const row = entries[i];
    const id = row.id;
    let line = Number(EFFECT_BASE_COSTS[id]);
    if (!Number.isFinite(line)) line = 0;
    breakdown.push({
      key: `effect:${id}@${i}`,
      cost: line,
      note: EFFECT_BASE_COSTS[id] == null ? 'unknown' : undefined
    });

    for (const m of row.modifiers || []) {
      const mid = String(m || '').toUpperCase();
      const mc = Number(MODIFIER_COSTS[mid]);
      const add = Number.isFinite(mc) ? mc : 0;
      line += add;
      breakdown.push({
        key: `modifier:${mid}@${i}`,
        cost: add,
        note: MODIFIER_COSTS[mid] == null ? 'unknown' : undefined
      });
    }

    const mult = targetMultiplierForRow(row.target);
    const beforeT = line;
    line = Math.ceil(line * mult);
    sum += line;
    if (mult !== 1) {
      breakdown.push({
        key: `target:${String(row.target).toUpperCase()}@${i}`,
        cost: line - beforeT,
        note: `×${mult}`
      });
    }
  }

  const cm = Number(skillConfig?.cooldownModifier ?? 0);
  if (cm === -1) {
    sum += RECHARGE_RAPIDE_BUDGET_COST;
    breakdown.push({
      key: 'recharge:rapide',
      cost: RECHARGE_RAPIDE_BUDGET_COST,
      note: 'Recharge rapide'
    });
  }

  if (isPassive) {
    const crit = entries.some((e) => e.id && PASSIVE_CRITICAL_EFFECT_IDS.has(e.id));
    const pm = crit ? PASSIVE_MULTIPLIER_CRITICAL : PASSIVE_MULTIPLIER_NORMAL;
    const beforeP = sum;
    sum = Math.ceil(sum * pm);
    breakdown.push({
      key: `passive:×${pm}`,
      cost: sum - beforeP,
      note: crit ? 'critical' : 'normal'
    });
  }

  return { totalCost: Math.max(0, sum), breakdown };
}
