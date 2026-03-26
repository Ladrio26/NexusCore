import { normalizeEffects } from './customUnitSkill/normalizeEffects.js';
import { active, passive } from './customUnitSkill/enginePrimitives.js';
import { normalizeSkillEffectEntries } from './customUnitEffectEntry.js';
import { getBaseDurationTurnsForEffect } from '../data/customUnitEffectBaseDuration.js';
import { normalizeSkill1SpecBonus } from '../data/customUnitSpecializationConfig.js';

/** Buffs soi sur la compétence I, hors budget (spécialisation). */
const SKILL1_SPEC_BONUS_ENGINE = {
  SELF_ATK: { effectId: 'ATK_UP', buffType: 'ATK_UP' },
  SELF_DEF: { effectId: 'DEF_UP', buffType: 'DEF_UP' },
  SELF_SPEED: { effectId: 'SPEED', buffType: 'SPEED_UP' }
};

/**
 * Ajoute un effet moteur gratuit sur la compétence I (SELF ATQ/DEF/VITESSE).
 * @param {object} activeSkill
 * @param {string} [bonusKind]
 */
function appendSkill1SpecBonusEngineEffect(activeSkill, bonusKind) {
  if (!activeSkill || String(activeSkill.type).toUpperCase() !== 'ACTIVE') return;
  const k = normalizeSkill1SpecBonus(bonusKind);
  if (!k) return;
  const def = SKILL1_SPEC_BONUS_ENGINE[k];
  if (!def) return;
  const dur = getBaseDurationTurnsForEffect(def.effectId);
  const eff = {
    type: 'APPLY_BUFF',
    buffType: def.buffType,
    remainingActions: dur,
    target: 'SELF'
  };
  const arr = normalizeEffects([eff]);
  activeSkill.effects = [...(activeSkill.effects || []), ...arr];
}

/** Rétrocompat : absence du champ = compétence II activée. */
export function isSkill2Enabled(config) {
  return config?.hasSkill2 !== false;
}

function atkMultForRole(_role) {
  return 1;
}

function normalizeEffectId(entry) {
  if (entry == null) return null;
  if (typeof entry === 'string') return entry.trim().toUpperCase();
  if (typeof entry === 'object' && entry.id) return String(entry.id).trim().toUpperCase();
  return null;
}

function durationFromMods(modifiers, base = 2) {
  const mods = Array.isArray(modifiers) ? modifiers.map((m) => String(m).toUpperCase()) : [];
  let d = base;
  if (mods.includes('DURATION_1')) d += 1;
  if (mods.includes('DURATION_2')) d += 2;
  return d;
}

function hasDamage20(modifiers) {
  const mods = Array.isArray(modifiers) ? modifiers.map((m) => String(m).toUpperCase()) : [];
  return mods.includes('DAMAGE_20_PERCENT');
}

/**
 * @param {string} effectId
 * @param {{ modifiers?: string[] }} effectRow
 * @param {object} ctx — { mult, target, effectEntry }
 * @returns {object|null}
 */
