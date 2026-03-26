/**
 * Règles d’identité par rôle pour les unités custom (budget de points).
 * Catégories logiques : DAMAGE, HEAL, BUFF, DEBUFF, CONTROL.
 */

import { normalizeSkillEffectEntries } from '../services/customUnitEffectEntry.js';
import {
  pickDefaultTargetForEffect,
  sanitizeModifiersForEffect,
  validateTargetForEffect
} from './customUnitTargetRules.js';

export const RULE_CATEGORY = {
  DAMAGE: 'DAMAGE',
  HEAL: 'HEAL',
  BUFF: 'BUFF',
  DEBUFF: 'DEBUFF',
  CONTROL: 'CONTROL',
  OTHER: 'OTHER'
};

const DAMAGE_IDS = new Set([
  'DAMAGE',
  'DAMAGE_HP_CASTER',
  'DAMAGE_HP_TARGET',
  'DOT',
  'STEAL_STAT'
]);

export const HEAL_IDS = new Set(['HEAL', 'RESURRECT', 'REGEN']);

const BUFF_IDS = new Set([
  'ATK_UP',
  'DEF_UP',
  'SPEED',
  'SHIELD',
  'IMMUNITY',
  'INVINCIBILITY',
  'CLEANSE_ONE',
  'CLEANSE_ALL',
  'DEFEND',
  /** Réduction de CD : cible alliée / soi — traité comme soutien, pas comme contrôle adverse. */
  'CD_DOWN_1',
  'CD_DOWN_2'
]);

const CONTROL_IDS = new Set([
  'STUN',
  'PROVOKE',
  'SILENCE',
  'BLIND',
  'SLOW',
  'ATB_UP_50',
  'ATB_UP_100',
  'REDUCE_ATB_50',
  'REDUCE_ATB_100',
  'RESET_SKILL_CD',
  'SET_SKILL_CD_MAX',
  'CD_UP_1',
  'CD_UP_2'
]);

const DEBUFF_IDS = new Set([
  'STRIP_ONE',
  'STRIP_ALL',
  'ATK_DOWN',
  'DEF_DOWN',
  'ANTI_SHIELD',
  'ANTI_HEAL',
  'ANTI_BUFF'
]);

/**
 * @param {string} effectId
 */
export function getEffectRuleCategory(effectId) {
  const id = String(effectId || '')
    .trim()
    .toUpperCase();
  if (!id) return RULE_CATEGORY.OTHER;
  if (DAMAGE_IDS.has(id)) return RULE_CATEGORY.DAMAGE;
  if (HEAL_IDS.has(id)) return RULE_CATEGORY.HEAL;
  if (BUFF_IDS.has(id)) return RULE_CATEGORY.BUFF;
  if (CONTROL_IDS.has(id)) return RULE_CATEGORY.CONTROL;
  if (DEBUFF_IDS.has(id)) return RULE_CATEGORY.DEBUFF;
  return RULE_CATEGORY.OTHER;
}

export const ROLE_EFFECT_POLICY = {
  dps: {
    allowed: [RULE_CATEGORY.DAMAGE, RULE_CATEGORY.BUFF, RULE_CATEGORY.DEBUFF]
  },
  assassin: {
    allowed: [RULE_CATEGORY.DAMAGE, RULE_CATEGORY.DEBUFF, RULE_CATEGORY.HEAL],
    constraints: { healTarget: 'SELF_ONLY', forbidResurrect: true }
  },
  tank: {
    allowed: [RULE_CATEGORY.HEAL, RULE_CATEGORY.BUFF, RULE_CATEGORY.DEBUFF, RULE_CATEGORY.CONTROL, RULE_CATEGORY.DAMAGE],
    constraints: { damageStyle: 'LOW_ONLY' }
  },
  support: {
    allowed: [RULE_CATEGORY.HEAL, RULE_CATEGORY.BUFF, RULE_CATEGORY.DEBUFF, RULE_CATEGORY.CONTROL]
  }
};

const MSG = {
  notAllowed: 'Effet non autorisé pour ce rôle.',
  dpsHealControl: 'Le DPS ne peut pas utiliser de soin ni d’effets de contrôle (stun, ATB, etc.).',
  supportDamage: 'Le Support ne peut pas utiliser de dégâts.',
  tankPercentDamage: 'Les Tanks ne peuvent pas utiliser des dégâts % PV (ni DOT / vol de stats).',
  tankOnlySimpleDamage: 'Les Tanks ne peuvent utiliser que des dégâts directs simples (DAMAGE).',
  assassinHealSelf: 'Le soin des Assassins doit cibler soi-même uniquement (SELF).',
  assassinNoResurrect: 'Les Assassins ne peuvent pas utiliser la résurrection.',
  other: 'Effet non classé : non autorisé pour ce rôle.'
};

function normalizeRole(role) {
  return String(role || '').toLowerCase();
}

/**
 * @param {object} skill
 * @param {string} effectId
 * @param {string} role
 * @param {string} [effectTarget] — cible de cette ligne d’effet (prioritaire sur skill.target)
 * @returns {string[]}
 */
