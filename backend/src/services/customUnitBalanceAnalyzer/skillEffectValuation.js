/**
 * Valorisation des effets de compétence (indépendante du moteur de combat).
 */
import {
  EFFECT_BASE_VALUE,
  TARGET_SCOPE_MULT,
  BUFF_TYPE_MULT,
  DEBUFF_TYPE_MULT
} from './coefficients.js';
import { normalizeRoleKey } from './roleStatWeights.js';

/**
 * @param {object} effect
 * @returns {'damage'|'sustain'|'control'|'tempo'|'utility'|'unknown'}
 */
export function classifyEffectCategory(effect) {
  const t = String(effect?.type || '').toUpperCase();
  if (t === 'DAMAGE') return 'damage';
  if (t === 'HEAL' || t === 'RESURRECT') return 'sustain';
  if (t === 'APPLY_BUFF') {
    const bt = String(effect.buffType || '').toUpperCase();
    if (['SHIELD', 'REGEN', 'LIFESTEAL'].includes(bt)) return 'sustain';
    if (['IMMUNITY', 'INVINCIBILITY'].includes(bt)) return 'utility';
    return 'sustain';
  }
  if (t === 'APPLY_DEBUFF') {
    const dt = String(effect.debuffType || '').toUpperCase();
    if (['STUN', 'SILENCE', 'SLOW', 'PROVOKE'].includes(dt)) return 'control';
    return 'control';
  }
  if (t === 'ATB_UP' || t === 'REDUCE_ATB') return 'tempo';
  if (t === 'STRIP' || t === 'CLEANSE' || t === 'CD_DOWN' || t === 'CD_UP') return 'utility';
  return 'unknown';
}

function targetMult(target) {
  const k = String(target || '').toUpperCase();
  return TARGET_SCOPE_MULT[k] ?? TARGET_SCOPE_MULT.default;
}

function durationFactor(effect) {
  const ra = effect.remainingActions;
  if (ra == null || ra <= 0) return 1;
  return 1 + Math.min(3, Number(ra)) * 0.12;
}

function chanceFactor(effect) {
  const c = effect.chance;
  if (c == null || c >= 1) return 1;
  return 0.55 + 0.45 * Number(c);
}

/**
 * @param {object} effect
 * @param {object} context — { role, skillSlot, normalizedRole? }
 * @returns {number}
 */
export function valuateEffect(effect, context = {}) {
  if (!effect || typeof effect !== 'object') return 0;
  const type = String(effect.type || '').toUpperCase();
  const base = EFFECT_BASE_VALUE[type] ?? EFFECT_BASE_VALUE.default;
  const role = normalizeRoleKey(context.role);
  const tgt = targetMult(effect.target);
  const dur = durationFactor(effect);
  const ch = chanceFactor(effect);
  let mag = 1;

  switch (type) {
    case 'DAMAGE': {
      const m = Number(effect.mult ?? 0);
      const hpPct = Number(effect.percentMaxHp ?? 0);
      const hpCaster = Number(effect.percentMaxHpCaster ?? 0);
      mag = 1 + m * 2.8 + hpPct * 14 + hpCaster * 10;
      if (role === 'dps' || role === 'assassin') mag *= 1.08;
      break;
    }
    case 'HEAL': {
      const hp = Number(effect.percentMaxHp ?? 0);
      const hpC = Number(effect.percentMaxHpCaster ?? 0);
      const flat = Number(effect.value ?? 0);
      mag = 1 + hp * 12 + hpC * 8 + Math.min(2, flat / 500);
      if (role === 'support' || role === 'tank') mag *= 1.06;
      break;
    }
    case 'APPLY_BUFF': {
      const bt = String(effect.buffType || '').toUpperCase();
      const sub = BUFF_TYPE_MULT[bt] ?? BUFF_TYPE_MULT.default;
      const val = Number(effect.value ?? 0);
      mag = sub * (1 + Math.min(2.5, val / 1200));
      break;
    }
    case 'APPLY_DEBUFF': {
      const dt = String(effect.debuffType || '').toUpperCase();
      const sub = DEBUFF_TYPE_MULT[dt] ?? DEBUFF_TYPE_MULT.default;
      mag = sub;
      break;
    }
    case 'ATB_UP':
    case 'REDUCE_ATB': {
      const p = Number(effect.percent ?? 0);
      mag = 1 + p * 8;
      break;
    }
    case 'RESURRECT': {
      const p = Number(effect.percentHp ?? effect.percent ?? 0.3);
      mag = 1 + p * 5;
      break;
    }
    case 'CLEANSE':
    case 'STRIP': {
      const cnt = Number(effect.count ?? 1);
      mag = 1 + Math.min(4, cnt) * 0.15;
      break;
    }
    case 'CD_DOWN':
    case 'CD_UP': {
      const v = Number(effect.value ?? 1);
      mag = 1 + v * 0.35;
      break;
    }
    case 'STEAL_STAT': {
      mag = 1 + Number(effect.percent ?? 0) * 3;
      break;
    }
    default:
      mag = 1;
  }

  const slot = Number(context.skillSlot ?? 1);
  const slotFactor = slot === 2 ? 1.04 : 1;

  return base * mag * tgt * dur * ch * slotFactor;
}