function mapOneEffect(effectId, effectRow, ctx) {
  const { mult, target, effectEntry } = ctx;
  const mods = effectRow?.modifiers || [];
  const baseDur = getBaseDurationTurnsForEffect(effectId);
  const dur = durationFromMods(mods, baseDur);
  const d20 = hasDamage20(mods);

  switch (effectId) {
    case 'DAMAGE': {
      let m = mult;
      if (d20) m *= 1.2;
      return { type: 'DAMAGE', mult: m, target };
    }
    case 'DAMAGE_HP_CASTER':
      return { type: 'DAMAGE', percentMaxHpCaster: 0.15, target };
    case 'DAMAGE_HP_TARGET':
      return { type: 'DAMAGE', percentMaxHp: 0.12, target };
    case 'HEAL':
      return { type: 'HEAL', percentMaxHp: 0.15, target };
    case 'RESURRECT':
      return { type: 'RESURRECT', percentHp: 0.35, target };
    case 'STRIP_ONE':
      return { type: 'STRIP', count: 1, target };
    case 'STRIP_ALL':
      return { type: 'STRIP', count: 99, target };
    case 'CLEANSE_ONE':
      return { type: 'CLEANSE', count: 1, target };
    case 'CLEANSE_ALL':
      return { type: 'CLEANSE', target };
    case 'ATB_UP_50':
      return { type: 'ATB_UP', percent: 0.5, target };
    case 'ATB_UP_100':
      return { type: 'ATB_UP', percent: 1, target };
    case 'REDUCE_ATB_50':
      return { type: 'REDUCE_ATB', percent: 0.5, target };
    case 'REDUCE_ATB_100':
      return { type: 'REDUCE_ATB', percent: 1, target };
    case 'RESET_SKILL_CD':
      return { type: 'RESET_SKILL_COOLDOWN', target };
    case 'SET_SKILL_CD_MAX':
      return { type: 'SET_SKILL_COOLDOWN_MAX', target };
    case 'CD_UP_1':
      return { type: 'CD_UP', value: 1, target };
    case 'CD_UP_2':
      return { type: 'CD_UP', value: 2, target };
    case 'CD_DOWN_1':
      return { type: 'CD_DOWN', value: 1, target };
    case 'CD_DOWN_2':
      return { type: 'CD_DOWN', value: 2, target };
    case 'STEAL_STAT': {
      const stat =
        (effectEntry && typeof effectEntry === 'object' && effectEntry.stat) ||
        'attack';
      return { type: 'STEAL_STAT', stat, percent: 0.25, remainingActions: dur, target };
    }
    case 'DEFEND':
      return { type: 'DEFEND', remainingActions: dur, target };
    case 'ATK_UP':
      return { type: 'APPLY_BUFF', buffType: 'ATK_UP', remainingActions: dur, target };
    case 'DEF_UP':
      return { type: 'APPLY_BUFF', buffType: 'DEF_UP', remainingActions: dur, target };
    case 'SPEED':
      return { type: 'APPLY_BUFF', buffType: 'SPEED_UP', remainingActions: dur, target };
    case 'SHIELD':
      return { type: 'APPLY_BUFF', buffType: 'SHIELD', percentMaxHp: 0.12, remainingActions: dur, target };
    case 'IMMUNITY':
      return { type: 'APPLY_BUFF', buffType: 'IMMUNITY', remainingActions: dur, target };
    case 'INVINCIBILITY':
      return { type: 'APPLY_BUFF', buffType: 'INVINCIBILITY', remainingActions: dur, target };
    case 'REGEN':
      return { type: 'APPLY_BUFF', buffType: 'REGEN', percentMaxHp: 0.05, remainingActions: dur, target };
    case 'DOT':
      return { type: 'APPLY_BUFF', buffType: 'DOT', remainingActions: dur, target };
    case 'SILENCE':
      return { type: 'APPLY_DEBUFF', debuffType: 'SILENCE', remainingActions: dur, target };
    case 'PROVOKE':
      return { type: 'APPLY_DEBUFF', debuffType: 'PROVOKE', remainingActions: dur, target };
    case 'ATK_DOWN':
      return { type: 'APPLY_DEBUFF', debuffType: 'ATK_DOWN', remainingActions: dur, target };
    case 'DEF_DOWN':
      return { type: 'APPLY_DEBUFF', debuffType: 'DEF_DOWN', remainingActions: dur, target };
    case 'SLOW':
      return { type: 'APPLY_DEBUFF', debuffType: 'SLOW', remainingActions: dur, target };
    case 'ANTI_SHIELD':
      return { type: 'APPLY_DEBUFF', debuffType: 'ANTI_SHIELD', remainingActions: dur, target };
    case 'ANTI_HEAL':
      return { type: 'APPLY_DEBUFF', debuffType: 'ANTI_HEAL', remainingActions: dur, target };
    case 'BLIND':
      return { type: 'APPLY_DEBUFF', debuffType: 'BLIND', remainingActions: dur, target };
    case 'STUN':
      return { type: 'APPLY_DEBUFF', debuffType: 'STUN', remainingActions: dur, target };
    case 'ANTI_BUFF':
      return { type: 'APPLY_DEBUFF', debuffType: 'ANTI_BUFF', remainingActions: dur, target };
    default:
      return null;
  }
}

function computeCd(skillConfig, defaultTarget) {
  let cd = 3;
  let mod = Number(skillConfig?.cooldownModifier ?? 0) || 0;
  if (mod !== 0 && mod !== -1) mod = 0;
  cd += mod;
  return Math.max(1, Math.min(8, cd));
}

/**
 * @param {object} skillConfig
 * @param {object} opts — { role, priority, name, defaultTarget, isPassive, passiveTrigger }
 * @returns {object|null}
 */
export function buildEngineSkillFromConfig(skillConfig, opts) {
  const role = String(opts.role || 'dps').toLowerCase();
  const mult = atkMultForRole(role);
  const defaultTarget = opts.defaultTarget || 'ENEMY_SINGLE';
  const entries = normalizeSkillEffectEntries(skillConfig, defaultTarget);
  const engineEffects = [];

  for (const e of entries) {
    const id = normalizeEffectId(e.id);
    if (!id) continue;
    const target = String(e.target || defaultTarget)
      .toUpperCase()
      .trim();
    const row = mapOneEffect(id, e, { role, mult, target, effectEntry: e });
    if (row) engineEffects.push(row);
  }

  const normalized = normalizeEffects(engineEffects);

  if (opts.isPassive) {
    const trig = String(skillConfig?.passiveTrigger || 'ALWAYS').toUpperCase();
    return passive(
      trig,
      normalized,
      {
        priority: opts.priority ?? 3,
        name: opts.name || 'Passif personnalisé',
        description: ''
      }
    );
  }

  const cd = computeCd(skillConfig, defaultTarget);
  return active(opts.name || 'Compétence personnalisée', cd, opts.priority ?? 1, normalized);
}

/**
 * @param {string} role
 * @param {object} config — { skill1, skill2 }
 * @returns {{ skills: object[], tags: string[] }}
 */
export function assembleSkillsFromUnitConfig(role, config) {
  const s1 = config?.skill1 || {};
  const s2 = config?.skill2 || {};
  const skills = [];
  const tags = [];

  const sk1 = buildEngineSkillFromConfig(s1, {
    role,
    priority: 1,
    name: 'Compétence I',
    defaultTarget: 'ENEMY_SINGLE',
    isPassive: false
  });
  if (sk1) {
    skills.push(sk1);
    tags.push('S1');
    appendSkill1SpecBonusEngineEffect(sk1, config?.skill1SpecBonus);
  }

  if (!isSkill2Enabled(config)) {
    return { skills, tags };
  }

  /** Plus de compétence II passive (création / config). Toujours une active. */
  const sk2 = buildEngineSkillFromConfig(s2, {
    role,
    priority: 2,
    name: 'Compétence II',
    defaultTarget: 'ENEMY_SINGLE',
    isPassive: false,
    passiveTrigger: 'ON_ATTACK'
  });
  if (sk2) {
    skills.push(sk2);
    tags.push('S2');
  }

  return { skills, tags };
}
