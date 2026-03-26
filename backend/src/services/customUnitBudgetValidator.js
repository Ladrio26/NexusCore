import { ROLE_POINT_BUDGET, SECOND_SKILL_COST } from '../data/customUnitPointCosts.js';
import { computeSkillCost } from './customUnitPointCalculator.js';
import { findCustomUnitIncompatibilities } from './customUnitIncompatibilities.js';
import { validateRoleEffectRules } from '../data/customUnitRoleRules.js';
import { isSkill2Enabled } from './customUnitConfigMapper.js';
import { validateSpecializationConfig } from '../data/customUnitSpecializationConfig.js';

/**
 * @param {object} config — { role, element, skill1, skill2 }
 */
export function validateCustomUnitBudget(config) {
  const errors = [];
  const role = String(config?.role || '').toLowerCase();
  const maxBudget = ROLE_POINT_BUDGET[role];
  if (maxBudget == null) {
    return {
      isValid: false,
      totalCost: 0,
      maxBudget: 0,
      remainingPoints: 0,
      skill1Cost: null,
      skill2Cost: null,
      errors: [`Rôle invalide : ${config?.role}`]
    };
  }

  errors.push(...findCustomUnitIncompatibilities(config));
  errors.push(...validateRoleEffectRules(config, role));
  errors.push(...validateSpecializationConfig(config));

  const skill1 = config.skill1 || {};
  const wantS2 = isSkill2Enabled(config);
  const skill2 = wantS2 ? config.skill2 || {} : {};
  /** La compétence II n’est plus configurable en passif. */
  const s2Passive = false;

  const c1 = computeSkillCost(skill1, { isPassive: false });
  const c2 = wantS2 ? computeSkillCost(skill2, { isPassive: s2Passive }) : { totalCost: 0, breakdown: [] };

  const totalCost = c1.totalCost + c2.totalCost + (wantS2 ? SECOND_SKILL_COST : 0);
  const remainingPoints = maxBudget - totalCost;

  if (totalCost > maxBudget) {
    errors.push(`Budget dépassé : ${totalCost}/${maxBudget} points.`);
  }

  return {
    isValid: errors.length === 0,
    totalCost,
    maxBudget,
    remainingPoints,
    skill1Cost: c1,
    skill2Cost: c2,
    secondSkillFlat: SECOND_SKILL_COST,
    errors
  };
}