export function validateEffectForRole(skill, effectId, role, effectTarget) {
  const errors = [];
  const r = normalizeRole(role);
  const policy = ROLE_EFFECT_POLICY[r];
  if (!policy) return errors;

  const id = String(effectId || '')
    .trim()
    .toUpperCase();
  if (!id) return errors;

  const cat = getEffectRuleCategory(id);
  const target = String(effectTarget ?? skill?.target ?? '')
    .trim()
    .toUpperCase();

  if (cat === RULE_CATEGORY.OTHER) {
    errors.push(MSG.other);
    return errors;
  }

  /** Assassin : seuls CD_DOWN_1/2 parmi les buffs (réduction de CD alliée / soi). */
  if (r === 'assassin' && (id === 'CD_DOWN_1' || id === 'CD_DOWN_2')) {
    for (const msg of validateTargetForEffect(id, target)) {
      errors.push(msg);
    }
    return errors;
  }

  const allowed = policy.allowed;
  if (allowed && !allowed.includes(cat)) {
    if (r === 'dps' && (cat === RULE_CATEGORY.HEAL || cat === RULE_CATEGORY.CONTROL)) {
      errors.push(MSG.dpsHealControl);
    } else if (r === 'support' && cat === RULE_CATEGORY.DAMAGE) {
      errors.push(MSG.supportDamage);
    } else {
      errors.push(MSG.notAllowed);
    }
    return errors;
  }

  if (r === 'tank' && cat === RULE_CATEGORY.DAMAGE) {
    if (id === 'DAMAGE_HP_TARGET' || id === 'DAMAGE_HP_CASTER') {
      errors.push(MSG.tankPercentDamage);
      return errors;
    }
    if (id === 'DOT' || id === 'STEAL_STAT') {
      errors.push(MSG.tankPercentDamage);
      return errors;
    }
    if (id !== 'DAMAGE') {
      errors.push(MSG.tankOnlySimpleDamage);
      return errors;
    }
  }

  if (r === 'assassin') {
    if (id === 'RESURRECT') {
      errors.push(MSG.assassinNoResurrect);
      return errors;
    }
    if (HEAL_IDS.has(id) && id !== 'RESURRECT' && target !== 'SELF') {
      errors.push(MSG.assassinHealSelf);
      return errors;
    }
  }

  for (const msg of validateTargetForEffect(id, target)) {
    errors.push(msg);
  }
  return errors;
}

/**
 * @param {object} config — { skill1, skill2 }
 * @param {string} role
 * @returns {string[]}
 */
export function validateRoleEffectRules(config, role) {
  const errors = [];
  const r = normalizeRole(role);
  if (!ROLE_EFFECT_POLICY[r]) return errors;

  const wantS2 = config?.hasSkill2 !== false;
  const skills = [
    { label: 'Compétence 1', skill: config?.skill1 },
    ...(wantS2 ? [{ label: 'Compétence 2', skill: config?.skill2 }] : [])
  ];

  for (const { label, skill } of skills) {
    if (!skill || typeof skill !== 'object') continue;
    const rows = normalizeSkillEffectEntries(skill, 'ENEMY_SINGLE');
    for (const row of rows) {
      const errs = validateEffectForRole(skill, row.id, role, row.target);
      for (const msg of errs) {
        errors.push(`${label} : ${msg}`);
      }
    }
  }

  return errors;
}

/**
 * Corrige la cible (Assassin soins) puis retire les effets toujours invalides.
 * @param {object} config
 * @param {string} role
 * @returns {object}
 */
export function sanitizeCustomUnitConfigForRole(config, role) {
  const out = JSON.parse(JSON.stringify(config || {}));
  const r = normalizeRole(role);
  out.hasSkill2 = out.hasSkill2 !== false;

  for (const key of ['skill1', 'skill2']) {
    const sk = out[key];
    if (!sk || !Array.isArray(sk.effects)) continue;

    const rows = normalizeSkillEffectEntries(sk, 'ENEMY_SINGLE');
    const kept = [];
    for (const row of rows) {
      let t = String(row.target || '')
        .trim()
        .toUpperCase();
      if (validateTargetForEffect(row.id, t).length) {
        t = pickDefaultTargetForEffect(row.id);
      }
      if (r === 'assassin' && HEAL_IDS.has(row.id) && row.id !== 'RESURRECT') {
        t = 'SELF';
      }
      const mods = sanitizeModifiersForEffect(row.id, row.modifiers || [], t);
      if (validateEffectForRole(sk, row.id, r, t).length === 0) {
        kept.push({ id: row.id, target: t, modifiers: mods });
      }
    }
    sk.effects = kept;
    if (sk.modifiers) delete sk.modifiers;
    const cm = Number(sk.cooldownModifier ?? 0);
    sk.cooldownModifier = cm === -1 ? -1 : 0;

    if (key === 'skill2') {
      sk.type = 'ACTIVE';
      delete sk.passiveTrigger;
      while (sk.effects.length < 3) {
        sk.effects.push({ id: '', target: 'ENEMY_SINGLE', modifiers: [] });
      }
      sk.effects = sk.effects.slice(0, 3);
    }
  }

  return out;
}
