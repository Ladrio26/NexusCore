/**
 * Règles par rôle — alignées sur backend/src/data/customUnitRoleRules.js
 */

import type { EffectSlot, SkillBlock, UnitConfig } from './effectSlotTypes';
import { migrateSkillEffects } from './customUnitConfigMigrate';
import {
  ALL_TARGETS_ORDERED,
  allowedTargetsForEffect,
  clampCooldownModifier,
  pickDefaultTargetForEffect,
  sanitizeModifiersForEffect,
  validateTargetForEffect
} from './customUnitTargeting';

export type SkillBlockLike = {
  target?: string;
  effects?: unknown[];
};

export const RULE_CATEGORY = {
  DAMAGE: 'DAMAGE',
  HEAL: 'HEAL',
  BUFF: 'BUFF',
  DEBUFF: 'DEBUFF',
  CONTROL: 'CONTROL',
  OTHER: 'OTHER'
} as const;

const DAMAGE_IDS = new Set([
  'DAMAGE',
  'DAMAGE_HP_CASTER',
  'DAMAGE_HP_TARGET',
  'DOT',
  'STEAL_STAT'
]);

const HEAL_IDS = new Set(['HEAL', 'RESURRECT', 'REGEN']);

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

export function getEffectRuleCategory(effectId: string): string {
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

const ROLE_ALLOWED: Record<string, string[]> = {
  dps: [RULE_CATEGORY.DAMAGE, RULE_CATEGORY.BUFF, RULE_CATEGORY.DEBUFF],
  assassin: [RULE_CATEGORY.DAMAGE, RULE_CATEGORY.DEBUFF, RULE_CATEGORY.HEAL],
  tank: [RULE_CATEGORY.HEAL, RULE_CATEGORY.BUFF, RULE_CATEGORY.DEBUFF, RULE_CATEGORY.CONTROL, RULE_CATEGORY.DAMAGE],
  support: [RULE_CATEGORY.HEAL, RULE_CATEGORY.BUFF, RULE_CATEGORY.DEBUFF, RULE_CATEGORY.CONTROL]
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

function normRole(role: string) {
  return String(role || '').toLowerCase();
}

export function validateEffectForRole(
  skill: SkillBlockLike,
  effectId: string,
  role: string,
  effectTarget?: string
): string[] {
  const errors: string[] = [];
  const r = normRole(role);
  const allowed = ROLE_ALLOWED[r];
  if (!allowed) return errors;

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

  if (r === 'assassin' && (id === 'CD_DOWN_1' || id === 'CD_DOWN_2')) {
    errors.push(...validateTargetForEffect(id, target));
    return errors;
  }

  if (!allowed.includes(cat)) {
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

  errors.push(...validateTargetForEffect(id, target));
  return errors;
}

export function roleRuleDisabledReason(
  skill: SkillBlockLike,
  effectId: string,
  role: string,
  effectTarget?: string
): string | null {
  const errs = validateEffectForRole(skill, effectId, role, effectTarget);
  return errs[0] ?? null;
}

/**
 * Cibles affichables pour une ligne (effet + rôle + règles de ciblage).
 * Empêche de choisir une cible invalide (ex. soin Assassin hors soi).
 */
export function allowedTargetsForEffectAndRole(
  effectId: string,
  role: string,
  skill: SkillBlockLike
): string[] {
  const id = String(effectId || '')
    .trim()
    .toUpperCase();
  if (!id) {
    return [...ALL_TARGETS_ORDERED];
  }
  const candidates = allowedTargetsForEffect(id);
  const ok = candidates.filter((t) => validateEffectForRole(skill, id, role, t).length === 0);
  if (ok.length) {
    return [...new Set(ok)].sort(
      (a, b) => ALL_TARGETS_ORDERED.indexOf(a) - ALL_TARGETS_ORDERED.indexOf(b)
    );
  }
  const fb = pickDefaultTargetForEffect(id);
  if (validateEffectForRole(skill, id, role, fb).length === 0) {
    return [fb];
  }
  return candidates.length ? [candidates[0]] : [fb];
}

export function sanitizeUnitConfigForRole(config: UnitConfig, role: string): UnitConfig {
  const out = JSON.parse(JSON.stringify(config)) as UnitConfig;
  const r = normRole(role);
  out.hasSkill2 = out.hasSkill2 !== false;

  for (const key of ['skill1', 'skill2'] as const) {
    const sk = out[key] as Record<string, unknown>;
    const defT = key === 'skill1' ? 'ENEMY_SINGLE' : 'ENEMY_SINGLE';
    const rows = migrateSkillEffects(sk, defT);
    const kept: EffectSlot[] = [];
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
    delete sk.modifiers;
    sk.cooldownModifier = clampCooldownModifier(Number(sk.cooldownModifier ?? 0));

    if (key === 'skill2') {
      (sk as SkillBlock).type = 'ACTIVE';
      delete (sk as Record<string, unknown>).passiveTrigger;
      const e = sk.effects as EffectSlot[];
      while (e.length < 3) e.push({ id: '', target: 'ENEMY_SINGLE', modifiers: [] });
      sk.effects = e.slice(0, 3);
    }
  }

  return out;
}
