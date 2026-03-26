import { initializeAtb, advanceAtb, pickNextActor, consumeAtbAfterAction } from './atb.js';
import { chooseTarget, resolveTargets, hasProvoke, selectTarget, getValidTargets } from './targeting.js';
import {
  onUnitActionEnd,
  decrementRegenAndDotDurationsAfterProc,
  getStatModifiers,
  getEffectiveCombatStats,
  applyHeal,
  applyShield,
  getShieldTotal,
  consumeShieldBuffs,
  applyEffect,
  applyStatus,
  EffectType
} from './effects.js';
import { BUFF_FIXED_VALUES } from './buffFixedValues.js';
import { getPowerStatMultiplier } from './unitPower.js';
import {
  applyPreBattleSynergies,
  applyStartOfBattleRuntimeEffects,
  onUnitActionStartSynergies,
  onUnitActionEndSynergies,
  onKillSynergies,
  onSkillUsedSynergies
} from './synergies.js';
import { BattleEventType, createBattleLogEntry } from './battleEvents.js';
import { getSkillTooltipPlainText } from './skillDescriptionTooltip.js';

// PRNG déterministe (mulberry32)
function createRng(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function clampFatigue(value) {
  if (value == null) return 0;
  return Math.max(0, Math.min(100, value));
}

// === Utilitaires génériques pour les effets ===

function rollChance(state, chance) {
  if (chance == null || chance === '') return true;
  let c = Number(chance);
  if (!Number.isFinite(c)) return true;
  if (c > 1) c = c / 100;
  if (c >= 1) return true;
  if (c <= 0) return false;
  const rng = state?.rng || Math.random;
  const r = typeof rng === 'function' ? rng() : Math.random();
  return r < c;
}

function targetHasStatus(target, statusKey) {
  if (!target) return false;
  const wanted = String(statusKey).toUpperCase();
  const buckets = [target.buffs, target.debuffs];
  for (const bucket of buckets) {
    if (!bucket) continue;
    for (const s of bucket) {
      const key = String(s.key ?? s.type ?? '').toUpperCase();
      if (key === wanted) return true;
    }
  }
  return false;
}

/** Retourne le % de vampirisme (0–1) : unit.lifestealPercent (synergie) ou buff LIFESTEAL (value). */
function getLifestealPercent(unit) {
  if (!unit?.alive) return 0;
  let pct = typeof unit.lifestealPercent === 'number' && unit.lifestealPercent > 0 ? unit.lifestealPercent : 0;
  const buffs = unit.buffs || [];
  for (const b of buffs) {
    if (String(b.type || b.key || '').toUpperCase() === 'LIFESTEAL') {
      const v = b.value;
      if (typeof v === 'number' && v > 0) pct = Math.max(pct, v > 1 ? v / 100 : v);
      break;
    }
  }
  return Math.min(1, Math.max(0, pct));
}

/** Passif permanent : immunise aux débuffs et aux effets hostiles type STRIP, réduction d’ATB, max CD, vol de stat, etc. */
function hasPermanentNegativeEffectImmunity(target) {
  return !!target?.permanentDebuffImmunity;
}

function onBeforeApplyDebuff(target, effect) {
  if (hasPermanentNegativeEffectImmunity(target)) {
    return { blocked: true };
  }
  if (targetHasStatus(target, EffectType.IMMUNITY)) {
    return { blocked: true };
  }
  return { blocked: false };
}

function isDebuffBuffType(buffType) {
  if (!buffType || typeof buffType !== 'string') return false;
  const t = buffType.toUpperCase();
  return t.endsWith('_DOWN') || t === 'SLOW' || t === 'SILENCE' || t === 'BLIND' || t === 'PROVOKE' || t === 'STUN'
    || t === 'ANTI_HEAL' || t === 'ANTI_SHIELD' || t === 'ANTI_BUFF' || t === 'DOT' || t === 'DEATH_MARK';
}

function onBeforeReduceAtb(target) {
  if (hasPermanentNegativeEffectImmunity(target)) {
    return { blocked: true };
  }
  if (targetHasStatus(target, EffectType.IMMUNITY)) {
    return { blocked: true };
  }
  return { blocked: false };
}

function onBeforeDamage(target, context) {
  if (targetHasStatus(target, EffectType.INVINCIBILITY)) {
    return { blocked: true };
  }
  return { blocked: false };
}

function onAfterDamage(source, target, damageDealt, context) {
  if (!source || !target) return;
  if (!damageDealt || damageDealt <= 0) return;
  if (context?.isCounter) return;
  if (!targetHasStatus(target, EffectType.COUNTER_ATTACK)) return;

  const state = context?.state;
  if (!state) return;

  // Contre-attaque : attaque de base hors ATB
  performBasicAction(state, target, source, {
    isCounter: true,
    ignoreProvocation: true,
    ignoreDistanceRestriction: true
  });
}

// Réduction centralisée de l'ATB (barre d'action).
// percent est compris entre 0 et 1 (0.3 = -30% de barre).
function applyReduceAtb(state, actor, target, percent) {
  const hook = onBeforeReduceAtb(target);
  if (hook.blocked) return false;
  const pct = Math.max(0, Math.min(1, Number(percent) || 0));
  if (pct <= 0) return false;
  const amount = pct * 100;
  const before = target.atb ?? 0;
  target.atb = Math.max(0, before - amount);
  return target.atb !== before;
}

// Retire aléatoirement 1+ buffs sur la cible (SHIELD est un buff, donc STRIP le retire naturellement).
// Retourne { removed, removedBuffs } pour les logs (removedBuffs = [{ type, value }]).
function applyStrip(state, target, count = 1) {
  if (!target || !Array.isArray(target.buffs) || target.buffs.length === 0) {
    return { removed: 0, removedBuffs: [] };
  }
  const removedBuffs = [];
  const max = Math.max(0, Math.floor(count));
  while (removedBuffs.length < max && target.buffs.length > 0) {
    const rng = state?.rng || Math.random;
    const r = typeof rng === 'function' ? rng() : Math.random();
    const index = Math.floor(r * target.buffs.length);
    const b = target.buffs[index];
    removedBuffs.push({ buffType: b.type || b.key, value: b.value ?? null });
    target.buffs.splice(index, 1);
  }
  return { removed: removedBuffs.length, removedBuffs };
}

// Retire tous les debuffs (ou jusqu'à count) de la cible. Contraire de STRIP.
// Retourne { removed, removedDebuffs } pour les logs.
function applyCleanse(state, target, count = null) {
  if (!target || !Array.isArray(target.debuffs) || target.debuffs.length === 0) {
    return { removed: 0, removedDebuffs: [] };
  }
  const removedDebuffs = [];
  const max = count != null && count >= 0 ? Math.floor(count) : target.debuffs.length;
  const toRemove = Math.min(max, target.debuffs.length);
  for (let i = 0; i < toRemove && target.debuffs.length > 0; i++) {
    const rng = state?.rng || Math.random;
    const r = typeof rng === 'function' ? rng() : Math.random();
    const index = Math.floor(r * target.debuffs.length);
    const d = target.debuffs[index];
    removedDebuffs.push({ debuffType: d.type || d.key, value: d.value ?? null });
    target.debuffs.splice(index, 1);
  }
  return { removed: removedDebuffs.length, removedDebuffs };
}

/** Normalise une valeur décimale : "0,1" (virgule) → 0.1 pour éviter NaN. */
function normalizeDecimal(v) {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string') {
    const s = String(v).trim().replace(/,/g, '.');
    const n = parseFloat(s);
    if (!Number.isNaN(n)) return n;
  }
  return v;
}

/** Applique la normalisation virgule → point sur les champs numériques d'un effet (données DB ou API). */
function normalizeEffectConfig(cfg) {
  if (!cfg || typeof cfg !== 'object') return cfg || {};
  const keys = ['value', 'percent', 'chance', 'percentMaxHp', 'percentMaxHpCaster', 'percentHp', 'mult', 'count', 'missingHpScaling', 'percentPerRemoved', 'valuePerRemoved'];
  const out = { ...cfg };
  for (const k of keys) {
    if (out[k] !== undefined && out[k] !== null) {
      const n = normalizeDecimal(out[k]);
      if (n !== out[k]) out[k] = n;
    }
  }
  return out;
}

function normalizeRatio(value) {
  const n = Number(value) || 0;
  if (n <= 0) return 0;
  return n > 1 ? n / 100 : n;
}

function getMissingHpRatio(unit) {
  const maxHp = Number(unit?.maxHp) || 0;
  const hp = Number(unit?.hp) || 0;
  if (maxHp <= 0) return 0;
  return Math.max(0, Math.min(1, 1 - hp / maxHp));
}

function normalizeStealableStat(stat) {
  const raw = String(stat || '').trim().toLowerCase();
  if (raw === 'atk') return 'attack';
  if (raw === 'def') return 'defense';
  if (raw === 'spd') return 'speed';
  return raw;
}

function getFrenchStatLabel(stat) {
  switch (normalizeStealableStat(stat)) {
    case 'attack':
      return "d'attaque";
    case 'defense':
      return 'de defense';
    case 'speed':
      return 'de vitesse';
    case 'mastery':
      return 'de maitrise';
    default:
      return 'de statistique';
  }
}

function getUnitBaseSkillCooldown(unit, skillRef = null) {
  if (skillRef && typeof skillRef === 'object') {
    const baseCd = Number(skillRef.cd_actions);
    return Number.isFinite(baseCd) && baseCd >= 0 ? baseCd : 0;
  }
  const inner = unit?.skill?.skill ?? unit?.skill;
  const baseCd = Number(inner?.cd_actions);
  return Number.isFinite(baseCd) && baseCd >= 0 ? baseCd : 0;
}

/** Vérifie si une compétence contient RESET_SKILL_COOLDOWN ou SET_SKILL_COOLDOWN_MAX. */
function skillHasCdManipulationEffects(skill) {
  if (!skill) return false;
  const inner = skill?.skill ?? skill;
  const effects = inner?.effects ?? [];
  return effects.some((e) => {
    const t = String(e?.type ?? '').toUpperCase();
    return t === 'RESET_SKILL_COOLDOWN' || t === 'SET_SKILL_COOLDOWN_MAX' || t === 'CD_UP' || t === 'CD_DOWN';
  });
}

/** Immunité manipulation CD : si une des compétences actives (slots) contient RESET/SET/CD_UP/CD_DOWN. */
function unitHasSkillCdManipulationImmunity(unit) {
  if (skillHasCdManipulationEffects(unit?.skill)) return true;
  if (Array.isArray(unit?.activeSkillSlots)) {
    for (const slot of unit.activeSkillSlots) {
      if (skillHasCdManipulationEffects({ skill: slot?.skill })) return true;
    }
  }
  return false;
}

/**
 * Construit les slots de compétences actives (CD indépendants, priorité croissante : plus petit = lancé en premier si plusieurs prêtes).
 */
function buildActiveSkillSlotsFromRaw(activeSkills) {
  if (!Array.isArray(activeSkills) || activeSkills.length === 0) return [];
  const slots = activeSkills.map((raw, i) => {
    const sk = ensureSkillEffects(normalizeSkill(raw));
    const priority = Number(raw.priority ?? raw.skillPriority ?? i + 1);
    const skillKey = raw.id != null ? String(raw.id) : `active-${i}`;
    return {
      skill: sk,
      skillCd: 0,
      priority: Number.isFinite(priority) ? priority : i + 1,
      skillKey
    };
  });
  slots.sort((a, b) => a.priority - b.priority);
  return slots;
}

/** Met à jour actor.skill / actor.skillCd pour l’UI & code legacy (1re compétence par priorité). */
function syncActorSkillMirror(actor) {
  if (!Array.isArray(actor.activeSkillSlots) || actor.activeSkillSlots.length === 0) return;
  const sorted = actor.activeSkillSlots.slice().sort((a, b) => a.priority - b.priority);
  const first = sorted[0];
  actor.skill = { skill: first.skill };
  actor.skillCd = Number.isFinite(Number(first.skillCd)) ? first.skillCd : 0;
}

function decrementSkillCooldownsOnBasic(actor) {
  if (Array.isArray(actor.activeSkillSlots) && actor.activeSkillSlots.length > 0) {
    for (const slot of actor.activeSkillSlots) {
      if (slot.skillCd > 0) slot.skillCd -= 1;
    }
    syncActorSkillMirror(actor);
    return;
  }
  if (actor.skillCd > 0) {
    actor.skillCd -= 1;
  }
}

// Wrapper unifié pour les futurs effets de skills, sans toucher aux branches actuelles.
function applySkillEffect(state, actor, target, effectConfig) {
  const cfg = normalizeEffectConfig(effectConfig || {});
  if (!actor.alive) return { applied: false };
  if (cfg.type !== 'RESURRECT' && !target.alive) return { applied: false };

  const useHostileAcc = shouldApplyHostileNegativeAccuracy(actor, target, cfg);
  if (useHostileAcc) {
    const pHit = computeHostileNegativeHitChance(actor, target, cfg.chance);
    if (!rollChance(state, pHit)) {
      return { applied: false, missedByChance: true, missedByAccuracy: true, hitChance: pHit };
    }
  } else if (cfg.chance !== undefined) {
    if (!rollChance(state, cfg.chance)) {
      return { applied: false, missedByChance: true };
    }
  }

  switch (cfg.type) {
    case 'APPLY_DEBUFF': {
      const pre = onBeforeApplyDebuff(target, cfg);
      if (pre.blocked) {
        return { applied: false, immune: true };
      }
      applyStatus(target, {
        type: cfg.debuffType || cfg.debuff || cfg.type,
        key: cfg.key,
        value: cfg.value,
        remainingActions: cfg.remainingActions,
        isDebuff: true,
        meta: {
          ...(cfg.meta || {}),
          appliedBy: actor?.uid,
          sourceCombatIndex: actor?.combatIndex
        },
        chance: cfg.chance
      }, actor?.uid);
      return { applied: true };
    }
    case 'STRIP': {
      if (hasPermanentNegativeEffectImmunity(target)) {
        return { applied: false, removed: 0, removedBuffs: [], immune: true };
      }
      const stripResult = applyStrip(state, target, cfg.count || 1);
      return {
        applied: stripResult.removed > 0,
        removed: stripResult.removed,
        removedBuffs: stripResult.removedBuffs
      };
    }
    case 'CLEANSE': {
      const count = cfg.count != null ? Math.max(0, Math.floor(cfg.count)) : null;
      const cleanseResult = applyCleanse(state, target, count);
      return {
        applied: cleanseResult.removed > 0,
        removed: cleanseResult.removed,
        removedDebuffs: cleanseResult.removedDebuffs
      };
    }
    case 'REDUCE_ATB': {
      let reducePct = Number(cfg.percent) ?? 0;
      if (reducePct > 1) reducePct = reducePct / 100;
      reducePct = Math.max(0, Math.min(1, reducePct));
      const atbBefore = target.atb ?? 0;
      const success = applyReduceAtb(state, actor, target, reducePct);
      const atbAfter = target.atb ?? 0;
      return {
        applied: success,
        atbBefore,
        atbAfter,
        value: atbBefore - atbAfter
      };
    }
    case 'RESURRECT': {
      const pct = cfg.percentHp ?? cfg.percent ?? 0.3;
      const success = resurrectUnit(state, target, pct);
      return { applied: success, hpRestored: success ? target.hp : null };
    }
    case 'ATB_UP': {
      let pct = cfg.percent ?? cfg.value ?? 0;
      if (pct > 1) pct = pct / 100;
      pct = Math.max(0, Math.min(1, Number(pct) || 0));
      const before = target.atb ?? 0;
      const delta = pct * 100;
      target.atb = Math.max(0, before + delta);
      return { applied: target.atb !== before, atbBefore: before, atbAfter: target.atb };
    }
    case 'RESET_SKILL_COOLDOWN': {
      const hasSkills =
        !!target?.skill || (Array.isArray(target?.activeSkillSlots) && target.activeSkillSlots.length > 0);
      if (!hasSkills) return { applied: false, before: null, after: null, baseCooldown: 0 };
      // Pas d'auto-reset : la compétence qui lance l'effet ne doit pas se reset elle-même
      if (target === actor || (target?.uid && actor?.uid && target.uid === actor.uid)) {
        return { applied: false, before: null, after: null, baseCooldown: 0, skippedSelfReset: true };
      }
      // Immunité : les compétences avec RESET/SET_CD ne peuvent pas être affectées par ces effets
      if (unitHasSkillCdManipulationImmunity(target)) {
        return { applied: false, before: null, after: null, baseCooldown: 0, skippedCdImmunity: true };
      }
      if (Array.isArray(target.activeSkillSlots) && target.activeSkillSlots.length > 0) {
        const before = target.activeSkillSlots.map((s) => Number(s.skillCd ?? 0));
        let applied = false;
        for (const slot of target.activeSkillSlots) {
          if (Number(slot.skillCd ?? 0) > 0) applied = true;
          slot.skillCd = 0;
        }
        syncActorSkillMirror(target);
        return {
          applied,
          before,
          after: target.activeSkillSlots.map((s) => s.skillCd),
          baseCooldown: getUnitBaseSkillCooldown(target),
          multiSlot: true
        };
      }
      const before = Number(target.skillCd ?? 0);
      target.skillCd = 0;
      return {
        applied: before !== 0,
        before,
        after: target.skillCd,
        baseCooldown: getUnitBaseSkillCooldown(target)
      };
    }
    case 'SET_SKILL_COOLDOWN_MAX': {
      const hasSkills =
        !!target?.skill || (Array.isArray(target?.activeSkillSlots) && target.activeSkillSlots.length > 0);
      if (!hasSkills) return { applied: false, before: null, after: null, baseCooldown: 0 };
      // Pas d'auto-reset : la compétence qui lance l'effet ne doit pas se modifier elle-même
      if (target === actor || (target?.uid && actor?.uid && target.uid === actor.uid)) {
        return { applied: false, before: null, after: null, baseCooldown: 0, skippedSelfReset: true };
      }
      // Immunité : les compétences avec RESET/SET_CD ne peuvent pas être affectées par ces effets
      if (unitHasSkillCdManipulationImmunity(target)) {
        return { applied: false, before: null, after: null, baseCooldown: 0, skippedCdImmunity: true };
      }
      if (hasPermanentNegativeEffectImmunity(target)) {
        return { applied: false, before: null, after: null, baseCooldown: 0, immune: true };
      }
      if (Array.isArray(target.activeSkillSlots) && target.activeSkillSlots.length > 0) {
        const before = target.activeSkillSlots.map((s) => Number(s.skillCd ?? 0));
        let anyChange = false;
        for (const slot of target.activeSkillSlots) {
          const maxCd = getUnitBaseSkillCooldown(target, slot.skill);
          const prev = Number(slot.skillCd ?? 0);
          slot.skillCd = maxCd;
          if (prev !== slot.skillCd) anyChange = true;
        }
        syncActorSkillMirror(target);
        return {
          applied: anyChange,
          before,
          after: target.activeSkillSlots.map((s) => s.skillCd),
          baseCooldown: getUnitBaseSkillCooldown(target),
          multiSlot: true
        };
      }
      const before = Number(target.skillCd ?? 0);
      const baseCooldown = getUnitBaseSkillCooldown(target);
      target.skillCd = baseCooldown;
      return {
        applied: before !== target.skillCd,
        before,
        after: target.skillCd,
        baseCooldown
      };
    }
    /** Augmente le CD actuel de la cible de X « tours » (actions). Hostile : immunité débuff / CD manipulation. */
    case 'CD_UP': {
      const hasSkills =
        !!target?.skill || (Array.isArray(target?.activeSkillSlots) && target.activeSkillSlots.length > 0);
      if (!hasSkills) return { applied: false, before: null, after: null, delta: 0 };
      if (target === actor || (target?.uid && actor?.uid && target.uid === actor.uid)) {
        return { applied: false, before: null, after: null, delta: 0, skippedSelfReset: true };
      }
      if (unitHasSkillCdManipulationImmunity(target)) {
        return { applied: false, before: null, after: null, delta: 0, skippedCdImmunity: true };
      }
      if (hasPermanentNegativeEffectImmunity(target)) {
        return { applied: false, before: null, after: null, delta: 0, immune: true };
      }
      const delta = Math.max(0, Math.floor(Number(cfg.value) || 0));
      if (delta <= 0) {
        if (Array.isArray(target.activeSkillSlots) && target.activeSkillSlots.length > 0) {
          const cur = target.activeSkillSlots.map((s) => Number(s.skillCd ?? 0));
          return { applied: false, before: cur, after: cur, delta: 0, multiSlot: true };
        }
        const cur = Number(target.skillCd ?? 0);
        return { applied: false, before: cur, after: cur, delta: 0 };
      }
      if (Array.isArray(target.activeSkillSlots) && target.activeSkillSlots.length > 0) {
        const before = target.activeSkillSlots.map((s) => Number(s.skillCd ?? 0));
        for (const slot of target.activeSkillSlots) {
          slot.skillCd = Number(slot.skillCd ?? 0) + delta;
        }
        syncActorSkillMirror(target);
        return { applied: true, before, after: target.activeSkillSlots.map((s) => s.skillCd), delta, multiSlot: true };
      }
      const before = Number(target.skillCd ?? 0);
      target.skillCd = before + delta;
      return { applied: true, before, after: target.skillCd, delta };
    }
    /** Réduit le CD actuel de la cible de X (minimum 0). Non bloqué par l’immunité débuff. */
    case 'CD_DOWN': {
      const hasSkills =
        !!target?.skill || (Array.isArray(target?.activeSkillSlots) && target.activeSkillSlots.length > 0);
      if (!hasSkills) return { applied: false, before: null, after: null, delta: 0 };
      if (unitHasSkillCdManipulationImmunity(target)) {
        return { applied: false, before: null, after: null, delta: 0, skippedCdImmunity: true };
      }
      const delta = Math.max(0, Math.floor(Number(cfg.value) || 0));
      if (delta <= 0) {
        if (Array.isArray(target.activeSkillSlots) && target.activeSkillSlots.length > 0) {
          const cur = target.activeSkillSlots.map((s) => Number(s.skillCd ?? 0));
          return { applied: false, before: cur, after: cur, delta: 0, multiSlot: true };
        }
        const cur = Number(target.skillCd ?? 0);
        return { applied: false, before: cur, after: cur, delta: 0 };
      }
      if (Array.isArray(target.activeSkillSlots) && target.activeSkillSlots.length > 0) {
        const before = target.activeSkillSlots.map((s) => Number(s.skillCd ?? 0));
        let anyChange = false;
        for (const slot of target.activeSkillSlots) {
          const prev = Number(slot.skillCd ?? 0);
          slot.skillCd = Math.max(0, prev - delta);
          if (prev !== slot.skillCd) anyChange = true;
        }
        syncActorSkillMirror(target);
        return {
          applied: anyChange,
          before,
          after: target.activeSkillSlots.map((s) => s.skillCd),
          delta,
          multiSlot: true
        };
      }
      const before = Number(target.skillCd ?? 0);
      target.skillCd = Math.max(0, before - delta);
      return { applied: before !== target.skillCd, before, after: target.skillCd, delta };
    }
    case 'APPLY_BUFF': {
      const buffType = (cfg.buffType || cfg.buff || cfg.type || '').toString().toUpperCase();
      const asDebuff = isDebuffBuffType(buffType);
      if (asDebuff) {
        const pre = onBeforeApplyDebuff(target, { ...cfg, debuffType: buffType });
        if (pre.blocked) return { applied: false, immune: true };
      }
      if (buffType === 'DOT' && asDebuff) {
        const fixedValue = BUFF_FIXED_VALUES[buffType];
        const value = fixedValue != null ? fixedValue : (cfg.value ?? 0);
        if (fixedValue != null && (cfg.value != null || cfg.percentMaxHp != null || cfg.percentMaxHpCaster != null)) {
          if (typeof console !== 'undefined' && console.warn) console.warn('APPLY_BUFF: value personnalisé ignoré pour', buffType, ', valeur fixe utilisée');
        }
        const duration = cfg.remainingActions ?? cfg.duration ?? 1;
        const extraStacks = Math.max(0, Math.floor(Number(cfg._dotExtraStacks) || 0));
        const totalStacks = 1 + extraStacks;
        for (let s = 0; s < totalStacks; s++) {
          applyStatus(target, {
            type: buffType,
            key: cfg.key,
            value,
            remainingActions: duration,
            isDebuff: true,
            meta: { ...(cfg.meta || {}), appliedBy: actor?.uid },
            chance: cfg.chance
          }, actor?.uid);
        }
        return { applied: true, buffType, remainingActions: duration, dotStacks: totalStacks };
      }
      if (buffType === 'ANTI_BUFF' && asDebuff) {
        const fixedValue = BUFF_FIXED_VALUES[buffType];
        const value = fixedValue != null ? fixedValue : (cfg.value ?? 0);
        let duration = cfg.remainingActions ?? cfg.duration ?? 1;
        duration += Math.max(0, Math.floor(Number(cfg._durationBonusFromScale) || 0));
        applyStatus(target, {
          type: buffType,
          key: cfg.key,
          value,
          remainingActions: duration,
          isDebuff: true,
          meta: { ...(cfg.meta || {}), appliedBy: actor?.uid },
          chance: cfg.chance
        }, actor?.uid);
        return { applied: true, buffType, remainingActions: duration };
      }
      if (buffType === 'SHIELD') {
        let pct = 0, maxHp = 0;
        if (cfg.percentMaxHp != null) { pct = cfg.percentMaxHp; maxHp = target.maxHp ?? 0; }
        else if (cfg.percentMaxHpCaster != null) { pct = cfg.percentMaxHpCaster; maxHp = actor?.maxHp ?? 0; }
        else if (cfg.percent != null) { pct = cfg.percent; maxHp = target.maxHp ?? 0; }
        const flat = (cfg.value != null && Number(cfg.value) > 0) ? Number(cfg.value) : 0;
        const amount = flat > 0 ? flat : Math.max(0, Math.round(maxHp * (pct > 1 ? pct / 100 : pct)));
        const duration = cfg.remainingActions ?? cfg.duration ?? 1;
        const res = applyShield(target, amount, duration, actor?.uid);
        return { applied: (res?.applied ?? 0) > 0, shieldAmount: res?.applied ?? amount };
      }
      if (buffType === 'REGEN') {
        let pct = 0;
        let maxHp = target.maxHp ?? 0;
        if (cfg.percentMaxHp != null) {
          pct = cfg.percentMaxHp;
          maxHp = target.maxHp ?? 0;
        } else if (cfg.percentMaxHpCaster != null) {
          pct = cfg.percentMaxHpCaster;
          maxHp = actor?.maxHp ?? 0;
        }
        const flat = (cfg.value != null && Number(cfg.value) > 0) ? Number(cfg.value) : 0;
        const amount = flat > 0 ? flat : Math.max(0, Math.round(maxHp * normalizeRatio(pct)));
        const duration = cfg.remainingActions ?? cfg.duration ?? 1;
        if (amount <= 0) return { applied: false, regenAmount: 0 };
        applyStatus(target, {
          type: EffectType.REGEN,
          key: EffectType.REGEN,
          value: amount,
          remainingActions: duration,
          isDebuff: false,
          meta: cfg.meta
        }, actor?.uid);
        return { applied: true, regenAmount: amount, remainingActions: duration };
      }
      const fixedValue = BUFF_FIXED_VALUES[buffType];
      const value = fixedValue != null ? fixedValue : (cfg.value ?? 0);
      if (fixedValue != null && (cfg.value != null || cfg.percentMaxHp != null || cfg.percentMaxHpCaster != null)) {
        if (typeof console !== 'undefined' && console.warn) console.warn('APPLY_BUFF: value personnalisé ignoré pour', buffType, ', valeur fixe utilisée');
      }
      applyStatus(target, {
        type: buffType,
        key: cfg.key,
        value,
        remainingActions: cfg.remainingActions ?? 1,
        isDebuff: asDebuff,
        meta: asDebuff
          ? { ...(cfg.meta || {}), appliedBy: actor?.uid, sourceCombatIndex: actor?.combatIndex }
          : cfg.meta,
        chance: cfg.chance
      }, actor?.uid);
      return { applied: true, buffType, remainingActions: cfg.remainingActions ?? 1 };
    }
    case 'STEAL_STAT': {
      if (hasPermanentNegativeEffectImmunity(target)) {
        return { applied: false, stat: null, amount: 0, blockedByDebuffImmunity: true };
      }
      const stat = normalizeStealableStat(cfg.stat);
      const pct = normalizeRatio(cfg.percent);
      const duration = cfg.remainingActions ?? cfg.duration ?? 1;
      const targetStats = getEffectiveCombatStats(target);
      const statValue = Number(targetStats?.[stat] ?? 0);
      const amount = Math.max(0, Math.round(statValue * pct));
      if (!['attack', 'defense', 'speed', 'mastery'].includes(stat) || amount <= 0) {
        return { applied: false, stat, amount: 0 };
      }
      applyStatus(actor, {
        type: EffectType.STAT_STEAL_BUFF,
        key: EffectType.STAT_STEAL_BUFF,
        value: amount,
        remainingActions: duration,
        isDebuff: false,
        meta: { stat, sourceTargetUid: target?.uid }
      }, actor?.uid);
      applyStatus(target, {
        type: EffectType.STAT_STEAL_DEBUFF,
        key: EffectType.STAT_STEAL_DEBUFF,
        value: amount,
        remainingActions: duration,
        isDebuff: true,
        meta: { stat, appliedBy: actor?.uid }
      }, actor?.uid);
      return { applied: true, stat, amount, remainingActions: duration };
    }
    case 'HEAL': {
      const flat = cfg.value ?? 0;
      let pct = cfg.percentMaxHp ?? cfg.percent ?? 0;
      let maxHp = target.maxHp ?? 0;
      if (cfg.percentMaxHpCaster != null) {
        pct = cfg.percentMaxHpCaster;
        maxHp = actor?.maxHp ?? 0;
      }
      const amount = flat > 0 ? flat : Math.max(0, Math.round(maxHp * (pct > 1 ? pct / 100 : pct)));
      const heal = applyHeal(target, amount);
      if (heal.applied > 0) setUnitHp(target, heal.hpAfter, state);
      return { applied: heal.applied > 0, healAmount: heal.applied, hpBefore: heal.hpBefore, hpAfter: heal.hpAfter };
    }
    case 'DEFEND': {
      // Buff porté par l'acteur (protecteur) ; meta.targetUid = l'allié protégé
      applyStatus(actor, {
        type: 'DEFEND',
        key: 'DEFEND',
        remainingActions: cfg.remainingActions ?? 1,
        isDebuff: false,
        meta: {
          targetUid: target.uid,
          appliedAt: state.turnCounter ?? Date.now()
        }
      }, actor?.uid);
      return { applied: true };
    }
    case 'DAMAGE': {
      const actorStats = getEffectiveCombatStats(actor);
      const targetStats = getEffectiveCombatStats(target);
      const attackMult = cfg.mult != null ? Number(cfg.mult) : 1;
      const targetMaxHpRatio = normalizeRatio(cfg.percentMaxHp ?? cfg.percent ?? 0);
      const casterMaxHpRatio = normalizeRatio(cfg.percentMaxHpCaster ?? 0);
      const missingHpScaling = normalizeRatio(cfg.missingHpScaling ?? 0);
      let raw = 0;

      if (cfg.mult != null || (targetMaxHpRatio <= 0 && casterMaxHpRatio <= 0)) {
        // Maîtrise : précision / résistance aux débuffs hostiles uniquement (plus de scaling dégâts ici).
        const atk = actorStats.attack * attackMult;
        const def = targetStats.defense;
        raw += (atk * atk) / (atk + def + 1);
      }
      if (targetMaxHpRatio > 0) {
        raw += (target.maxHp ?? 0) * targetMaxHpRatio;
      }
      if (casterMaxHpRatio > 0) {
        raw += (actor.maxHp ?? 0) * casterMaxHpRatio;
      }
      if (missingHpScaling > 0) {
        raw *= 1 + getMissingHpRatio(actor) * missingHpScaling;
      }
      if (target.damageTakenMul != null) raw *= target.damageTakenMul;
      const chainFlat = Math.max(0, Math.round(Number(cfg._flatDamageBonus) || 0));
      let damage = Math.max(0, Math.round(raw) + chainFlat);
      // EXECUTIONERS 2/4 : bonus dégâts sur cibles affaiblies (uniquement si l'attaquant est bourreau)
      const execLevel = actor.executionerLevel || 0;
      if (execLevel >= 2 && actor.traits?.includes('EXECUTIONERS') && target.alive && (target.maxHp ?? 0) > 0) {
        const hpRatio = target.hp / target.maxHp;
        if (hpRatio < 0.5) {
          damage = Math.round(damage * 1.1);
          if (execLevel >= 4 && hpRatio < 0.3) damage = Math.round(damage * 1.2);
        }
      }
      const damageResult = applyDamageToTarget(state, actor, target, damage, { damageSource: 'SKILL' });
      return {
        applied: damageResult.effectiveDamage > 0,
        effectiveDamage: damageResult.effectiveDamage,
        hpBefore: damageResult.hpBefore,
        hpAfter: damageResult.hpAfter,
        shieldBefore: damageResult.shieldBefore,
        shieldAfter: damageResult.shieldAfter,
        died: damageResult.died,
        selfResurrected: damageResult.selfResurrected,
        koSourceId: damageResult.koSourceId,
        koSourceName: damageResult.koSourceName
      };
    }
    default:
      return { applied: false };
  }
}

/**
 * Calcule les stats de combat scalées selon level et spécialisation.
 * unit: base_hp, base_attack, base_defense, base_speed, mastery (précision/résistance aux effets hostiles négatifs)
 * userUnit: level, specialization (optionnel)
 */
const BONUS_STAT_MAP = {
  attack: 'attack',
  defense: 'defense',
  hp: 'maxHp',
  maxHp: 'maxHp',
  speed: 'speed',
  mastery: 'mastery'
};

/** Évite PV/stats ×10+ si un niveau corrompu arrive (ex. 450 → scale ≈ 10). */
const MAX_LEVEL_FOR_SCALING = 100;

/**
 * Lit uniquement les stats de base (base_*) pour le scaling.
 * Ne jamais utiliser maxHp / attack / … déjà scalés : sinon double application au reload JSON
 * (base_hp omis → maxHp pris comme « base » → PV multipliés une 2e fois).
 */
function readBaseForScale(unit) {
  const hp = Number(unit.base_hp);
  const atk = Number(unit.base_attack);
  const def = Number(unit.base_defense);
  const spd = Number(unit.base_speed);
  const mas = Number(unit.mastery);
  return {
    baseHp: Number.isFinite(hp) && hp > 0 ? hp : 1000,
    baseAttack: Number.isFinite(atk) && atk >= 0 ? atk : 100,
    baseDefense: Number.isFinite(def) && def >= 0 ? def : 100,
    baseSpeed: Number.isFinite(spd) && spd >= 0 ? spd : 100,
    baseMastery: Number.isFinite(mas) && mas >= 0 ? mas : 0
  };
}

export function computeScaledStats(unit, userUnit) {
  const rawLevel = Number(userUnit?.level ?? unit?.level ?? 1);
  const level = Math.max(1, Math.min(MAX_LEVEL_FOR_SCALING, Number.isFinite(rawLevel) ? Math.floor(rawLevel) : 1));
  const specialization = userUnit?.specialization ?? unit?.specialization ?? null;
  const powerLevel = userUnit?.power_level ?? unit?.power_level ?? 1;
  const spec = specialization != null && String(specialization).trim() !== '' ? String(specialization).toUpperCase() : null;

  let scale = 1 + level * 0.02;
  if (spec) {
    scale *= 1.25;
  }

  const { baseHp, baseAttack, baseDefense, baseSpeed, baseMastery } = readBaseForScale(unit);

  let maxHp = Math.round(baseHp * scale);
  let attack = Math.round(baseAttack * scale);
  let defense = Math.round(baseDefense * scale);
  let speed = Math.round(baseSpeed * scale);
  let mastery = Math.round(baseMastery * scale);

  if (spec === 'A' || spec === 'B') {
    const bonusStatRaw = spec === 'A' ? (unit.specA_bonus_stat ?? '') : (unit.specB_bonus_stat ?? '');
    const bonusStat = BONUS_STAT_MAP[String(bonusStatRaw).toLowerCase()];
    if (bonusStat) {
      const val = { maxHp, attack, defense, speed, mastery }[bonusStat];
      const boosted = Math.round(val * 1.10);
      if (bonusStat === 'maxHp') maxHp = boosted;
      else if (bonusStat === 'attack') attack = boosted;
      else if (bonusStat === 'defense') defense = boosted;
      else if (bonusStat === 'speed') speed = boosted;
      else if (bonusStat === 'mastery') mastery = boosted;
    }
  }

  const powerMultiplier = getPowerStatMultiplier(powerLevel);
  if (powerMultiplier !== 1) {
    maxHp = Math.round(maxHp * powerMultiplier);
    attack = Math.round(attack * powerMultiplier);
    defense = Math.round(defense * powerMultiplier);
    speed = Math.round(speed * powerMultiplier);
    mastery = Math.round(mastery * powerMultiplier);
  }

  return {
    maxHp,
    attack,
    defense,
    speed,
    mastery
  };
}

function applyScaledStatsToUnit(unit) {
  const level = unit.level ?? 1;
  if (level == null || level < 1) return;
  const userUnit = { level: unit.level, specialization: unit.specialization };
  const stats = computeScaledStats(unit, userUnit);
  unit.maxHp = stats.maxHp;
  unit.attack = stats.attack;
  unit.defense = stats.defense;
  unit.speed = stats.speed;
  if (stats.mastery != null) unit.mastery = stats.mastery;
}

function applyArchetypePassives(unit) {
  switch (unit.archetype) {
    case 'CAC_TANK':
      // +25% HP supprimé (bug / design) ; on garde uniquement la défense
      unit.defense = Math.round(unit.defense * 1.25);
      break;
    case 'CAC_DPS':
      unit.attack = Math.round(unit.attack * 1.25);
      unit.speed = Math.round(unit.speed * 1.25);
      break;
    case 'DISTANCE':
      unit.mastery = Math.round((unit.mastery || 0) * 1.25);
      break;
    default:
      break;
  }
}

function applyFatigueToSpeed(unit) {
  const fatigue = clampFatigue(unit.fatigue ?? 0);
  const factor = 1 - 0.01 * fatigue; // 1 fatigue = 1% de réduction
  unit.speed = Math.max(1, Math.round(unit.speed * factor));
}

function isBattleFinished(units) {
  const aliveA = units.some((u) => u.side === 'A' && u.alive);
  const aliveB = units.some((u) => u.side === 'B' && u.alive);
  if (aliveA && aliveB) return null;
  if (aliveA && !aliveB) return 'A';
  if (!aliveA && aliveB) return 'B';
  return 'draw';
}

function elementRelation(attacker, target) {
  const a = String(attacker?.element || '').toLowerCase();
  const t = String(target?.element || '').toLowerCase();
  if (!a || !t) return 'neutral';
  // Cycle classique : Plante > Eau > Feu > Plante
  if (a === 'water' && t === 'fire') return 'adv';
  if (a === 'fire' && t === 'plant') return 'adv';
  if (a === 'plant' && t === 'water') return 'adv';
  if (a === 'water' && t === 'plant') return 'dis';
  if (a === 'fire' && t === 'water') return 'dis';
  if (a === 'plant' && t === 'fire') return 'dis';
  // Lumière et Ténèbre : forts l'un contre l'autre (neutres vs feu/eau/plante)
  if ((a === 'light' || a === 'lumiere') && (t === 'dark' || t === 'tenebres' || t === 'tenebre')) return 'adv';
  if ((a === 'dark' || a === 'tenebres' || a === 'tenebre') && (t === 'light' || t === 'lumiere')) return 'adv';
  return 'neutral';
}

// --- Précision / résistance (Maîtrise) pour débuffs & effets hostiles négatifs ---

/** Précision de base (0–1) : neutre 65 %, avantage 80 %, désavantage 50 %. */
function baseHostileNegativeAccuracyFromElement(attacker, target) {
  const rel = elementRelation(attacker, target);
  if (rel === 'adv') return 0.8;
  if (rel === 'dis') return 0.5;
  return 0.65;
}

/**
 * Modificateur en points de pourcentage (plancher –35, plafond +35) :
 * +1 % par tranche de 10 Maîtrise en faveur du lanceur vs la cible (stats effectives de combat).
 */
function getMasteryPrecisionBonusPercent(actor, target) {
  const actorStats = getEffectiveCombatStats(actor);
  const targetStats = getEffectiveCombatStats(target);
  const a = Number(actorStats?.mastery ?? actor?.mastery ?? 0) || 0;
  const b = Number(targetStats?.mastery ?? target?.mastery ?? 0) || 0;
  const steps = Math.trunc((a - b) / 10);
  return Math.max(-35, Math.min(35, steps));
}

function normalizeChanceToFraction(raw) {
  if (raw == null || raw === '') return 1;
  let c = Number(raw);
  if (!Number.isFinite(c)) return 1;
  if (c > 1) c = c / 100;
  return Math.max(0, Math.min(1, c));
}

/**
 * Probabilité finale d'application (0–1) : (base élément + bonus Maîtrise en points) × chance du skill si présente.
 */
function computeHostileNegativeHitChance(actor, target, skillChanceRaw) {
  let p = baseHostileNegativeAccuracyFromElement(actor, target);
  p += getMasteryPrecisionBonusPercent(actor, target) / 100;
  p = Math.max(0, Math.min(1, p));
  const skillFrac = normalizeChanceToFraction(skillChanceRaw);
  return p * skillFrac;
}

function isHostileNegativeEffectConfig(cfg) {
  if (!cfg || typeof cfg !== 'object') return false;
  const t = String(cfg.type || '').toUpperCase();
  if (t === 'APPLY_DEBUFF') return true;
  if (t === 'STRIP') return true;
  if (t === 'REDUCE_ATB') return true;
  if (t === 'STEAL_STAT') return true;
  if (t === 'SET_SKILL_COOLDOWN_MAX') return true;
  if (t === 'CD_UP') return true;
  if (t === 'APPLY_BUFF') {
    const buffType = (cfg.buffType || cfg.buff || '').toString();
    return isDebuffBuffType(buffType);
  }
  return false;
}

/** Effet négatif sur une cible ennemie (hors équipe du lanceur) : tirage précision / résistance par cible. */
function shouldApplyHostileNegativeAccuracy(actor, target, cfg) {
  if (!actor?.alive || !target?.alive) return false;
  if (actor.side == null || target.side == null) return false;
  if (actor.side === target.side) return false;
  return isHostileNegativeEffectConfig(cfg);
}

function normalizeSkill(raw) {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (Array.isArray(raw)) {
    return raw[0] || null;
  }
  if (typeof raw === 'object') return raw;
  return null;
}

/**
 * Extrait compétences actives et passives depuis skill_data.
 * Nouveau format : skill_data.skills[] (type ACTIVE / PASSIVE).
 * Legacy : skill_data.skill + skill_data.passives (ou skill.passives).
 */
function getSkillsFromSkillData(rawSkill) {
  if (!rawSkill || typeof rawSkill !== 'object') {
    return { activeSkills: [], passiveSkills: [] };
  }
  if (Array.isArray(rawSkill.skills) && rawSkill.skills.length > 0) {
    const activeSkills = rawSkill.skills.filter((s) => s && String(s.type || '').toUpperCase() === 'ACTIVE');
    const passiveSkills = rawSkill.skills.filter((s) => s && String(s.type || '').toUpperCase() === 'PASSIVE');
    return { activeSkills, passiveSkills };
  }
  const innerSkill = rawSkill.skill ?? rawSkill;
  const activeSkills = innerSkill && typeof innerSkill === 'object' && (innerSkill.effects?.length || innerSkill.cd_actions != null) ? [innerSkill] : [];
  const rawPassives = Array.isArray(rawSkill.passives) ? rawSkill.passives : (Array.isArray(innerSkill?.passives) ? innerSkill.passives : []);
  return { activeSkills, passiveSkills: rawPassives };
}

/**
 * Une unité peut lancer une compétence active si au moins un slot est prêt (CD 0).
 * Exceptions : pas de skill, silence.
 * (La provocation est gérée au call site : shouldUseSkill(actor) && !hasProvoke(actor).)
 */
function shouldUseSkill(actor) {
  if (targetHasStatus(actor, EffectType.SILENCE)) return false;
  if (Array.isArray(actor.activeSkillSlots) && actor.activeSkillSlots.length > 0) {
    return actor.activeSkillSlots.some((s) => s.skill && (s.skillCd === 0 || s.skillCd == null));
  }
  if (!actor?.skill) return false;
  const cd = actor.skillCd;
  return cd === 0 || cd == null;
}

/** Texte de tooltip compétence(s) pour l’UI manuelle (multi-compétences si applicable). */
function getMainSkillDescriptionFromUnit(actor) {
  const raw = actor?.skill_data || actor?.skillData || actor?.skill;
  const specRaw = actor?.specialization;
  const spec =
    specRaw != null && String(specRaw).trim() !== '' ? String(specRaw).toUpperCase() : null;
  const opts = spec === 'A' || spec === 'B' ? { specialization: spec } : {};
  return getSkillTooltipPlainText(raw, opts) || '';
}

function getAliveEnemies(state, actor) {
  return state.units.filter((u) => u.side !== actor.side && u.alive);
}

function getAliveAllies(state, actor) {
  return state.units.filter((u) => u.side === actor.side && u.alive);
}

function getDeadAllies(state, actor) {
  return state.units.filter((u) => u.side === actor.side && !u.alive);
}

/** Priorité des cibles pour le ciblage manuel : du plus prioritaire au moins. */
const SKILL_TARGET_PRIORITY = [
  'ALLY_DEAD_SINGLE',
  'TEAM_ALLY_DEAD',
  'ENEMY_SINGLE',
  'ALLY_SINGLE',
  'TEAM_ENEMY',
  'TEAM_ALLY',
  'LOWEST_HP_ALLY',
  'SELF'
];

/**
 * @param {object|null} skillOverride - compétence explicite (multi-slots). Si null, utilise actor.skill.
 * @param {{ skipCdCheck?: boolean }} opts - si skipCdCheck, ne vérifie pas shouldUseSkill (sélection de slot déjà faite).
 */
function getSkillTargetCandidates(state, actor, skillOverride = null, opts = {}) {
  const skipCdCheck = opts.skipCdCheck === true;
  if (!skipCdCheck) {
    if (!actor?.skill || !shouldUseSkill(actor)) return [];
  } else if (!skillOverride && !actor?.skill) {
    return [];
  }
  let skill = skillOverride;
  if (!skill) {
    const skillContainer = actor.skill;
    skill = skillContainer?.skill ?? skillContainer;
  }
  if (!skill) return [];
  skill = ensureSkillEffects(skill);
  const effects = Array.isArray(skill.effects) ? skill.effects : [];
  if (effects.length === 0) return [];

  const effectTargets = effects.map((e) => {
    const raw = String(e?.target ?? '').toUpperCase().trim();
    if (raw.length > 0) return raw;
    const effType = String(e?.type ?? '').toUpperCase();
    if (effType === 'DAMAGE' || effType === 'APPLY_DEBUFF') return 'ENEMY_SINGLE';
    return '';
  }).filter((t) => t.length > 0);
  const preferredTarget = SKILL_TARGET_PRIORITY.find((p) => effectTargets.includes(p));

  const enemies = getAliveEnemies(state, actor);
  const allies = getAliveAllies(state, actor);
  const deadAllies = getDeadAllies(state, actor);

  if (preferredTarget === 'ALLY_DEAD_SINGLE' || preferredTarget === 'TEAM_ALLY_DEAD') {
    return deadAllies;
  }
  if (preferredTarget === 'ENEMY_SINGLE') {
    const enemies = getAliveEnemies(state, actor);
    if (!enemies.length) return [];
    const isDistance = String(actor.rangeType ?? actor.attack_type ?? actor.position ?? '').toUpperCase().includes('DISTANCE')
      || String(actor.position ?? '').toLowerCase() === 'back';
    if (isDistance) return enemies;
    const front = enemies.filter((u) => String(u.position ?? '').toLowerCase() === 'front');
    return front.length > 0 ? front : enemies;
  }
  if (preferredTarget === 'ALLY_SINGLE') {
    return allies;
  }
  if (preferredTarget === 'TEAM_ENEMY') {
    return enemies;
  }
  if (preferredTarget === 'TEAM_ALLY') {
    return allies;
  }
  if (preferredTarget === 'LOWEST_HP_ALLY') {
    return allies;
  }
  if (preferredTarget === 'SELF') {
    return actor.alive ? [actor] : [];
  }

  return [...enemies, ...allies];
}

/**
 * IA : slot activable (CD 0) avec la plus petite `priority` qui a au moins une cible valide.
 * Si plusieurs compétences sont prêtes, la priorité numérique décide (1 avant 2, etc.).
 */
function selectSkillSlotForAi(actor, state) {
  if (targetHasStatus(actor, EffectType.SILENCE)) return null;
  const slots =
    Array.isArray(actor.activeSkillSlots) && actor.activeSkillSlots.length > 0
      ? actor.activeSkillSlots.slice().sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999))
      : null;
  if (!slots) {
    if (!actor?.skill) return null;
    const cd = actor.skillCd;
    if (cd > 0 && cd != null) return null;
    const sk = ensureSkillEffects(normalizeSkill(actor.skill?.skill ?? actor.skill));
    const cands = getSkillTargetCandidates(state, actor, sk, { skipCdCheck: true });
    if (cands.length === 0) return null;
    return { skill: sk, legacy: true };
  }
  const ready = slots.filter((s) => s.skill && (s.skillCd === 0 || s.skillCd == null));
  for (const slot of ready) {
    const sk = ensureSkillEffects(normalizeSkill(slot.skill));
    const cands = getSkillTargetCandidates(state, actor, sk, { skipCdCheck: true });
    if (cands.length > 0) return { ...slot, skill: sk, legacy: false };
  }
  return null;
}

/** Mode interactif : `skillKey` / `skillSlotKey` optionnel dans la décision, sinon même logique que l’IA. */
function pickSkillSlotForInteractive(actor, state, decision) {
  if (!Array.isArray(actor.activeSkillSlots) || actor.activeSkillSlots.length === 0) return null;
  const key = decision?.skillKey ?? decision?.skillSlotKey ?? null;
  if (key) {
    const slot = actor.activeSkillSlots.find((s) => s.skillKey === key);
    if (slot && (slot.skillCd === 0 || slot.skillCd == null)) {
      const sk = ensureSkillEffects(normalizeSkill(slot.skill));
      const cands = getSkillTargetCandidates(state, actor, sk, { skipCdCheck: true });
      if (cands.length > 0) return { ...slot, skill: sk, legacy: false };
    }
  }
  return selectSkillSlotForAi(actor, state);
}


/**
 * Trouve l'unité qui porte un buff DEFEND protégeant originalTarget (la plus récente si plusieurs).
 */
function findDefendProtector(state, originalTarget) {
  if (!originalTarget || !state?.units) return null;

  const allies = state.units.filter(
    (u) => u.side === originalTarget.side && u.alive
  );

  let latestProtector = null;
  let latestAppliedAt = -1;

  for (const unit of allies) {
    if (!Array.isArray(unit.buffs)) continue;

    for (const buff of unit.buffs) {
      const key = String(buff.key ?? buff.type ?? '').toUpperCase();
      if (key !== 'DEFEND') continue;

      if (buff.meta?.targetUid !== originalTarget.uid) continue;

      const appliedAt = buff.meta?.appliedAt ?? 0;
      if (appliedAt > latestAppliedAt) {
        latestAppliedAt = appliedAt;
        latestProtector = unit;
      }
    }
  }

  return latestProtector;
}

/**
 * Point central : seule fonction qui modifie hp/alive.
 * Ne logue jamais le KO : le caller (applyDamageToTarget / appelant) logue damage puis unit_ko.
 * Retourne { died: true } quand l'unité vient de mourir, { died: false } sinon.
 */
function setUnitHp(unit, newHp, state) {
  const wasAlive = unit.alive === true;

  unit.hp = Math.max(0, Math.floor(newHp));

  if (unit.hp <= 0) {
    unit.hp = 0;
    if (!unit.alive) return { died: false };
    unit.alive = false;
    unit.atb = 0;
    unit.buffs = [];
    unit.debuffs = [];
    return { died: true };
  }
  if (!wasAlive) {
    unit.alive = true;
    unit.atb = 0;
    if (state?.logEvent) {
      state.logEvent(state, { type: 'revive', targetId: unit.combatIndex, amount: unit.hp });
    }
  }
  return { died: false };
}

function applyDamageToTarget(state, actor, target, baseFinalDamage, extraContext = {}) {
  const damageSource = extraContext.damageSource ?? 'DIRECT';
  const allowDeadActor = extraContext.deathMarkExplosion === true;
  if (!allowDeadActor && !actor?.alive) {
    return { hpBefore: 0, hpAfter: 0, shieldBefore: 0, shieldAfter: 0, effectiveDamage: 0 };
  }
  if (!target?.alive) {
    return { hpBefore: target?.hp ?? 0, hpAfter: target?.hp ?? 0, shieldBefore: 0, shieldAfter: 0, effectiveDamage: 0 };
  }
  let incoming = Math.max(0, Math.round(Number(baseFinalDamage) || 0));
  const pre = onBeforeDamage(target, { state, actor, baseFinalDamage: incoming, ...extraContext });
  if (pre.blocked) {
    if (state.logEvent) {
      state.logEvent(state, {
        type: 'immune',
        targetId: target.combatIndex,
        sourceId: actor?.combatIndex,
        reason: 'INVINCIBILITY'
      });
    }
    const shieldBefore = getShieldTotal(target);
    const hpBefore = target.hp;
    const result = {
      hpBefore,
      hpAfter: hpBefore,
      shieldBefore,
      shieldAfter: shieldBefore,
      effectiveDamage: 0
    };
    onAfterDamage(actor, target, 0, { state, actor, baseFinalDamage: incoming, prevented: true, ...extraContext });
    return result;
  }

  // Redirection DEFEND (avant mitigation shield / Acier / bouclier PV) — on ne recalcule pas les dégâts
  let actualTarget = target;
  const defender = findDefendProtector(state, target);
  if (defender && defender.uid !== target.uid) {
    if (state.logEvent) {
      state.logEvent(state, {
        type: 'redirect',
        reason: 'DEFEND',
        from: target.combatIndex,
        to: defender.combatIndex
      });
    }
    actualTarget = defender;
  }

  // Bouclier multi-coups : bloque tout dégât (direct, DoT, etc.) tant qu’il reste des charges
  if (incoming > 0) {
    const mhs = actualTarget.multiHitShieldHitsRemaining;
    if (typeof mhs === 'number' && mhs > 0) {
      actualTarget.multiHitShieldHitsRemaining = mhs - 1;
      if (state.logEvent) {
        state.logEvent(state, {
          type: 'multi_hit_shield_absorb',
          targetId: actualTarget.combatIndex,
          sourceId: actor?.combatIndex,
          hitsRemaining: actualTarget.multiHitShieldHitsRemaining
        });
      }
      const shieldBefore = getShieldTotal(actualTarget);
      onAfterDamage(actor, actualTarget, 0, {
        state,
        actor,
        baseFinalDamage: incoming,
        prevented: true,
        multiHitShield: true,
        ...extraContext
      });
      const logPassiveMhs = (ev) => state.logEvent && state.logEvent(state, ev);
      handlePassiveTrigger(
        state,
        actualTarget,
        'ON_RECEIVE_DAMAGE',
        { source: actor, target: actualTarget, damage: 0 },
        logPassiveMhs
      );
      handlePassiveTrigger(state, actor, 'ON_HIT', { target: actualTarget, damage: 0 }, logPassiveMhs);
      handlePassiveTrigger(state, actor, 'ON_DEAL_DAMAGE', { target: actualTarget, damage: 0 }, logPassiveMhs);
      for (const u of state.units) {
        if (!u.alive || u.side !== actualTarget.side || u.uid === actualTarget.uid) continue;
        handlePassiveTrigger(state, u, 'ON_ALLY_RECEIVE_DAMAGE', {
          source: actor,
          target: actualTarget,
          damage: 0
        }, logPassiveMhs);
      }
      return {
        hpBefore: actualTarget.hp,
        hpAfter: actualTarget.hp,
        shieldBefore,
        shieldAfter: shieldBefore,
        effectiveDamage: 0,
        died: false,
        selfResurrected: false,
        koSourceId: actualTarget.combatIndex,
        koSourceName: actualTarget.name ?? String(actualTarget.combatIndex)
      };
    }
  }

  // Acier : réduction % sur dégâts directs (attaques, compétences DAMAGE, marque de mort, etc.)
  let dmg = incoming;
  if (damageSource !== 'DOT' && dmg > 0) {
    const sp = actualTarget.steelDamageReductionPercent;
    if (typeof sp === 'number' && sp > 0) {
      const pct = sp > 1 ? sp / 100 : sp;
      dmg = Math.max(0, Math.round(dmg * (1 - Math.min(0.95, pct))));
    }
  }

  const mod = state.bossModifier;
  const isBossTarget = state.bossUid != null && actualTarget.uid === state.bossUid;
  const shieldBefore = getShieldTotal(actualTarget);
  const remainingDamage = consumeShieldBuffs(actualTarget, dmg);
  const shieldAfter = getShieldTotal(actualTarget);
  const valueAbsorbed = shieldBefore - shieldAfter;
  if (valueAbsorbed > 0 && state.logEvent) {
    state.logEvent(state, { type: 'shield_absorb', targetId: actualTarget.combatIndex, sourceId: actor?.combatIndex, valueAbsorbed });
  }
  const hpBefore = actualTarget.hp;
  const hpDamage = Math.min(actualTarget.hp, remainingDamage);
  const hpResult = setUnitHp(actualTarget, actualTarget.hp - hpDamage, state);
  let justDied = hpResult?.died === true;

  let selfResurrected = false;
  if (!actualTarget.alive && state.logEvent) {
    handlePassiveTrigger(state, actualTarget, 'ON_DEATH', { source: actor }, (ev) => state.logEvent(state, ev));
    selfResurrected = actualTarget.alive;
  }
  // Boss ch10 : résurrection unique à 100% HP quand il meurt la première fois (normal + hard)
  if (!actualTarget.alive && isBossTarget && mod?.resurrectOnce && !state.bossResurrected) {
    state.bossResurrected = true;
    if (resurrectUnit(state, actualTarget, 1)) {
      selfResurrected = true;
      justDied = false;
    }
  }
  const result = {
    hpBefore,
    hpAfter: actualTarget.hp,
    shieldBefore,
    shieldAfter,
    effectiveDamage: hpDamage,
    selfResurrected,
    died: selfResurrected ? false : justDied,
    koSourceId: actualTarget.combatIndex,
    koSourceName: actualTarget.name ?? String(actualTarget.combatIndex)
  };
  onAfterDamage(actor, actualTarget, result.effectiveDamage, { state, actor, baseFinalDamage: incoming, ...extraContext });

  const logPassive = (ev) => state.logEvent && state.logEvent(state, ev);
  // Coup reçu : PV perdus OU absorption par bouclier PV (pas seulement hpDamage — sinon pas de passif si tout est absorbé).
  const connectHit =
    damageSource !== 'DOT' &&
    (result.effectiveDamage > 0 || valueAbsorbed > 0);
  if (connectHit) {
    const dmgCtx = result.effectiveDamage;
    handlePassiveTrigger(state, actualTarget, 'ON_RECEIVE_DAMAGE', { source: actor, target: actualTarget, damage: dmgCtx }, logPassive);
    handlePassiveTrigger(state, actor, 'ON_HIT', { target: actualTarget, damage: dmgCtx }, logPassive);
    handlePassiveTrigger(state, actor, 'ON_DEAL_DAMAGE', { target: actualTarget, damage: dmgCtx }, logPassive);
    for (const u of state.units) {
      if (!u.alive || u.side !== actualTarget.side || u.uid === actualTarget.uid) continue;
      handlePassiveTrigger(state, u, 'ON_ALLY_RECEIVE_DAMAGE', {
        source: actor,
        target: actualTarget,
        damage: dmgCtx
      }, logPassive);
    }
  }
  if (justDied) {
    handlePassiveTrigger(state, actor, 'ON_KILL', { target: actualTarget }, logPassive);
    fireKoObserverPassives(state, actualTarget, actor, logPassive);
  }
  // Vampirisme : regain en HP d'une partie des dégâts infligés (buff LIFESTEAL ou unit.lifestealPercent ex. BERSERKERS)
  if (result.effectiveDamage > 0 && actor?.alive) {
    const lifestealPct = getLifestealPercent(actor);
    if (lifestealPct > 0) {
      const baseHeal = Math.round(result.effectiveDamage * lifestealPct);
      const heal = applyHeal(actor, baseHeal);
      if (heal.applied > 0) {
        setUnitHp(actor, heal.hpAfter, state);
        if (state.logEvent) {
          state.logEvent(state, {
            type: 'lifesteal',
            sourceId: actor.combatIndex,
            sourceName: actor.name,
            healAmount: heal.applied,
            hpBefore: heal.hpBefore,
            hpAfter: heal.hpAfter,
            damageDealt: result.effectiveDamage
          });
        }
      }
    }
  }
  return result;
}

function performBasicAction(state, actor, arg2, arg3, arg4, arg5, options = {}) {
  let round;
  let atbBefore;
  let rng;
  let logEventFn;
  let forcedTarget = null;
  let opts = options;

  // Overload :
  // - (state, actor, round, atbBefore, rng, logEventFn)  [chemin existant]
  // - (state, actor, forcedTarget, options)              [contre-attaque]
  if (typeof arg2 === 'object' && arg2 !== null && !Array.isArray(arg2)) {
    forcedTarget = arg2;
    opts = arg3 || {};
    round = opts.round ?? 0;
    atbBefore = opts.atbBefore ?? actor.atb;
    rng = state.rng || Math.random;
    logEventFn = (st, ev) => logEvent(st, ev);
  } else {
    round = arg2;
    atbBefore = arg3;
    rng = arg4;
    logEventFn = arg5;
  }

  if (!actor.alive) return;

  let target = forcedTarget;
  if (!target) {
    if (opts.ignoreProvocation || opts.ignoreDistanceRestriction) {
      const enemies = state.units.filter((u) => u.side !== actor.side && u.alive);
      if (!enemies.length) return;
      enemies.sort((a, b) => a.hp - b.hp);
      target = enemies[0];
    } else {
      const enemies = state.units.filter((u) => u.side !== actor.side && u.alive);
      const rng = state?.rng != null && typeof state.rng === 'function' ? state.rng : Math.random;
      const focusRule = actor.basic_targeting || 'NO_FOCUS';
      target = selectTarget(actor, enemies, focusRule, false, state, rng);
      if (!target) target = chooseTarget(state.units, actor, { state });
    }
  }

  if (!target) return;

  const damageInfo = computeBasicDamage(state, actor, target, rng);
  const damageResult = applyDamageToTarget(state, actor, target, damageInfo.finalDamage, {
    isCounter: !!opts.isCounter,
    damageSource: opts.isCounter ? 'COUNTER' : 'BASIC'
  });

  const atbAfterActor = opts.isCounter ? actor.atb : consumeAtbAfterAction(actor);

  const event = {
    type: 'attack',
    actionType: 'BASIC',
    isCounter: !!opts.isCounter,
    round,
    actor: actor.combatIndex,
    actorSide: actor.side,
    target: target.combatIndex,
    targetSide: target.side,
    atbBefore,
    atbAfter: atbAfterActor,
    rawDamage: damageInfo.rawDamage,
    finalDamage: damageResult.effectiveDamage,
    hpBefore: damageResult.hpBefore,
    hpAfter: damageResult.hpAfter,
    shieldBefore: damageResult.shieldBefore,
    shieldAfter: damageResult.shieldAfter,
    isCrit: damageInfo.isCrit,
    isMiss: damageInfo.isMiss,
    fatigueSnapshot: {
      actorFatigue: actor.fatigue ?? 0,
      targetFatigue: target.fatigue ?? 0
    },
    stateSnapshot: state.units.map((u) => ({
      uid: u.uid,
      side: u.side,
      name: u.name,
      image_url: u.image_url ?? null,
      position: u.position,
      rangeType: u.rangeType,
      hp: u.hp,
      maxHp: u.maxHp,
      alive: u.alive,
      atb: u.atb,
      shield: getShieldTotal(u),
      buffs: (u.buffs || []).map((b) => ({
        type: b.type,
        remainingActions: b.remainingActions
      })),
      debuffs: (u.debuffs || []).map((d) => ({
        type: d.type,
        remainingActions: d.remainingActions
      }))
    }))
  };

  logEventFn(state, event);
  if (damageResult.died && !damageResult.selfResurrected) {
    logEventFn(state, {
      type: 'unit_ko',
      sourceId: damageResult.koSourceId ?? target.combatIndex,
      sourceName: damageResult.koSourceName ?? target.name,
      targetId: target.combatIndex
    });
  }

  // Lifesteal (buff LIFESTEAL ou BERSERKERS) est appliqué dans applyDamageToTarget pour basic et skills
  decrementSkillCooldownsOnBasic(actor);

  if (damageResult.died && !damageResult.selfResurrected) {
    onKillSynergies(state, actor, target, (e) => logEvent(state, e));
  }

  if (target) {
    handlePassiveTrigger(state, actor, 'ON_ATTACK', { target }, (ev) => logEventFn(state, ev));
  }

  handlePassiveTrigger(state, actor, 'ON_ACTION_END', { target }, (ev) => logEventFn(state, ev));
  decrementPassiveCooldowns(actor);
  tickStatuses(state, actor, (e) => logEvent(state, e));
  onUnitActionEndSynergies(state, actor, (e) => logEvent(state, e));
}

/**
 * Marque de mort : explosion 90 % PV max quand la durée passe naturellement de 1 → 0 (fin d’action).
 * Pas d’explosion si le debuff a été retiré avant (ex. CLEANSE).
 */
function procDeathMarkExplosion(state, target, dm) {
  if (!target?.alive) return;
  let sourceActor = null;
  const idx = dm.meta?.sourceCombatIndex;
  if (idx != null) {
    sourceActor = state.units.find((u) => Number(u.combatIndex) === Number(idx));
  }
  if (!sourceActor || !sourceActor.alive) {
    sourceActor = target;
  }
  const dmg = Math.round((target.maxHp || 0) * 0.9);
  if (dmg <= 0) return;
  if (state.logEvent) {
    state.logEvent(state, { type: 'death_mark_explode', targetId: target.combatIndex, damage: dmg });
  }
  const res = applyDamageToTarget(state, sourceActor, target, dmg, { damageSource: 'DEATH_MARK', deathMarkExplosion: true });
  if (res.died && !res.selfResurrected && state.logEvent) {
    state.logEvent(state, {
      type: 'unit_ko',
      sourceId: res.koSourceId ?? target.combatIndex,
      sourceName: res.koSourceName ?? target.name,
      targetId: target.combatIndex
    });
  }
}

function tickStatuses(state, actor, logEventFn) {
  const deathMarkExpiring = (actor.debuffs || [])
    .filter((d) => (d.type || d.key || '').toUpperCase() === 'DEATH_MARK' && d.remainingActions === 1)
    .map((d) => ({ sourceId: d.sourceId, meta: d.meta || {} }));

  const buffsBefore = (actor.buffs || []).map((b) => ({ type: b.type || b.key, remaining: b.remainingActions }));
  const debuffsBefore = (actor.debuffs || []).map((d) => ({ type: d.type || d.key, remaining: d.remainingActions }));
  onUnitActionEnd(actor);

  for (const dm of deathMarkExpiring) {
    const still = (actor.debuffs || []).some(
      (d) => (d.type || d.key || '').toUpperCase() === 'DEATH_MARK' && d.sourceId === dm.sourceId
    );
    if (!still) {
      procDeathMarkExplosion(state, actor, dm);
    }
  }

  const actorId = actor.combatIndex;
  for (const b of actor.buffs || []) {
    const t = b.type || b.key;
    logEventFn({ type: 'buff_tick', sourceId: actorId, meta: { buffType: t, remainingActions: b.remainingActions } });
  }
  for (const prev of buffsBefore) {
    const stillThere = (actor.buffs || []).some((b) => (b.type || b.key) === prev.type);
    if (!stillThere) {
      logEventFn({ type: 'buff_remove', sourceId: actorId, meta: { buffType: prev.type } });
    }
  }
  for (const d of actor.debuffs || []) {
    const t = d.type || d.key;
    logEventFn({ type: 'debuff_tick', sourceId: actorId, meta: { debuffType: t, remainingActions: d.remainingActions } });
  }
  for (const prev of debuffsBefore) {
    const stillThere = (actor.debuffs || []).some((d) => (d.type || d.key) === prev.type);
    if (!stillThere) {
      logEventFn({ type: 'debuff_remove', sourceId: actorId, meta: { debuffType: prev.type } });
    }
  }
}

/**
 * Après proc REGEN + DOT au début du tour : décrémente uniquement les durées REGEN / DOT.
 * (Les autres buffs/debuffs continuent de tick à la fin de l’action via tickStatuses.)
 */
function tickRegenAndDotAfterProc(state, actor, logEventFn) {
  const buffsBefore = (actor.buffs || [])
    .filter((b) => (b.type || b.key || '').toUpperCase() === 'REGEN')
    .map((b) => ({ type: b.type || b.key, remaining: b.remainingActions }));
  const debuffsBefore = (actor.debuffs || [])
    .filter((d) => (d.type || d.key || '').toUpperCase() === 'DOT')
    .map((d) => ({ type: d.type || d.key, remaining: d.remainingActions }));
  decrementRegenAndDotDurationsAfterProc(actor);
  const actorId = actor.combatIndex;
  for (const b of actor.buffs || []) {
    if ((b.type || b.key || '').toUpperCase() !== 'REGEN') continue;
    const t = b.type || b.key;
    logEventFn({ type: 'buff_tick', sourceId: actorId, meta: { buffType: t, remainingActions: b.remainingActions } });
  }
  for (const prev of buffsBefore) {
    const stillThere = (actor.buffs || []).some((b) => (b.type || b.key) === prev.type);
    if (!stillThere) {
      logEventFn({ type: 'buff_remove', sourceId: actorId, meta: { buffType: prev.type } });
    }
  }
  for (const d of actor.debuffs || []) {
    if ((d.type || d.key || '').toUpperCase() !== 'DOT') continue;
    const t = d.type || d.key;
    logEventFn({ type: 'debuff_tick', sourceId: actorId, meta: { debuffType: t, remainingActions: d.remainingActions } });
  }
  for (const prev of debuffsBefore) {
    const stillThere = (actor.debuffs || []).some((d) => (d.type || d.key) === prev.type);
    if (!stillThere) {
      logEventFn({ type: 'debuff_remove', sourceId: actorId, meta: { debuffType: prev.type } });
    }
  }
}

function decrementPassiveCooldowns(unit) {
  if (!unit?.passiveCooldowns || typeof unit.passiveCooldowns !== 'object') return;
  for (const key of Object.keys(unit.passiveCooldowns)) {
    const v = unit.passiveCooldowns[key];
    if (typeof v === 'number' && v > 0) unit.passiveCooldowns[key] = v - 1;
  }
}

const SUPPORTED_PASSIVE_TRIGGERS = [
  'ON_ATTACK',
  'ON_HIT',
  'ON_DEATH',
  'ON_KILL',
  'ON_ACTION_START',
  'ON_ACTION_END',
  'ON_RECEIVE_DAMAGE',
  'ON_DEAL_DAMAGE',
  'ON_COMBAT_START',
  'ON_ENEMY_KO',
  'ON_ALLY_KO',
  'ON_ALLY_RECEIVE_DAMAGE',
  'ON_ENEMY_TURN_START',
  /** Déclenché en plus du trigger courant à chaque appel handlePassiveTrigger (sauf si l’événement est déjà ALWAYS). */
  'ALWAYS'
];

/**
 * Ajoute specA_passive / specB_passive (JSON unité) au même flux que les PASSIVE de skill_data.
 * Ignore les objets purement descriptifs sans trigger / effets / passiveKind.
 */
function mergeSpecPassiveIntoPassiveSkills(base, specPassive) {
  const list = Array.isArray(base) ? [...base] : [];
  if (specPassive == null) return list;
  const extras = Array.isArray(specPassive) ? specPassive : [specPassive];
  for (const p of extras) {
    if (!p || typeof p !== 'object') continue;
    const trig = String(p.trigger ?? p.type ?? '').toUpperCase().trim();
    const hasTrigger = SUPPORTED_PASSIVE_TRIGGERS.includes(trig);
    const hasEffects = Array.isArray(p.effects) && p.effects.length > 0;
    const hasSingleEffect = p.effect && typeof p.effect === 'object';
    const hasPermanentKind = String(p.passiveKind ?? '').trim() !== '';
    if (!hasTrigger && !hasEffects && !hasSingleEffect && !hasPermanentKind) continue;
    list.push(p);
  }
  return list;
}

/**
 * Passifs permanents (pas de proc) : flags sur l'unité de combat.
 * passiveKind: DEBUFF_IMMUNITY — immunise aux débuffs, STRIP, REDUCE_ATB, SET_SKILL_COOLDOWN_MAX, CD_UP,
 * vol de stats (STEAL_STAT côté cible), etc. (pas aux dégâts / soins / CLEANSE alliée ni CD_DOWN).
 * STEEL — value: % réduction dégâts directs (stocké ici en ratio 0–0.95).
 * MULTI_HIT_SHIELD — value: nombre de sources de dégâts absorbées par tour (tous types : directs, DoT, etc.) ; le compteur est réinitialisé au début de chaque tour de l’unité.
 */
function extractPermanentPassiveTraits(rawList) {
  const flags = { debuffImmunity: false, steelDamageReductionPercent: 0, multiHitShieldHitsRemaining: 0, multiHitShieldHitsMax: 0 };
  if (!Array.isArray(rawList)) return flags;
  for (const p of rawList) {
    if (!p || typeof p !== 'object') continue;
    const kind = String(p.passiveKind ?? p.kind ?? '').toUpperCase().trim();
    if (kind === 'DEBUFF_IMMUNITY' || p.permanentDebuffImmunity === true || p.immuneToAllDebuffs === true) {
      flags.debuffImmunity = true;
    }
    if (kind === 'STEEL') {
      let v = Number(p.value);
      if (!Number.isFinite(v)) v = 0;
      if (v > 1) v /= 100;
      v = Math.max(0, Math.min(0.95, v));
      flags.steelDamageReductionPercent = Math.max(flags.steelDamageReductionPercent, v);
    }
    if (kind === 'MULTI_HIT_SHIELD') {
      let hits = Math.floor(Number(p.value));
      if (!Number.isFinite(hits) || hits < 0) hits = 0;
      flags.multiHitShieldHitsRemaining = Math.max(flags.multiHitShieldHitsRemaining, hits);
    }
  }
  flags.multiHitShieldHitsMax = flags.multiHitShieldHitsRemaining;
  return flags;
}

/**
 * Déclenche les passifs ON_COMBAT_START pour toutes les unités vivantes,
 * dans l'ordre de la vitesse effective décroissante (en cas d'égalité : orderIndex).
 * Appelé après init ATB et effets runtime de début de combat (synergies / artefacts).
 */
function applyCombatStartPassives(state, logEventFn) {
  if (!state?.units?.length) return;
  const log = typeof logEventFn === 'function' ? logEventFn : () => {};
  const actors = state.units.filter(
    (u) => u.alive && (u.passives || []).some((p) => String(p?.trigger || '').toUpperCase() === 'ON_COMBAT_START')
  );
  actors.sort((a, b) => {
    const sa = getEffectiveCombatStats(a).speed;
    const sb = getEffectiveCombatStats(b).speed;
    if (sb !== sa) return sb - sa;
    return (a.orderIndex ?? 0) - (b.orderIndex ?? 0);
  });
  for (const actor of actors) {
    handlePassiveTrigger(state, actor, 'ON_COMBAT_START', { state }, log);
  }
}

/**
 * Normalise un tableau de passifs (legacy ou nouveau format) vers { trigger, effects, cooldown }.
 * Legacy : { type: 'ON_ATTACK', effect: {...} } ou { type: 'SELF_RESURRECT', percentHP, cd_actions }.
 */
function normalizePassives(rawList) {
  if (!Array.isArray(rawList)) return [];
  const out = [];
  for (let i = 0; i < rawList.length; i++) {
    const p = rawList[i];
    if (!p || typeof p !== 'object') continue;
    const triggerRaw = (p.trigger ?? p.type ?? '').toString().toUpperCase().trim();
    const trigger = SUPPORTED_PASSIVE_TRIGGERS.includes(triggerRaw) ? triggerRaw : null;
    if (!trigger) continue;

    let effects = [];
    let cooldown = typeof p.cooldown === 'number' && p.cooldown >= 0 ? p.cooldown : undefined;

    if (triggerRaw === 'SELF_RESURRECT') {
      const pct = p.percentHP ?? p.percent ?? p.percentHp ?? 0.3;
      effects = [{ type: 'RESURRECT', target: 'SELF', percentHp: pct, percent: pct }];
      if (cooldown === undefined && (p.cd_actions != null || p.cooldown != null)) {
        cooldown = Math.max(0, Number(p.cd_actions ?? p.cooldown ?? 5));
      }
    } else if (Array.isArray(p.effects) && p.effects.length > 0) {
      effects = p.effects;
    } else if (p.effect && typeof p.effect === 'object') {
      effects = [p.effect];
    }

    if (effects.length > 0) {
      out.push({ trigger, effects, cooldown: cooldown ?? 0 });
    }
  }
  return out;
}

/**
 * Résout la cible pour un effet de passif selon effect.target (SELF, TARGET, TEAM_ALLY, TEAM_ENEMY, ENEMY_SINGLE).
 * ENEMY_SINGLE est résolu contextuellement :
 *   - ON_ATTACK → l'ennemi attaqué (context.target)
 *   - ON_RECEIVE_DAMAGE → context.source = attaquant ; context.target = défenseur touché (porteur du passif)
 *   - ON_ENEMY_KO → l'ennemi mis KO (context.victim)
 *   - ON_ALLY_KO → le tueur (context.killer)
 *   - ON_ALLY_RECEIVE_DAMAGE → l'attaquant ayant blessé l'allié (context.source)
 *   - ON_ENEMY_TURN_START → l'ennemi dont le tour commence (context.turnActor)
 *   - ALLY_SINGLE peut aussi être contextuel selon le trigger.
 */
function resolvePassiveEffectTargets(state, actor, effect, context) {
  const targetKey = (effect?.target ?? '').toString().toUpperCase().trim();
  const units = state?.units ?? [];
  const triggerType = (context?.triggerType ?? '').toString().toUpperCase();

  if (targetKey === 'TARGET' && triggerType === 'ON_ALLY_KO' && context?.victim) {
    const v = context.victim;
    return v ? [v] : [];
  }
  if (targetKey === 'TARGET' && triggerType === 'ON_ENEMY_KO' && context?.victim) {
    const v = context.victim;
    return v ? [v] : [];
  }

  if (targetKey === 'SELF') {
    // RESURRECT sur SELF (ex. passif SELF_RESURRECT) : la cible est l'acteur même s'il est mort.
    if (effect?.type === 'RESURRECT' && actor) return [actor];
    return actor?.alive ? [actor] : [];
  }
  if (targetKey === 'TARGET' && context?.target) {
    const t = context.target;
    const arr = Array.isArray(t) ? t : [t];
    return arr.filter((u) => u && u.alive);
  }
  if (targetKey === 'ENEMY_SINGLE') {
    // ON_ATTACK, ON_HIT, ON_DEAL_DAMAGE, ON_KILL : cibler l'ennemi attaqué/touché/tué (context.target)
    if (['ON_ATTACK', 'ON_HIT', 'ON_DEAL_DAMAGE', 'ON_KILL'].includes(triggerType) && context?.target) {
      const t = context.target;
      const u = Array.isArray(t) ? t[0] : t;
      if (u && u.alive && u.side !== actor.side) return [u];
    }
    // ON_RECEIVE_DAMAGE : cibler l'ennemi qui a infligé les dégâts (context.source)
    if (triggerType === 'ON_RECEIVE_DAMAGE' && context?.source) {
      const u = context.source;
      if (u && u.alive && u.side !== actor.side) return [u];
    }
    if (triggerType === 'ON_ENEMY_KO' && context?.victim) {
      const v = context.victim;
      if (v && v.side !== actor.side) return [v];
    }
    if (triggerType === 'ON_ALLY_KO' && context?.killer) {
      const k = context.killer;
      if (k && k.alive && k.side !== actor.side) return [k];
    }
    if (triggerType === 'ON_ALLY_RECEIVE_DAMAGE' && context?.source) {
      const u = context.source;
      if (u && u.alive && u.side !== actor.side) return [u];
    }
    if (triggerType === 'ON_ENEMY_TURN_START' && context?.turnActor) {
      const u = context.turnActor;
      if (u && u.alive && u.side !== actor.side) return [u];
    }
    // Autres triggers : fallback sur resolveTargets
  }
  if (targetKey === 'ALLY_SINGLE') {
    if (triggerType === 'ON_ALLY_RECEIVE_DAMAGE' && context?.target) {
      const t = context.target;
      const u = Array.isArray(t) ? t[0] : t;
      if (u && u.alive && u.side === actor.side && u.uid !== actor.uid) return [u];
    }
  }
  if (targetKey === 'TEAM_ALLY') {
    return units.filter((u) => u.side === actor.side && u.alive);
  }
  if (targetKey === 'TEAM_ENEMY') {
    return units.filter((u) => u.side !== actor.side && u.alive);
  }
  // ON_RECEIVE_DAMAGE : sans clé `target`, resolveTargets('') ciblait un ennemi — tous les effets
  // (ATB_UP, APPLY_BUFF / DEF_UP, HEAL, etc.) s'appliquent au défenseur (porteur du passif).
  if (triggerType === 'ON_RECEIVE_DAMAGE' && !targetKey) {
    return actor?.alive ? [actor] : [];
  }
  // Autres triggers : sans `target`, ATB_UP / REDUCE_ATB → porteur (évite resolveTargets → ennemi).
  const effType = String(effect?.type ?? '').toUpperCase();
  if (!targetKey && (effType === 'ATB_UP' || effType === 'REDUCE_ATB')) {
    const selfDefaultTriggers = [
      'ON_ACTION_START',
      'ON_ACTION_END',
      'ON_COMBAT_START',
      'ON_DEATH',
      'ON_HIT',
      'ON_DEAL_DAMAGE',
      'ON_ATTACK',
      'ON_KILL',
      'ON_ALLY_RECEIVE_DAMAGE',
      'ON_ENEMY_TURN_START',
      'ON_ALLY_KO',
      'ON_ENEMY_KO',
      'ALWAYS'
    ];
    if (selfDefaultTriggers.includes(triggerType)) {
      return actor?.alive ? [actor] : [];
    }
  }
  return resolveTargets(state, actor, effect);
}

/**
 * Libellés français pour les messages de log (effets buff/debuff).
 * Phrase du type : "X [phrase] Y." ou "X [phrase] Y (N tours)."
 */
const EFFECT_PHRASE_FR = {
  ATB_UP: { phrase: "augmente l'ATB de", withDuration: false },
  RESET_SKILL_COOLDOWN: { phrase: 'remet le temps de recharge de', withDuration: false },
  SET_SKILL_COOLDOWN_MAX: { phrase: 'remet le temps de recharge de', withDuration: false },
  ATK_UP: { phrase: "augmente l'attaque de", withDuration: true },
  DEF_UP: { phrase: 'augmente la défense de', withDuration: true },
  SPEED_UP: { phrase: 'augmente la vitesse de', withDuration: true },
  SPEED: { phrase: 'augmente la vitesse de', withDuration: true },
  SPD_UP: { phrase: 'augmente la vitesse de', withDuration: true },
  REGEN: { phrase: 'applique une regeneration a', withDuration: true },
  CRIT_UP: { phrase: 'augmente les dégâts critiques de', withDuration: true },
  IMMUNITY: { phrase: 'accorde l\'immunité à', withDuration: true },
  INVINCIBILITY: { phrase: 'rend invulnérable', withDuration: true },
  SHIELD: { phrase: 'applique un bouclier à', withDuration: true },
  DEFEND: { phrase: 'protège', withDuration: true },
  HEAL: { phrase: 'soigne', withDuration: false },
  ATK_DOWN: { phrase: "réduit l'attaque de", withDuration: true },
  DEF_DOWN: { phrase: 'réduit la défense de', withDuration: true },
  SLOW: { phrase: 'ralentit', withDuration: true },
  SPEED_DOWN: { phrase: 'réduit la vitesse de', withDuration: true },
  SILENCE: { phrase: 'réduit au silence', withDuration: true },
  BLIND: { phrase: 'aveugle', withDuration: true },
  STUN: { phrase: 'étourdit', withDuration: true },
  PROVOKE: { phrase: 'provoque', withDuration: true },
  PROVOCATION: { phrase: 'provoque', withDuration: true },
  ANTI_HEAL: { phrase: "inflige l'anti-soin à", withDuration: true },
  ANTI_SHIELD: { phrase: "inflige l'anti-bouclier à", withDuration: true },
  ANTI_BUFF: { phrase: "inflige l'anti-buff à", withDuration: true },
  DOT: { phrase: 'inflige des dégâts sur la durée à', withDuration: true },
  ATB_DOWN: { phrase: "réduit l'ATB de", withDuration: true },
  CD_UP: { phrase: 'retarde le temps de recharge de', withDuration: false },
  CD_DOWN: { phrase: 'réduit le temps de recharge de', withDuration: false }
};

function logEffectApplication(state, actor, effect, targetUnit, logEventFn) {
  const log = typeof logEventFn === 'function' ? logEventFn : () => {};
  const effectType = (effect?.buffType || effect?.debuffType || effect?.type || '').toString().toUpperCase();
  const targetName = targetUnit?.name ?? 'inconnu';
  const actorName = actor?.name ?? '?';
  const duration = effect?.remainingActions ?? effect?.duration ?? 0;
  const valuePct = effect?.value != null ? (Number(effect.value) <= 1 ? Math.round(Number(effect.value) * 100) : Number(effect.value)) : null;
  const isSelf = (actor?.uid && actor.uid === targetUnit?.uid) || (actor?.combatIndex != null && actor.combatIndex === targetUnit?.combatIndex);

  let message;
  const entry = EFFECT_PHRASE_FR[effectType];
  if (entry) {
    const durStr = entry.withDuration && duration ? ` (${duration} tour${duration !== 1 ? 's' : ''})` : '';
    if (effectType === 'RESET_SKILL_COOLDOWN') {
      message = `${actorName} remet le temps de recharge de ${targetName} a 0.`;
    } else if (effectType === 'SET_SKILL_COOLDOWN_MAX') {
      const baseCooldown = getUnitBaseSkillCooldown(targetUnit);
      message = `${actorName} remet le temps de recharge de ${targetName} a ${baseCooldown}.`;
    } else if (effectType === 'CD_UP') {
      const d = effect?.value ?? 0;
      message = `${actorName} retarde le temps de recharge de ${targetName} de ${d} tour(s).`;
    } else if (effectType === 'CD_DOWN') {
      const d = effect?.value ?? 0;
      message = `${actorName} réduit le temps de recharge de ${targetName} de ${d} tour(s).`;
    } else if (isSelf && (effectType === 'IMMUNITY' || effectType === 'ATK_UP' || effectType === 'DEF_UP' || effectType === 'SPEED' || effectType === 'SPEED_UP' || effectType === 'SPD_UP')) {
      const stat = effectType === 'ATK_UP' ? "l'attaque" : effectType === 'DEF_UP' ? 'la défense' : 'la vitesse';
      const pct = valuePct ?? (effectType === 'SPEED' || effectType === 'SPEED_UP' || effectType === 'SPD_UP' ? 30 : 50);
      message = `${actorName} gagne ${stat} +${pct}% (${duration} tours).`;
    } else if (effectType === 'IMMUNITY') {
      message = isSelf ? `${actorName} gagne l'immunité (${duration} tours).` : `${actorName} accorde l'immunité à ${targetName} (${duration} tours).`;
    } else {
      message = `${actorName} ${entry.phrase} ${targetName}${durStr}.`;
    }
  } else if (effectType === 'ATK_UP' || effectType === 'DEF_UP' || effectType === 'SPEED' || effectType === 'SPEED_UP') {
    const stat = effectType === 'ATK_UP' ? "l'attaque" : effectType === 'DEF_UP' ? 'la défense' : 'la vitesse';
    const pct = valuePct ?? (effectType === 'SPEED' || effectType === 'SPEED_UP' ? 30 : 50);
    if (isSelf) {
      message = `${actorName} gagne ${stat} +${pct}% (${duration} tours).`;
    } else {
      message = `${actorName} augmente ${stat} de ${targetName} (${duration} tours).`;
    }
  } else {
    const fallback = effectType ? `${actorName} applique un effet à ${targetName}.` : `${actorName} applique un effet à ${targetName}.`;
    message = fallback;
  }

  log({
    type: 'EFFECT_APPLY',
    message,
    actor: actor?.combatIndex,
    target: targetUnit?.combatIndex,
    effectType,   // valeur calculée : 'ATK_UP', 'ATK_DOWN', 'HEAL', etc. (pas 'APPLY_BUFF')
    effectCategory: effect?.type ?? null, // 'APPLY_BUFF', 'APPLY_DEBUFF', 'HEAL', etc.
    applied: true
  });
}

/**
 * Passifs « témoins » quand une unité meurt (alliés : ON_ALLY_KO, ennemis du défunt : ON_ENEMY_KO).
 * @param {object|null} killer - Attaquant ayant porté le coup final ; peut être null (ex. DOT sans source).
 */
function fireKoObserverPassives(state, victim, killer, logEventFn) {
  if (!state || !victim) return;
  const log = typeof logEventFn === 'function' ? logEventFn : () => {};
  const ctx = { victim, killer: killer ?? null, source: killer ?? null };
  for (const u of state.units) {
    if (!u.alive || u.uid === victim.uid) continue;
    if (u.side === victim.side) {
      handlePassiveTrigger(state, u, 'ON_ALLY_KO', ctx, log);
    } else {
      handlePassiveTrigger(state, u, 'ON_ENEMY_KO', ctx, log);
    }
  }
}

/**
 * Applique les passifs d'une unité pour un trigger donné. Tout passe par applySkillEffect.
 * Plusieurs effets dans le passif : même ordre d’exécution et chaînage (scaleFromEffectIndex, etc.) que pour une compétence active.
 * La cible est résolue par effet (SELF → actor, TARGET → context.target, etc.).
 * context : { target?, source?, state } selon le trigger.
 */
function handlePassiveTrigger(state, actor, triggerType, context, logEventFn) {
  if (!state || !actor || !triggerType) return;
  const passives = Array.isArray(actor.passives) ? actor.passives : [];
  const triggerUpper = String(triggerType).toUpperCase();
  const matchExact = passives.filter((p) => p && String(p.trigger || '').toUpperCase() === triggerUpper);
  const matchAlways =
    triggerUpper === 'ALWAYS'
      ? []
      : passives.filter((p) => p && String(p.trigger || '').toUpperCase() === 'ALWAYS');
  const list = triggerUpper === 'ALWAYS' ? matchExact : [...matchAlways, ...matchExact];
  const log = typeof logEventFn === 'function' ? logEventFn : () => {};

  for (let idx = 0; idx < list.length; idx++) {
    const passive = list[idx];
    const pTrig = String(passive.trigger || '').toUpperCase() || triggerUpper;
    const cdKey = `passive_${pTrig}_${idx}`;
    const cd = actor.passiveCooldowns?.[cdKey];
    if (cd !== undefined && cd !== null && Number(cd) > 0) continue;

    const effects = passive.effects || [];
    if (effects.length === 0) continue;

    const fullContext = { ...context, triggerType };
    const effectTargetsList = effects.map((eff) => ({
      effect: eff,
      targets: resolvePassiveEffectTargets(state, actor, eff, fullContext)
    }));
    const allTargetsSet = new Set();
    effectTargetsList.forEach(({ targets }) => {
      for (const t of targets) {
        if (t) allTargetsSet.add(t);
      }
    });
    const allTargetsOrdered = [...allTargetsSet];
    const resultsPerEffect = effects.map(() => []);

    for (const target of allTargetsOrdered) {
      if (!target) continue;
      for (let i = 0; i < effects.length; i++) {
        const { effect: eff, targets } = effectTargetsList[i];
        if (!targets.includes(target)) continue;
        if (!target.alive && eff.type !== 'RESURRECT') continue;

        const { effToApply, chainMeta } = resolveChainedEffectForTarget(eff, resultsPerEffect, i, target, actor);
        const res = applySkillEffect(state, actor, target, effToApply);
        if (res?.applied) logEffectApplication(state, actor, effToApply, target, log);

        resultsPerEffect[i].push({
          targetUid: target.uid,
          targetCombatIndex: target.combatIndex,
          targetName: target.name,
          targetSide: target.side,
          ...(chainMeta || {}),
          ...res
        });

        const payload = {
          type: 'passive',
          passiveType: triggerUpper,
          passiveTrigger: pTrig,
          actor: actor.combatIndex,
          target: target.combatIndex,
          effect: eff?.type,
          applied: res?.applied
        };
        if (eff?.type === 'RESURRECT' && res?.applied && target.hp != null) payload.hpAfter = target.hp;
        log(payload);
      }
    }
    if (passive.cooldown != null && Number(passive.cooldown) > 0) {
      actor.passiveCooldowns = actor.passiveCooldowns || {};
      actor.passiveCooldowns[cdKey] = Number(passive.cooldown);
    }
  }
}

function resurrectUnit(state, unit, percentHP = 0.3) {
  if (!unit || unit.alive) return false;
  const maxHp = unit.maxHp || unit.base_hp || 0;
  if (maxHp <= 0) return false;
  const newHp = Math.max(1, Math.floor(maxHp * percentHP));
  setUnitHp(unit, newHp, state);
  unit.atb = 0;
  unit.buffs = [];
  unit.debuffs = [];
  if (state) state.lastResurrectedUnit = unit;
  return true;
}

/**
 * Unifie toutes les compétences vers skill.effects.
 * Convertit les types legacy (DAMAGE_SINGLE, SHIELD_SELF, APPLY_DEBUFF, etc.) en effet(s) synthétique(s).
 */
/**
 * Métrique lue sur le résultat d’un effet précédent (même liste d’effets : active ou passif, même cible).
 * - removedCount : champ `removed` (débuffs retirés par CLEANSE, buffs retirés par STRIP).
 */
function getScaledMetricFromPriorResult(prior, metric) {
  if (!prior) return 0;
  const m = (metric || 'removedCount').toString();
  if (m === 'removedCount') {
    return Math.max(0, Math.floor(Number(prior.removed ?? 0) || 0));
  }
  if (m === 'effectiveDamage') {
    return Math.max(0, Number(prior.effectiveDamage ?? prior.damage ?? 0) || 0);
  }
  return Math.max(0, Math.floor(Number(prior.removed ?? 0) || 0));
}

/** Lit `scaleMetric` sur l’effet à l’index `scaleFromEffectIndex` pour la même cible (skill ou passif multi-effets). */
function getChainScaleN(eff, resultsPerEffect, effectIndex, targetUid) {
  const scaleIdxRaw = eff.scaleFromEffectIndex;
  if (scaleIdxRaw == null || scaleIdxRaw === '') return 0;
  const idx = Number(scaleIdxRaw);
  if (!Number.isInteger(idx) || idx < 0 || idx >= effectIndex) return 0;
  const row = resultsPerEffect[idx];
  const prior = Array.isArray(row) ? row.find((r) => r.targetUid === targetUid) : null;
  return getScaledMetricFromPriorResult(prior, eff.scaleMetric);
}

function stripChainScalingFields(eff) {
  if (!eff || typeof eff !== 'object') return eff;
  const out = { ...eff };
  delete out.scaleFromEffectIndex;
  delete out.scaleMetric;
  delete out.percentPerRemoved;
  delete out.valuePerRemoved;
  return out;
}

/** SHIELD / HEAL / REGEN : montant de base (flat ou % PV). */
function computeHealShieldRegenBaseAmount(cfg, target, actor) {
  const flatRaw = cfg.value ?? 0;
  const flat = Number(flatRaw) || 0;
  let pct = cfg.percentMaxHp ?? cfg.percent ?? 0;
  let maxHp = target.maxHp ?? 0;
  if (cfg.percentMaxHpCaster != null) {
    pct = cfg.percentMaxHpCaster;
    maxHp = actor?.maxHp ?? 0;
  }
  if (flat > 0) return Math.max(0, flat);
  return Math.max(0, Math.round(maxHp * (pct > 1 ? pct / 100 : pct)));
}

/**
 * ATB_UP et REDUCE_ATB : % barre = percent (base) + percentPerRemoved × métrique (effet précédent, même cible).
 */
function resolveAtbBarDeltaPercentForTarget(eff, resultsPerEffect, effectIndex, targetUid) {
  // Virgule décimale (ex. "0,2" depuis l’UI) : Number("0,2") est NaN sans normalisation.
  let basePct = normalizeDecimal(eff.percent ?? eff.value ?? 0);
  if (typeof basePct === 'string') {
    const n = parseFloat(String(basePct).replace(/,/g, '.'));
    basePct = Number.isFinite(n) ? n : 0;
  }
  if (basePct > 1) basePct = basePct / 100;
  basePct = Math.max(0, Math.min(1, Number(basePct) || 0));
  const n = getChainScaleN(eff, resultsPerEffect, effectIndex, targetUid);
  let per = normalizeDecimal(eff.percentPerRemoved ?? 0);
  if (typeof per === 'string') {
    const npr = parseFloat(String(per).replace(/,/g, '.'));
    per = Number.isFinite(npr) ? npr : 0;
  }
  if (per > 1) per = per / 100;
  per = Math.max(0, Number(per) || 0);
  const total = Math.min(1, basePct + per * n);
  const merged = stripChainScalingFields({ ...eff, percent: total });
  merged.percent = total;
  return { merged, effectivePercent: total, scaledCount: n };
}

function resolveAtbUpEffectForTarget(eff, resultsPerEffect, effectIndex, targetUid) {
  return resolveAtbBarDeltaPercentForTarget(eff, resultsPerEffect, effectIndex, targetUid);
}

function resolveReduceAtbEffectForTarget(eff, resultsPerEffect, effectIndex, targetUid) {
  return resolveAtbBarDeltaPercentForTarget(eff, resultsPerEffect, effectIndex, targetUid);
}

function resolveHealEffectForTarget(eff, resultsPerEffect, effectIndex, target, actor) {
  const n = getChainScaleN(eff, resultsPerEffect, effectIndex, target.uid);
  const vpr = Math.max(0, Number(eff.valuePerRemoved) || 0);
  const bonus = Math.round(vpr * n);
  const stripped = stripChainScalingFields({ ...eff });
  const cfg = normalizeEffectConfig(stripped);
  const baseAmt = computeHealShieldRegenBaseAmount(cfg, target, actor);
  const total = Math.max(0, baseAmt + bonus);
  const merged = {
    ...stripped,
    value: total,
    percentMaxHp: undefined,
    percent: undefined,
    percentMaxHpCaster: undefined
  };
  return { merged, scaledCount: n };
}

/** DAMAGE : dégâts de base + valuePerRemoved × métrique (ex. buffs retirés par STRIP). */
function resolveDamageEffectForTarget(eff, resultsPerEffect, effectIndex, target, actor) {
  const n = getChainScaleN(eff, resultsPerEffect, effectIndex, target.uid);
  const vpr = Math.max(0, Number(eff.valuePerRemoved) || 0);
  const bonus = Math.round(vpr * n);
  const merged = stripChainScalingFields({ ...eff });
  if (bonus > 0) merged._flatDamageBonus = bonus;
  return { merged, scaledCount: n };
}

function resolveShieldOrRegenEffectForTarget(eff, resultsPerEffect, effectIndex, target, actor) {
  const n = getChainScaleN(eff, resultsPerEffect, effectIndex, target.uid);
  const vpr = Math.max(0, Number(eff.valuePerRemoved) || 0);
  const bonus = Math.round(vpr * n);
  const stripped = stripChainScalingFields({ ...eff });
  const cfg = normalizeEffectConfig(stripped);
  const buffType = (cfg.buffType || '').toString().toUpperCase();
  let baseAmt = 0;
  if (buffType === 'SHIELD') {
    let pct = 0;
    let maxHp = 0;
    if (cfg.percentMaxHp != null) { pct = cfg.percentMaxHp; maxHp = target.maxHp ?? 0; }
    else if (cfg.percentMaxHpCaster != null) { pct = cfg.percentMaxHpCaster; maxHp = actor?.maxHp ?? 0; }
    else if (cfg.percent != null) { pct = cfg.percent; maxHp = target.maxHp ?? 0; }
    const flat = (cfg.value != null && Number(cfg.value) > 0) ? Number(cfg.value) : 0;
    baseAmt = flat > 0 ? flat : Math.max(0, Math.round(maxHp * (pct > 1 ? pct / 100 : pct)));
  } else {
    baseAmt = computeHealShieldRegenBaseAmount(cfg, target, actor);
  }
  const total = Math.max(0, baseAmt + bonus);
  const merged = {
    ...stripped,
    value: total,
    percentMaxHp: undefined,
    percent: undefined,
    percentMaxHpCaster: undefined
  };
  return { merged, scaledCount: n };
}

/** DOT : 1 stack + floor(valuePerRemoved × n) stacks bonus (même durée/valeur). */
function resolveDotBuffEffectForTarget(eff, resultsPerEffect, effectIndex, targetUid) {
  const n = getChainScaleN(eff, resultsPerEffect, effectIndex, targetUid);
  const vpr = Math.max(0, Number(eff.valuePerRemoved) || 0);
  const extra = Math.floor(vpr * n);
  const merged = stripChainScalingFields({ ...eff });
  if (extra > 0) merged._dotExtraStacks = extra;
  return { merged, scaledCount: n };
}

/** ANTI_BUFF : durée += floor(valuePerRemoved × n). */
function resolveAntiBuffEffectForTarget(eff, resultsPerEffect, effectIndex, targetUid) {
  const n = getChainScaleN(eff, resultsPerEffect, effectIndex, targetUid);
  const vpr = Math.max(0, Number(eff.valuePerRemoved) || 0);
  const extra = Math.floor(vpr * n);
  const merged = stripChainScalingFields({ ...eff });
  if (extra > 0) merged._durationBonusFromScale = extra;
  return { merged, scaledCount: n };
}

/**
 * Effet chaîné : même logique pour compétence active (performSkillAction) et passif multi-effets (handlePassiveTrigger).
 * `resultsPerEffect` accumule les résultats des effets précédents pour la même cible.
 */
function resolveChainedEffectForTarget(eff, resultsPerEffect, effectIndex, target, actor) {
  let effToApply = eff;
  let chainMeta = null;
  if (eff.type === 'ATB_UP') {
    const resolved = resolveAtbUpEffectForTarget(eff, resultsPerEffect, effectIndex, target.uid);
    effToApply = resolved.merged;
    chainMeta = {
      effectivePercent: resolved.effectivePercent,
      scaledCount: resolved.scaledCount,
      scaleFromEffectIndex: eff.scaleFromEffectIndex != null && eff.scaleFromEffectIndex !== '' ? Number(eff.scaleFromEffectIndex) : null
    };
  } else if (eff.type === 'REDUCE_ATB') {
    const resolved = resolveReduceAtbEffectForTarget(eff, resultsPerEffect, effectIndex, target.uid);
    effToApply = resolved.merged;
    chainMeta = {
      effectivePercent: resolved.effectivePercent,
      scaledCount: resolved.scaledCount,
      scaleFromEffectIndex: eff.scaleFromEffectIndex != null && eff.scaleFromEffectIndex !== '' ? Number(eff.scaleFromEffectIndex) : null
    };
  } else if (eff.type === 'HEAL') {
    const resolved = resolveHealEffectForTarget(eff, resultsPerEffect, effectIndex, target, actor);
    effToApply = resolved.merged;
    chainMeta = {
      scaledCount: resolved.scaledCount,
      scaleFromEffectIndex: eff.scaleFromEffectIndex != null && eff.scaleFromEffectIndex !== '' ? Number(eff.scaleFromEffectIndex) : null
    };
  } else if (eff.type === 'DAMAGE') {
    const resolved = resolveDamageEffectForTarget(eff, resultsPerEffect, effectIndex, target, actor);
    effToApply = resolved.merged;
    chainMeta = {
      scaledCount: resolved.scaledCount,
      scaleFromEffectIndex: eff.scaleFromEffectIndex != null && eff.scaleFromEffectIndex !== '' ? Number(eff.scaleFromEffectIndex) : null
    };
  } else if (eff.type === 'APPLY_BUFF') {
    const bt = (eff.buffType ?? '').toString().toUpperCase();
    if (bt === 'SHIELD' || bt === 'REGEN') {
      const resolved = resolveShieldOrRegenEffectForTarget(eff, resultsPerEffect, effectIndex, target, actor);
      effToApply = resolved.merged;
      chainMeta = {
        scaledCount: resolved.scaledCount,
        scaleFromEffectIndex: eff.scaleFromEffectIndex != null && eff.scaleFromEffectIndex !== '' ? Number(eff.scaleFromEffectIndex) : null
      };
    } else if (bt === 'DOT') {
      const resolved = resolveDotBuffEffectForTarget(eff, resultsPerEffect, effectIndex, target.uid);
      effToApply = resolved.merged;
      chainMeta = {
        scaledCount: resolved.scaledCount,
        scaleFromEffectIndex: eff.scaleFromEffectIndex != null && eff.scaleFromEffectIndex !== '' ? Number(eff.scaleFromEffectIndex) : null
      };
    } else if (bt === 'ANTI_BUFF') {
      const resolved = resolveAntiBuffEffectForTarget(eff, resultsPerEffect, effectIndex, target.uid);
      effToApply = resolved.merged;
      chainMeta = {
        scaledCount: resolved.scaledCount,
        scaleFromEffectIndex: eff.scaleFromEffectIndex != null && eff.scaleFromEffectIndex !== '' ? Number(eff.scaleFromEffectIndex) : null
      };
    }
  }
  return { effToApply, chainMeta };
}

function ensureSkillEffects(skill) {
  if (Array.isArray(skill.effects) && skill.effects.length > 0) return skill;
  const type = String(skill.type || '').toUpperCase().trim();
  let synthetic = null;

  if (type.startsWith('HEAL')) {
    const targetKey = skill.target != null ? String(skill.target).toUpperCase().trim() : 'LOWEST_HP_ALLY';
    synthetic = [{
      type: 'HEAL',
      target: targetKey,
      value: skill.value ?? 0,
      percent: skill.percent ?? skill.mult,
      percentMaxHp: skill.percentMaxHp ?? skill.percent ?? skill.mult
    }];
  } else if (type.startsWith('SHIELD')) {
    const targetKey = skill.target != null ? String(skill.target).toUpperCase().trim() : 'SELF';
    synthetic = [{
      type: 'APPLY_BUFF',
      buffType: 'SHIELD',
      target: targetKey,
      value: skill.value ?? 0,
      percent: skill.percent ?? skill.mult,
      percentMaxHp: skill.percentMaxHp ?? skill.percent ?? skill.mult,
      remainingActions: skill.remainingActions ?? skill.duration ?? 1
    }];
  } else if (type === 'DAMAGE_SINGLE') {
    synthetic = [{
      type: 'DAMAGE',
      target: 'ENEMY_SINGLE',
      mult: skill.mult ?? 1
    }];
  } else if (type === 'DAMAGE_MULTI' || type === 'DAMAGE') {
    const count = skill.count ?? 2;
    synthetic = [{
      type: 'DAMAGE',
      target: 'TEAM_ENEMY',
      count: count,
      mult: skill.mult ?? 1
    }];
  } else if (type === 'APPLY_DEBUFF') {
    const debType = skill.debuff ?? skill.debuffType ?? 'DEBUFF';
    synthetic = [{
      type: 'APPLY_DEBUFF',
      target: 'ENEMY_SINGLE',
      debuffType: EffectType[debType] || debType,
      remainingActions: skill.duration_actions ?? skill.remainingActions ?? 2
    }];
  }

  if (synthetic) skill.effects = synthetic;
  // Format skills[] : type ACTIVE sans tableau d'effets (ou effets vidés par spec) → l'IA et le ciblage
  // exigent au moins un effet ; défaut cohérent avec une compétence active offensive.
  if ((!Array.isArray(skill.effects) || skill.effects.length === 0) && type === 'ACTIVE') {
    skill.effects = [{
      type: 'DAMAGE',
      target: 'ENEMY_SINGLE',
      mult: skill.mult ?? 1
    }];
  }
  return skill;
}

function performSkillAction(state, actor, round, atbBefore, logEventFn, forcedTarget = null, skillSlot = null) {
  let skill;
  if (skillSlot && skillSlot.skill) {
    skill = skillSlot.skill;
  } else {
    const skillContainer = actor.skill;
    skill = skillContainer?.skill ?? skillContainer;
  }
  if (!skill) return false;
  if (!actor.alive) return false;

  skill = ensureSkillEffects(skill);

  if (Array.isArray(actor.activeSkillSlots) && actor.activeSkillSlots.length > 0) {
    if (!skillSlot || skillSlot.legacy === true) {
      const match = actor.activeSkillSlots.find((s) => s.skill === skill);
      if (match) {
        skillSlot = { ...match, skill, legacy: false };
      }
    }
  }

  let event = null;

  // Branche effets (HEAL, SHIELD, etc.) : pas de cible ennemie requise ; pas de fallback vers basic même si 0 cible.
  // Si le 1er effet cible une cible unique (tout sauf TEAM_ALLY / TEAM_ENEMY / TEAM_ALLY_DEAD), les effets suivants en ALLY_SINGLE ou ENEMY_SINGLE visent la même unité (si compatible).
  if (Array.isArray(skill.effects) && skill.effects.length > 0) {
    const allTargetUids = [];
    let lockedSingleTarget = null;
    const effectTargetsList = skill.effects.map((eff) => {
      const targetKey = eff.target != null ? String(eff.target).toUpperCase().trim() : '';
      const isTeamWide =
        targetKey === 'TEAM_ENEMY' || targetKey === 'TEAM_ALLY' || targetKey === 'TEAM_ALLY_DEAD';
      const isSingleTargetType = targetKey && !isTeamWide;
      const cfg = isTeamWide ? { ...eff, ignoreTargetingRules: true } : eff;
      let targets;
      if (targetKey === 'SELF') {
        targets = [actor];
        if (!lockedSingleTarget) lockedSingleTarget = actor;
      } else if (forcedTarget && (targetKey === 'ALLY_SINGLE' || targetKey === 'ENEMY_SINGLE' || targetKey === 'ALLY_DEAD_SINGLE')) {
        // Avant lockedSingleTarget : sinon après un effet SELF, locked = acteur et ENEMY_SINGLE
        // retombait sur resolveTargets (IA) au lieu de la cible manuelle interactive.
        const isAlly = forcedTarget.side === actor.side;
        const isDeadAlly = isAlly && !forcedTarget.alive;
        if ((targetKey === 'ALLY_SINGLE' && isAlly) || (targetKey === 'ENEMY_SINGLE' && !isAlly) || (targetKey === 'ALLY_DEAD_SINGLE' && isDeadAlly)) {
          targets = [forcedTarget];
        } else {
          targets = resolveTargets(state, actor, cfg);
        }
      } else if (lockedSingleTarget && (targetKey === 'ALLY_SINGLE' || targetKey === 'ENEMY_SINGLE' || targetKey === 'ALLY_DEAD_SINGLE')) {
        const isAlly = lockedSingleTarget.side === actor.side;
        const isDeadAlly = isAlly && !lockedSingleTarget.alive;
        if ((targetKey === 'ALLY_SINGLE' && isAlly) || (targetKey === 'ENEMY_SINGLE' && !isAlly) || (targetKey === 'ALLY_DEAD_SINGLE' && isDeadAlly)) {
          targets = [lockedSingleTarget];
        } else {
          targets = resolveTargets(state, actor, cfg);
        }
      } else {
        targets = resolveTargets(state, actor, cfg);
        if (isSingleTargetType && targets.length > 0 && !lockedSingleTarget) lockedSingleTarget = targets[0];
      }
      return { effect: eff, targets };
    });
    const allTargetsSet = new Set();
    effectTargetsList.forEach(({ targets }) => targets.forEach((t) => allTargetsSet.add(t)));
    const allTargetsOrdered = [...allTargetsSet];

    // Si aucune cible valide (ex. RESURRECT sans alliés morts, focus impossible), ne pas consommer le tour : fallback attaque de base.
    if (allTargetsOrdered.length === 0) return false;

    const resultsPerEffect = skill.effects.map(() => []);

    for (const target of allTargetsOrdered) {
      for (let i = 0; i < skill.effects.length; i++) {
        const { effect: eff, targets } = effectTargetsList[i];
        if (!targets.includes(target)) continue;
        if (!target.alive && eff.type !== 'RESURRECT') continue;
        const { effToApply, chainMeta } = resolveChainedEffectForTarget(eff, resultsPerEffect, i, target, actor);
        const res = applySkillEffect(state, actor, target, effToApply);
        resultsPerEffect[i].push({
          targetUid: target.uid,
          targetCombatIndex: target.combatIndex,
          targetName: target.name,
          targetSide: target.side,
          ...(chainMeta || {}),
          ...res
        });
      }
      if (!allTargetUids.includes(target.uid)) allTargetUids.push(target.uid);
    }

    const effectsResultsByTarget = skill.effects.map((eff, i) => {
      const isDebuffEffect = eff.type === 'APPLY_DEBUFF';
      const normalizedType = isDebuffEffect ? 'APPLY_BUFF' : eff.type;
      const buffType = eff.buffType ?? eff.buff ?? (isDebuffEffect ? (eff.debuffType ?? eff.debuff) : null);
      return {
        effect: normalizedType,
        effectConfig: {
          type: normalizedType,
          buffType: buffType ?? (isDebuffEffect ? 'DEBUFF' : null),
          debuffType: isDebuffEffect ? (eff.debuffType ?? eff.debuff) : null,
          target: eff.target ?? null,
          remainingActions: eff.remainingActions,
          value: eff.value,
          percent: eff.percent,
          percentMaxHp: eff.percentMaxHp ?? eff.percent
        },
        results: resultsPerEffect[i]
      };
    });

    const atbAfterActor = consumeAtbAfterAction(actor);

    // Enregistrer les unit_ko dans le battle log MAIS sans créer de frame replay séparée.
    // Tout s'affiche en une seule frame (KOs + buffs + dégâts) pour éviter l'effet "un par un".
    for (const { results } of effectsResultsByTarget) {
      for (const r of results || []) {
        if (r.died && !r.selfResurrected) {
          const koEv = {
            type: 'unit_ko',
            sourceId: r.koSourceId ?? actor.combatIndex,
            sourceName: r.koSourceName ?? actor.name,
            targetId: r.targetCombatIndex
          };
          koEv.index = state.events.length;
          state.events.push(koEv);
        }
      }
    }

    event = {
      type: 'skill',
      actionType: 'SKILL',
      skillType: skill.type || 'GENERIC',
      skillName: skill.name ?? null,
      skillSlotKey: skillSlot?.skillKey ?? null,
      round,
      actor: actor.combatIndex,
      actorSide: actor.side,
      targets: allTargetUids,
      atbBefore,
      atbAfter: atbAfterActor,
      effectsResultsByTarget,
      actorHp: actor.hp,
      actorAlive: actor.alive
    };
    logEventFn(state, event);

    const cdVal = skill.cd_actions ?? 1;
    if (Array.isArray(actor.activeSkillSlots) && actor.activeSkillSlots.length > 0 && skillSlot && skillSlot.legacy !== true) {
      const slot = actor.activeSkillSlots.find((s) => s.skillKey === skillSlot.skillKey) ?? skillSlot;
      slot.skillCd = cdVal;
      syncActorSkillMirror(actor);
    } else {
      actor.skillCd = cdVal;
      if (Array.isArray(actor.activeSkillSlots) && actor.activeSkillSlots.length > 0) {
        syncActorSkillMirror(actor);
      }
    }
    // BERSERKERS 6 : prochaine attaque de base aura +50 % dégâts (uniquement pour les berserkers)
    if (actor.berserkerHasSkillBonus === false && actor.traits?.includes('BERSERKERS') && (state.synergies?.[actor.side]?.BERSERKERS ?? 0) >= 6) {
      actor.berserkerHasSkillBonus = true;
    }
    onSkillUsedSynergies(state, actor, (e) => logEvent(state, e));
    handlePassiveTrigger(state, actor, 'ON_ACTION_END', { targets: allTargetUids }, (ev) => logEventFn(state, ev));
    decrementPassiveCooldowns(actor);
    tickStatuses(state, actor, (e) => logEvent(state, e));
    onUnitActionEndSynergies(state, actor, (e) => logEvent(state, e));
    setUnitHp(actor, actor.hp, state);
    return true;
  }

  return false;
}

function computeBasicDamage(state, actor, target, rng) {
  const statModsTarget = getStatModifiers(target);
  const actorStats = getEffectiveCombatStats(actor);
  const targetStats = getEffectiveCombatStats(target);

  let atk = actorStats.attack;
  const def = targetStats.defense;

  let raw = (atk * atk) / (atk + def + 1);

  // BERSERKERS 6 : premier coup après compétence (uniquement pour les berserkers)
  if (actor.berserkerHasSkillBonus && actor.traits?.includes('BERSERKERS')) {
    raw *= 1.5;
    actor.berserkerHasSkillBonus = false;
  }

  // EXECUTIONERS 2/4 : bonus en fonction des PV restants de la cible (uniquement pour les bourreaux)
  const execLevel = actor.executionerLevel || 0;
  if (execLevel >= 2 && actor.traits?.includes('EXECUTIONERS')) {
    const hpRatio = target.hp / target.maxHp;
    if (hpRatio < 0.5) {
      raw *= 1.1;
      if (execLevel >= 4 && hpRatio < 0.3) {
        raw *= 1.2; // ~+32% cumulé (<30%)
      }
    }
  }

  const rel = elementRelation(actor, target);
  let isCrit = false;
  let isMiss = false;

  if (rel === 'adv') {
    if (rng() < 0.25) isCrit = true;
  } else if (rel === 'dis') {
    if (rng() < 0.25) isMiss = true;
  }

  if (!isMiss && statModsTarget.blindChance > 0) {
    if (rng() < statModsTarget.blindChance) {
      isMiss = true;
    }
  }

  let finalDamage = 0;
  if (!isMiss) {
    finalDamage = raw;
    if (isCrit) {
      finalDamage *= 1.5;
    }
  }

  if (target.damageTakenMul != null) {
    finalDamage *= target.damageTakenMul;
  }

  finalDamage = Math.max(0, Math.round(finalDamage));

  return {
    rawDamage: Math.round(raw),
    finalDamage,
    isCrit,
    isMiss
  };
}

/**
 * Snapshot minimal pour replay (pas de skills, pas de refs cycliques).
 * Inclut units (tableau plat) avec team ALLY/ENEMY et role CAC/DISTANCE pour le visualiseur.
 */
function makeReplaySnapshot(state) {
  const units = state?.units || [];
  const mapUnit = (u) => ({
    id: u.uid,
    name: u.name ?? String(u.uid),
    image_url: u.image_url ?? null,
    element: u.element ?? 'NEUTRAL',
    team: u.side === 'A' ? 'ALLY' : 'ENEMY',
    role: u.attack_type ?? (u.position === 'back' ? 'DISTANCE' : 'CAC'),
    hp: u.hp,
    maxHp: u.maxHp ?? u.hp,
    atb: u.atb ?? 0,
    attack: u.attack,
    defense: u.defense,
    speed: u.speed,
    mastery: u.mastery ?? 0,
    level: u.level,
    hasSkill: !!u.skill || (Array.isArray(u.activeSkillSlots) && u.activeSkillSlots.length > 0),
    skillCd: Number.isFinite(Number(u.skillCd)) ? Number(u.skillCd) : 0,
    activeSkillSlots: Array.isArray(u.activeSkillSlots)
      ? u.activeSkillSlots.map((s) => ({
          skillKey: s.skillKey,
          skillCd: Number.isFinite(Number(s.skillCd)) ? Number(s.skillCd) : 0,
          name: s.skill?.name ?? null
        }))
      : null,
    buffs: (u.buffs || []).map((b) => ({
      type: b.type ?? b.key,
      value: b.value ?? null,
      remainingActions: b.remainingActions ?? null,
      sourceId: b.sourceId ?? null
    })),
    debuffs: (u.debuffs || []).map((d) => ({
      type: d.type ?? d.key,
      value: d.value ?? null,
      remainingActions: d.remainingActions ?? null
    })),
    isDead: u.alive === false
  });
  const teamA = units.filter((u) => u.side === 'A').map((u) => ({ ...mapUnit(u), combatIndex: u.combatIndex, position: u.position ?? 'front', alive: u.alive !== false, shield: (u.buffs || []).filter((b) => (b.type || b.key) === 'SHIELD').reduce((s, b) => s + (Number(b.value) || 0), 0) }));
  const teamB = units.filter((u) => u.side === 'B').map((u) => ({ ...mapUnit(u), combatIndex: u.combatIndex, position: u.position ?? 'front', alive: u.alive !== false, shield: (u.buffs || []).filter((b) => (b.type || b.key) === 'SHIELD').reduce((s, b) => s + (Number(b.value) || 0), 0) }));
  const snapshotUnits = units.map((u, i) => ({ ...mapUnit(u), combatIndex: u.combatIndex ?? i }));
  return {
    turn: state.currentRound ?? 0,
    activeUnitId: state.activeUnitId ?? null,
    teams: [
      { id: 'A', units: teamA },
      { id: 'B', units: teamB }
    ],
    units: snapshotUnits
  };
}

function logEvent(state, event) {
  event.index = state.events.length;
  state.events.push(event);
  if (state.pushReplayFrame && typeof state.pushReplayFrame === 'function') {
    const ev = { ...event };
    state.pushReplayFrame(ev, state);
  }
}

const MAX_BATTLE_LOG_ENTRIES = 500;

function mapElement(el) {
  if (!el) return null;
  const ELEMENT_TO_FR = { water: 'eau', fire: 'feu', plant: 'plante', light: 'lumière', lumiere: 'lumière', dark: 'ténèbres', tenebres: 'ténèbres', tenebre: 'ténèbres' };
  return ELEMENT_TO_FR[String(el).toLowerCase()] || null;
}

/**
 * Construit le tableau battleLog (format normalisé BattleEventType).
 * Pas de TURN_START automatique : on groupe par tour et on n'insère TURN_START que pour les tours ayant ≥1 événement.
 */
function buildBattleLog(state, log) {
  const entries = [];
  const units = state?.units || [];
  const getNameByIndex = (idx) => (typeof idx === 'number' && units[idx] != null ? units[idx].name : (idx != null ? String(idx) : '?'));
  const getElement = (idx) => (typeof idx === 'number' && units[idx] != null ? mapElement(units[idx].element) : null);
  const push = (entry) => {
    if (entries.length < MAX_BATTLE_LOG_ENTRIES) entries.push(entry);
  };

  let lastRound = 0;
  for (const ev of state.events || []) {
    const turn = ev.round ?? ev.turn ?? lastRound;
    lastRound = turn;
    if (entries.length >= MAX_BATTLE_LOG_ENTRIES) break;

    if (ev.type === 'attack') {
      const sourceId = ev.actor ?? null;
      const targetId = ev.target ?? null;
      const sourceName = sourceId != null ? getNameByIndex(sourceId) : null;
      const targetName = targetId != null ? getNameByIndex(targetId) : null;
      const isSkill = ev.actionType === 'SKILL';

      if (ev.isCounter === true) {
        push(createBattleLogEntry(turn, BattleEventType.COUNTER_ATTACK, targetId, targetName, sourceId, sourceName, null, {}));
      }
      if (isSkill) {
        const rawSn = ev.skillName ?? ev.skillType ?? null;
        const skillLabel = (rawSn && String(rawSn).toUpperCase() !== 'GENERIC') ? rawSn : null;
        push(createBattleLogEntry(turn, BattleEventType.SKILL_CAST, sourceId, sourceName, targetId, targetName, null, { skillName: skillLabel }));
      } else {
        push(createBattleLogEntry(turn, BattleEventType.BASIC_ATTACK, sourceId, sourceName, targetId, targetName, null, {}));
      }
      if (ev.finalDamage != null && !ev.isMiss) {
        push(createBattleLogEntry(turn, BattleEventType.DAMAGE, sourceId, sourceName, targetId, targetName, ev.finalDamage, {
          isCrit: ev.isCrit === true,
          hpBefore: ev.hpBefore,
          hpAfter: ev.hpAfter
        }));
      }
      continue;
    }

    if (ev.type === 'unit_ko' || ev.type === 'ko') {
      const victimId = ev.targetId ?? ev.sourceId ?? ev.target ?? null;
      const victimName = ev.targetName ?? ev.sourceName ?? (victimId != null ? getNameByIndex(victimId) : null);
      push(createBattleLogEntry(turn, BattleEventType.DEATH, null, null, victimId, victimName, null, {}));
      continue;
    }

    if (ev.type === 'shield_absorb') {
      const targetId = ev.targetId ?? null;
      const sourceId = ev.sourceId ?? null;
      push(createBattleLogEntry(turn, BattleEventType.SHIELD_ABSORB, sourceId, getNameByIndex(sourceId), targetId, getNameByIndex(targetId), ev.valueAbsorbed ?? null, { valueAbsorbed: ev.valueAbsorbed ?? 0 }));
      continue;
    }

    if (ev.type === 'immune') {
      const targetId = ev.targetId ?? null;
      const sourceId = ev.sourceId ?? null;
      push(createBattleLogEntry(turn, BattleEventType.IMMUNE, sourceId, getNameByIndex(sourceId), targetId, getNameByIndex(targetId), null, { reason: ev.reason ?? 'IMMUNE' }));
      continue;
    }

    if (ev.type === 'skill') {
      const sourceId = ev.actor ?? null;
      const sourceName = sourceId != null ? getNameByIndex(sourceId) : null;

      if (Array.isArray(ev.effectsResultsByTarget) && ev.effectsResultsByTarget.length > 0) {
        const rawSkillName = ev.skillName ?? ev.skillType ?? null;
        const skillLabel = (rawSkillName && String(rawSkillName).toUpperCase() !== 'GENERIC') ? rawSkillName : null;
        push(createBattleLogEntry(turn, BattleEventType.SKILL_CAST, sourceId, sourceName, null, null, null, { skillName: skillLabel }));
        for (const { effect: effType, effectConfig: cfg, results } of ev.effectsResultsByTarget) {
          const duration = cfg?.remainingActions ?? 0;
          const debuffType = cfg?.debuffType ?? cfg?.debuff ?? (effType === 'APPLY_DEBUFF' ? 'DEBUFF' : effType);
          const buffType = cfg?.buffType ?? cfg?.buff ?? (effType === 'APPLY_BUFF' ? 'BUFF' : effType);
          for (const r of results) {
            if (entries.length >= MAX_BATTLE_LOG_ENTRIES) break;
            const targetId = r.targetCombatIndex ?? r.targetUid ?? null;
            const targetName = r.targetName ?? (targetId != null ? getNameByIndex(targetId) : null);
            if (effType === 'DAMAGE' && r.effectiveDamage != null) {
              push(createBattleLogEntry(turn, BattleEventType.DAMAGE, sourceId, sourceName, targetId, targetName, r.effectiveDamage, {
                hpBefore: r.hpBefore,
                hpAfter: r.hpAfter
              }));
            }
            if (effType === 'HEAL' && (r.healAmount != null && r.healAmount > 0)) {
              push(createBattleLogEntry(turn, BattleEventType.HEAL, sourceId, sourceName, targetId, targetName, r.healAmount, { amount: r.healAmount, hpAfter: r.hpAfter }));
            } else if (effType === 'APPLY_BUFF' && buffType === 'SHIELD' && (r.shieldAmount != null && r.shieldAmount > 0)) {
              push(createBattleLogEntry(turn, BattleEventType.SHIELD, sourceId, sourceName, targetId, targetName, r.shieldAmount, { amount: r.shieldAmount }));
            } else if (effType === 'APPLY_BUFF' && isDebuffBuffType(buffType)) {
              const targetMode = String(cfg?.target ?? '').toUpperCase();
              const isTeamDebuff = targetMode === 'TEAM_ENEMY' && (results?.length ?? 0) > 1;
              if (isTeamDebuff) {
                const appliedCount = results.filter((x) => x.applied && !x.immune).length;
                if (appliedCount > 0) {
                  push(createBattleLogEntry(turn, BattleEventType.DEBUFF_APPLY, sourceId, sourceName, null, 'l\'équipe ennemie', null, {
                    debuffType: buffType,
                    duration,
                    remainingActions: duration,
                    self: false,
                    targetMode: cfg?.target ?? null,
                    teamWide: true
                  }));
                }
                break;
              }
              if (r.immune) {
                push(createBattleLogEntry(turn, BattleEventType.DEBUFF_RESIST, sourceId, sourceName, targetId, targetName, null, { debuffType: buffType }));
              } else if (r.applied) {
                push(createBattleLogEntry(turn, BattleEventType.DEBUFF_APPLY, sourceId, sourceName, targetId, targetName, null, {
                  debuffType: buffType,
                  duration,
                  remainingActions: duration,
                  self: sourceId === targetId,
                  targetMode: cfg?.target ?? null
                }));
              }
            } else if (effType === 'APPLY_BUFF' && r.applied && buffType !== 'SHIELD') {
              const targetMode = String(cfg?.target ?? '').toUpperCase();
              const isTeamBuff = (targetMode === 'TEAM_ALLY' || targetMode === 'TEAM_ENEMY') && (results?.length ?? 0) > 1;
              if (isTeamBuff) {
                const appliedCount = results.filter((x) => x.applied).length;
                if (appliedCount > 0) {
                  const isAllyTeam = targetMode === 'TEAM_ALLY';
                  push(createBattleLogEntry(turn, BattleEventType.BUFF_APPLY, sourceId, sourceName, null, isAllyTeam ? 'toute l\'équipe' : 'l\'équipe ennemie', cfg?.value ?? null, {
                    buffType,
                    duration: cfg?.remainingActions ?? 1,
                    remainingActions: cfg?.remainingActions ?? 1,
                    self: false,
                    targetMode: cfg?.target ?? null,
                    percent: (buffType === 'ATK_UP' || buffType === 'DEF_UP') ? 0.5 : undefined,
                    teamWide: true
                  }));
                }
                break;
              }
              const isSelf = sourceId === targetId;
              const percent = (buffType === 'ATK_UP' || buffType === 'DEF_UP') ? 0.5 : undefined;
              push(createBattleLogEntry(turn, BattleEventType.BUFF_APPLY, sourceId, sourceName, targetId, targetName, cfg?.value ?? null, {
                buffType,
                duration: cfg?.remainingActions ?? 1,
                remainingActions: cfg?.remainingActions ?? 1,
                self: isSelf,
                targetMode: cfg?.target ?? null,
                percent
              }));
            } else if (effType === 'ATB_UP' && r.applied) {
              push(createBattleLogEntry(turn, BattleEventType.ATB_UP, sourceId, sourceName, targetId, targetName, cfg?.percent ?? cfg?.value ?? null, { percent: cfg?.percent ?? cfg?.value ?? null }));
            } else if (effType === 'STRIP' && (r.removed != null && r.removed > 0)) {
              const removedBuffs = Array.isArray(r.removedBuffs) ? r.removedBuffs : [];
              push(createBattleLogEntry(turn, BattleEventType.STRIP, sourceId, sourceName, targetId, targetName, r.removed, { count: r.removed, removedBuffs }));
            } else if (effType === 'CLEANSE' && (r.removed != null && r.removed > 0)) {
              const removedDebuffs = Array.isArray(r.removedDebuffs) ? r.removedDebuffs : [];
              push(createBattleLogEntry(turn, BattleEventType.CLEANSE, sourceId, sourceName, targetId, targetName, r.removed, { count: r.removed, removedDebuffs }));
            } else if (effType === 'REDUCE_ATB' && r.applied) {
              push(createBattleLogEntry(turn, BattleEventType.REDUCE_ATB, sourceId, sourceName, targetId, targetName, cfg?.percent ?? null, { percent: cfg?.percent ?? null }));
            } else if (effType === 'RESET_SKILL_COOLDOWN' && (r.applied || r.after === 0)) {
              push(createBattleLogEntry(turn, BattleEventType.EFFECT_APPLY, sourceId, sourceName, targetId, targetName, r.after ?? 0, {
                message: `${sourceName} remet le temps de recharge de ${targetName} a 0.`,
                effectType: 'RESET_SKILL_COOLDOWN',
                before: r.before ?? null,
                after: r.after ?? 0,
                baseCooldown: r.baseCooldown ?? getUnitBaseSkillCooldown(state.units?.[targetId] ?? null)
              }));
            } else if (effType === 'SET_SKILL_COOLDOWN_MAX' && r.applied) {
              push(createBattleLogEntry(turn, BattleEventType.EFFECT_APPLY, sourceId, sourceName, targetId, targetName, r.after ?? null, {
                message: `${sourceName} remet le temps de recharge de ${targetName} a ${r.after ?? r.baseCooldown ?? 0}.`,
                effectType: 'SET_SKILL_COOLDOWN_MAX',
                before: r.before ?? null,
                after: r.after ?? null,
                baseCooldown: r.baseCooldown ?? null
              }));
            } else if (effType === 'CD_UP' && r.applied) {
              const d = r.delta ?? cfg?.value ?? 0;
              push(createBattleLogEntry(turn, BattleEventType.EFFECT_APPLY, sourceId, sourceName, targetId, targetName, r.after ?? null, {
                message: `${sourceName} retarde le temps de recharge de ${targetName} de ${d} tour(s).`,
                effectType: 'CD_UP',
                before: r.before ?? null,
                after: r.after ?? null,
                delta: d
              }));
            } else if (effType === 'CD_DOWN' && r.applied) {
              const d = r.delta ?? cfg?.value ?? 0;
              push(createBattleLogEntry(turn, BattleEventType.EFFECT_APPLY, sourceId, sourceName, targetId, targetName, r.after ?? null, {
                message: `${sourceName} réduit le temps de recharge de ${targetName} de ${d} tour(s).`,
                effectType: 'CD_DOWN',
                before: r.before ?? null,
                after: r.after ?? null,
                delta: d
              }));
            } else if (effType === 'STEAL_STAT' && r.applied) {
              push(createBattleLogEntry(turn, BattleEventType.EFFECT_APPLY, sourceId, sourceName, targetId, targetName, null, {
                message: `${sourceName} vole ${r.amount ?? 0} points ${getFrenchStatLabel(r.stat)} a ${targetName}.`,
                effectType: 'STEAL_STAT',
                stat: r.stat ?? null,
                amount: r.amount ?? 0
              }));
            } else if (effType === 'RESURRECT' && r.applied) {
              push(createBattleLogEntry(turn, BattleEventType.RESURRECT, sourceId, sourceName, targetId, targetName, r.hpRestored ?? null, { percent: cfg?.percent ?? 0.3 }));
            } else if (r.healAmount != null && r.healAmount > 0) {
              // Fallback : tout effet qui retourne healAmount sans être typé HEAL (ex. synergie)
              push(createBattleLogEntry(turn, BattleEventType.HEAL, sourceId, sourceName, targetId, targetName, r.healAmount, { amount: r.healAmount, hpAfter: r.hpAfter }));
            }
          }
        }
        continue;
      }
      continue;
    }

    if (ev.type === 'redirect' && ev.reason === 'DEFEND') {
      const protectorId = ev.to ?? null;
      const originalTargetId = ev.from ?? null;
      push(createBattleLogEntry(turn, BattleEventType.DEFEND_REDIRECT, protectorId, getNameByIndex(protectorId), originalTargetId, getNameByIndex(originalTargetId), null, { protectorName: getNameByIndex(protectorId) }));
      continue;
    }

    if (ev.type === 'EFFECT_APPLY') {
      const sourceId = ev.actor ?? null;
      const targetId = ev.target ?? null;
      push(createBattleLogEntry(turn, BattleEventType.EFFECT_APPLY, sourceId, getNameByIndex(sourceId), targetId, getNameByIndex(targetId), null, { message: ev.message ?? '' }));
      continue;
    }

    if (ev.type === 'passive') {
      push(createBattleLogEntry(turn, BattleEventType.PASSIVE_TRIGGER, ev.actor ?? ev.unit ?? null, getNameByIndex(ev.actor ?? ev.unit), ev.target ?? null, getNameByIndex(ev.target), null, { passiveType: ev.passiveType ?? 'PASSIVE', effect: ev.effect, applied: ev.applied }));
      const isResurrectPassive = ev.passiveType === 'SELF_RESURRECT' || (ev.passiveType === 'ON_DEATH' && ev.effect === 'RESURRECT' && ev.applied);
      if (isResurrectPassive) {
        const unitId = ev.actor ?? ev.unit ?? null;
        push(createBattleLogEntry(turn, BattleEventType.RESURRECT, unitId, getNameByIndex(unitId), unitId, getNameByIndex(unitId), ev.hpAfter ?? null, { passiveType: ev.passiveType }));
      }
      continue;
    }

    if (ev.type === 'lifesteal' && (ev.healAmount ?? 0) > 0) {
      const unitId = ev.sourceId ?? null;
      push(createBattleLogEntry(turn, BattleEventType.HEAL, unitId, getNameByIndex(unitId), unitId, getNameByIndex(unitId), ev.healAmount ?? null, { lifesteal: true, damageDealt: ev.damageDealt }));
      continue;
    }

    if (ev.type === 'SYNERGY_TRIGGER') {
      const subType = ev.subType ?? 'SYNERGY';
      const sourceId = ev.unit ?? ev.source ?? ev.killer ?? null;
      const targetId = ev.target ?? ev.unit ?? ev.victim ?? null;
      push(createBattleLogEntry(turn, BattleEventType.SYNERGY_TRIGGER, sourceId, getNameByIndex(sourceId), targetId, getNameByIndex(targetId), ev.value ?? ev.healAmount ?? ev.applied ?? null, { synergyType: ev.trait ?? 'SYNERGY', subType }));
      if (subType === 'LIFESTEAL' && (ev.healAmount ?? 0) > 0) {
        push(createBattleLogEntry(turn, BattleEventType.HEAL, ev.unit ?? null, getNameByIndex(ev.unit), ev.unit ?? null, getNameByIndex(ev.unit), ev.healAmount ?? null, { synergyType: ev.trait }));
      }
      if (subType === 'SELF_REGEN' && (ev.value ?? 0) > 0) {
        push(createBattleLogEntry(turn, BattleEventType.HEAL, ev.unit ?? null, getNameByIndex(ev.unit), ev.unit ?? null, getNameByIndex(ev.unit), ev.value ?? null, { synergyType: ev.trait ?? 'DRUIDS', hpAfter: ev.hpAfter }));
      }
      continue;
    }

    if (ev.type === 'BOSS_TRIGGER') {
      push(createBattleLogEntry(turn, BattleEventType.BOSS_TRIGGER, ev.unit ?? null, getNameByIndex(ev.unit), null, null, ev.value ?? ev.duration ?? null, { subType: ev.subType ?? 'TRIGGER', triggerHpPct: ev.triggerHpPct }));
      continue;
    }

    if (ev.type === 'buff_tick') {
      const unitId = ev.sourceId ?? null;
      push(createBattleLogEntry(turn, BattleEventType.BUFF_TICK, unitId, getNameByIndex(unitId), unitId, getNameByIndex(unitId), null, { buffType: ev.meta?.buffType, remainingActions: ev.meta?.remainingActions }));
      continue;
    }
    if (ev.type === 'buff_remove') {
      const unitId = ev.sourceId ?? null;
      push(createBattleLogEntry(turn, BattleEventType.BUFF_REMOVE, unitId, getNameByIndex(unitId), unitId, getNameByIndex(unitId), null, { buffType: ev.meta?.buffType }));
      continue;
    }
    if (ev.type === 'debuff_tick') {
      const unitId = ev.sourceId ?? null;
      push(createBattleLogEntry(turn, BattleEventType.DEBUFF_TICK, unitId, getNameByIndex(unitId), unitId, getNameByIndex(unitId), null, { debuffType: ev.meta?.debuffType, remainingActions: ev.meta?.remainingActions }));
      continue;
    }
    if (ev.type === 'debuff_remove') {
      const unitId = ev.sourceId ?? null;
      push(createBattleLogEntry(turn, BattleEventType.DEBUFF_REMOVE, unitId, getNameByIndex(unitId), unitId, getNameByIndex(unitId), null, { debuffType: ev.meta?.debuffType }));
      continue;
    }
    if (ev.type === 'skip_stun') {
      const unitId = ev.actorId ?? null;
      push(createBattleLogEntry(turn, BattleEventType.STUN_SKIP, unitId, getNameByIndex(unitId), unitId, getNameByIndex(unitId), null, {}));
      continue;
    }
    if (ev.type === 'dot_damage') {
      const unitId = ev.actorId ?? null;
      push(createBattleLogEntry(turn, BattleEventType.DOT_DAMAGE, unitId, getNameByIndex(unitId), unitId, getNameByIndex(unitId), ev.damage ?? null, { stacks: ev.stacks ?? 0, hpBefore: ev.hpBefore, hpAfter: ev.hpAfter }));
      continue;
    }
    if (ev.type === 'regen_tick') {
      const unitId = ev.actorId ?? null;
      push(createBattleLogEntry(turn, BattleEventType.HEAL, unitId, getNameByIndex(unitId), unitId, getNameByIndex(unitId), ev.heal ?? null, { regen: true, stacks: ev.stacks ?? 0, hpBefore: ev.hpBefore, hpAfter: ev.hpAfter }));
      continue;
    }
  }

  push(createBattleLogEntry(log.summary?.totalRounds ?? lastRound, BattleEventType.BATTLE_END, null, null, null, null, null, {}));

  const byTurn = new Map();
  for (const e of entries) {
    const t = e.turn;
    if (!byTurn.has(t)) byTurn.set(t, []);
    byTurn.get(t).push(e);
  }
  const sortedTurns = [...byTurn.keys()].sort((a, b) => a - b);
  const result = [];
  for (const t of sortedTurns) {
    const list = byTurn.get(t);
    if (list.length === 0) continue;
    const visible = list.filter((e) => e.type !== BattleEventType.TURN_START);
    if (visible.length === 0) continue;
    result.push(createBattleLogEntry(t, BattleEventType.TURN_START, null, null, null, null, null, {}));
    for (const e of list) result.push(e);
    if (result.length >= MAX_BATTLE_LOG_ENTRIES) break;
  }
  return result.slice(0, MAX_BATTLE_LOG_ENTRIES);
}

/** Limite de rounds avant match nul (6 unités/équipe × 2 = 12 unités, 400 rounds ≈ 33 tours/unité). */
export const MAX_ROUNDS = 400;

export function simulateBattle(teamAInput, teamBInput, config = {}) {
  const seed = config.seed ?? 1;
  const rng = createRng(seed);

  const teamA = deepClone(teamAInput).map((u) => ({ ...u, side: 'A' }));
  const teamB = deepClone(teamBInput).map((u) => ({ ...u, side: 'B' }));

  // Les équipes viennent de buildTeamFromDb (campaign, pvp, guildWar) avec stats déjà calculées
  // (computeScaledStats + artefacts + noyau). Ne pas réappliquer applyScaledStatsToUnit qui
  // écraserait les bonus d'artefacts.

  const units = [...teamA, ...teamB].map((u, idx) => {
    const rawSkill = u.skill || u.skillData || u.skill_data;
    const { activeSkills, passiveSkills: rawPassiveSkills } = getSkillsFromSkillData(rawSkill);
    const mergedPassives = mergeSpecPassiveIntoPassiveSkills(rawPassiveSkills, u.specPassive);
    const passives = normalizePassives(mergedPassives);
    const permanentTraits = extractPermanentPassiveTraits(mergedPassives);
    const activeSkillSlots = buildActiveSkillSlotsFromRaw(activeSkills);

    let skill = null;
    let skillCd = 0;
    if (activeSkillSlots.length > 0) {
      skill = { skill: activeSkillSlots[0].skill };
      skillCd = 0;
    } else {
      skill = Array.isArray(rawSkill?.skills) ? null : normalizeSkill(rawSkill);
      if (skill) skill = ensureSkillEffects(skill);
      skillCd = 0;
    }

    const hp = u.maxHp ?? 0;
    const alive = hp > 0;
    return {
      ...u,
      uid: `${u.side}-${idx}`,
      combatIndex: idx,
      orderIndex: idx,
      hp,
      atb: alive ? 0 : 0,
      alive,
      buffs: [],
      debuffs: [],
      mastery: u.mastery ?? 0,
      damageTakenMul: 1,
      skill,
      skillCd,
      activeSkillSlots: activeSkillSlots.length > 0 ? activeSkillSlots : null,
      passives,
      passiveCooldowns: {},
      permanentDebuffImmunity: !!permanentTraits.debuffImmunity,
      steelDamageReductionPercent: permanentTraits.steelDamageReductionPercent ?? 0,
      multiHitShieldHitsMax: permanentTraits.multiHitShieldHitsMax ?? permanentTraits.multiHitShieldHitsRemaining ?? 0,
      multiHitShieldHitsRemaining: permanentTraits.multiHitShieldHitsRemaining ?? 0
    };
  });

  for (const u of units) {
    applyArchetypePassives(u);
    applyFatigueToSpeed(u);
  }

  const replayFrames = [];
  let replayFrameIndex = 0;
  function pushReplayFrame(ev, st) {
    replayFrames.push({
      i: replayFrameIndex++,
      ts: replayFrameIndex,
      event: ev,
      snapshot: makeReplaySnapshot(st)
    });
  }

  const state = {
    units,
    rng,
    events: [],
    flags: {},
    bossModifier: config.bossModifier || null,
    bossUid: null,
    bossPhase2: false,
    bossResurrected: false,
    logEvent,
    lastResurrectedUnit: null,
    setUnitHp: (unit, newHp) => setUnitHp(unit, newHp, state),
    pushReplayFrame,
    currentRound: 0,
    activeUnitId: null
  };
  if (state.bossModifier) {
    let bossUnit = state.units.find((u) => u.side === 'B' && u.isBoss);
    if (!bossUnit && state.bossModifier?.resurrectOnce) {
      // Fallback : dernière unité B (le boss est toujours en dernière position pour les stages boss)
      const bUnits = state.units.filter((u) => u.side === 'B');
      bossUnit = bUnits.length > 0 ? bUnits[bUnits.length - 1] : null;
    }
    state.bossUid = bossUnit ? bossUnit.uid : (state.units.find((u) => u.side === 'B')?.uid ?? null);
  }
  applyPreBattleSynergies(state);

  initializeAtb(state.units);

  replayFrames.push({
    i: replayFrameIndex++,
    ts: 0,
    event: { type: 'init' },
    snapshot: makeReplaySnapshot(state)
  });

  applyStartOfBattleRuntimeEffects(state, (e) => logEvent(state, e));

  applyCombatStartPassives(state, (ev) => logEvent(state, ev));

  // Debug: vérifier HP initiaux (détecter boost maxHp anormal ex. CAC +20%)
  if (typeof console !== 'undefined' && console.log) {
    console.log('Initial HP values:', state.units.map((u) => ({
      name: u.name,
      hp: u.hp,
      maxHp: u.maxHp,
      position: u.position,
      archetype: u.archetype,
      side: u.side
    })));
  }

  const maxRounds = config.maxRounds ?? MAX_ROUNDS;
  const maxActions = config.maxActions ?? 1000;
  const interactive = config?.interactive === true;
  const decisions = Array.isArray(config?.decisions) ? config.decisions : [];
  let decisionCursor = 0;

  const log = {
    seed,
    teams: {
      A: teamA,
      B: teamB
    },
    events: state.events,
    summary: null
  };

  let actions = 0;
  let rounds = 0;

  while (actions < maxActions && rounds < maxRounds) {
    rounds += 1;

    for (;;) {
      const resultBefore = isBattleFinished(state.units);
      if (resultBefore) {
        const playerAlive = state.units.filter((u) => u.side === 'A' && u.alive).length;
        const enemyAlive = state.units.filter((u) => u.side === 'B' && u.alive).length;
        log.summary = {
          winner: resultBefore,
          reason: 'all_units_down',
          totalRounds: rounds,
          totalActions: actions,
          totalTurns: rounds,
          playerUnitsAlive: playerAlive,
          enemyUnitsAlive: enemyAlive
        };
        log.battleLog = buildBattleLog(state, log);
        log.replay = { seed, frames: replayFrames };
        return log;
      }

      advanceAtb(state.units);

      const actor = pickNextActor(state.units);
      if (!actor) {
        const resultAfter = isBattleFinished(state.units);
        if (resultAfter) {
          const playerAlive = state.units.filter((u) => u.side === 'A' && u.alive).length;
          const enemyAlive = state.units.filter((u) => u.side === 'B' && u.alive).length;
          log.summary = {
            winner: resultAfter,
            reason: 'all_units_down',
            totalRounds: rounds,
            totalActions: actions,
            totalTurns: rounds,
            playerUnitsAlive: playerAlive,
            enemyUnitsAlive: enemyAlive
          };
          log.battleLog = buildBattleLog(state, log);
          log.replay = { seed, frames: replayFrames };
          return log;
        }
        continue;
      }
      if (!actor.alive) {
        actor.atb = 0;
        if (state.logEvent) {
          state.logEvent(state, { type: 'skip_dead', actorId: actor.combatIndex });
        }
        continue;
      }
      if (actor.hp <= 0 || !actor.alive) {
        if (typeof console !== 'undefined' && console.error) console.error('DEAD UNIT ABOUT TO ACT', actor);
      }

      const bad = state.units.filter((u) => u.hp <= 0 && u.alive);
      const bad2 = state.units.filter((u) => u.hp > 0 && !u.alive);
      if ((bad.length || bad2.length) && typeof console !== 'undefined' && console.error) {
        console.error('HP/ALIVE DESYNC', { bad, bad2 });
      }

      const atbBefore = actor.atb;
      state.currentRound = rounds;
      state.activeUnitId = actor.uid;

      // MULTI_HIT_SHIELD : réinitialise les charges disponibles au début du tour de l’unité (avant REGEN / DoT).
      const mhsCap = actor.multiHitShieldHitsMax;
      if (typeof mhsCap === 'number' && mhsCap > 0) {
        actor.multiHitShieldHitsRemaining = mhsCap;
      }

      // REGEN et DOT proc au début du tour (y compris étourdi) ; leur durée (remainingActions) diminue juste après ce proc, pas en fin d’action.
      const regenStacks = (actor.buffs || []).filter((b) => (b.type || b.key || '').toUpperCase() === 'REGEN');
      if (regenStacks.length > 0 && actor.alive) {
        const totalRegen = regenStacks.reduce((sum, buff) => sum + Math.max(0, Number(buff.value) || 0), 0);
        if (totalRegen > 0) {
          const heal = applyHeal(actor, totalRegen);
          if (heal.applied > 0) {
            setUnitHp(actor, heal.hpAfter, state);
            if (state.logEvent) {
              state.logEvent(state, {
                type: 'regen_tick',
                actorId: actor.combatIndex,
                heal: heal.applied,
                stacks: regenStacks.length,
                hpBefore: heal.hpBefore,
                hpAfter: heal.hpAfter
              });
            }
          }
        }
      }

      // DOT : débuff cumulable — au début du tour, l'unité perd 5% de ses HP max par stack.
      const dotStacks = (actor.debuffs || []).filter((d) => (d.type || d.key || '').toUpperCase() === 'DOT').length;
      if (dotStacks > 0 && actor.alive) {
        const maxHp = actor.maxHp || 1;
        const dotDamage = Math.min(actor.hp, Math.max(0, Math.round(0.05 * maxHp * dotStacks)));
        if (dotDamage > 0) {
          const mhsDot = actor.multiHitShieldHitsRemaining;
          if (typeof mhsDot === 'number' && mhsDot > 0) {
            actor.multiHitShieldHitsRemaining = mhsDot - 1;
            if (state.logEvent) {
              state.logEvent(state, {
                type: 'multi_hit_shield_absorb',
                targetId: actor.combatIndex,
                sourceId: null,
                hitsRemaining: actor.multiHitShieldHitsRemaining,
                fromDot: true
              });
            }
            const logDotMhs = (ev) => state.logEvent && state.logEvent(state, ev);
            handlePassiveTrigger(state, actor, 'ON_RECEIVE_DAMAGE', { source: null, target: actor, damage: 0 }, logDotMhs);
            for (const u of state.units) {
              if (!u.alive || u.side !== actor.side || u.uid === actor.uid) continue;
              handlePassiveTrigger(state, u, 'ON_ALLY_RECEIVE_DAMAGE', { source: null, target: actor, damage: 0 }, logDotMhs);
            }
          } else {
            const hpBefore = actor.hp;
            const hpResult = setUnitHp(actor, actor.hp - dotDamage, state);
            if (state.logEvent) {
              state.logEvent(state, { type: 'dot_damage', actorId: actor.combatIndex, damage: dotDamage, stacks: dotStacks, hpBefore, hpAfter: actor.hp });
            }
            if (hpResult?.died === true) {
              const logDot = (ev) => state.logEvent && state.logEvent(state, ev);
              fireKoObserverPassives(state, actor, null, logDot);
              if (state.logEvent) {
                state.activeUnitId = null; // Ne pas afficher une unité morte comme "active" dans le replay
                state.logEvent(state, { type: 'unit_ko', sourceId: actor.combatIndex, sourceName: actor.name });
              }
            }
          }
        }
      }

      if (actor.alive) {
        tickRegenAndDotAfterProc(state, actor, (e) => logEvent(state, e));
      }

      // Si l'unité est morte (DOT ou autre effet au début du tour), passer son tour sans tenter d'agir
      if (!actor.alive) {
        actor.atb = 0;
        state.activeUnitId = null;
        if (state.logEvent) {
          state.logEvent(state, { type: 'skip_dead', actorId: actor.combatIndex });
        }
        continue;
      }

      // Passifs « quand un ennemi commence son tour » : pour chaque unité adverse à actor.
      const logEnemyTurn = (ev) => logEvent(state, ev);
      for (const u of state.units) {
        if (!u.alive || u.side === actor.side) continue;
        handlePassiveTrigger(state, u, 'ON_ENEMY_TURN_START', { turnActor: actor, target: actor }, logEnemyTurn);
      }

      // STUN : l'unité ne choisit pas d'action mais ON_ACTION_START / ON_ACTION_END et cooldowns passifs
      // s'exécutent comme après une action normale ; puis tick des durées des autres buff/debuff (REGEN/DOT déjà tick après proc début de tour).
      if (targetHasStatus(actor, EffectType.STUN)) {
        if (state.logEvent) state.logEvent(state, { type: 'skip_stun', actorId: actor.combatIndex });
        onUnitActionStartSynergies(state, actor, (e) => logEvent(state, e));
        handlePassiveTrigger(state, actor, 'ON_ACTION_START', {}, (ev) => logEvent(state, ev));
        actor.atb = 0;
        handlePassiveTrigger(state, actor, 'ON_ACTION_END', {}, (ev) => logEvent(state, ev));
        decrementPassiveCooldowns(actor);
        tickStatuses(state, actor, (e) => logEvent(state, e));
        onUnitActionEndSynergies(state, actor, (e) => logEvent(state, e));
        break;
      }

      onUnitActionStartSynergies(state, actor, (e) => logEvent(state, e));
      handlePassiveTrigger(state, actor, 'ON_ACTION_START', {}, (ev) => logEvent(state, ev));

      if (actor.name === 'Atlas des Profondeurs') {
        console.log('ATLAS TURN START', {
          alive: actor.alive,
          hp: actor.hp,
          skillCd: actor.skillCd,
          hasSkill: !!actor.skill,
          silence: targetHasStatus(actor, 'SILENCE'),
          provoke: hasProvoke(actor)
        });
      }

      // Avec PROVOKE : pas de skill, uniquement attaque de base (ciblée sur le lanceur) ; les passifs restent actifs.
      let forcedTarget = null;
      let selectedSkillSlot = null;
      let usedSkill = shouldUseSkill(actor) && !hasProvoke(actor);
      if (interactive && actor.side === 'A' && !targetHasStatus(actor, EffectType.STUN) && !hasProvoke(actor)) {
        const basicEnemies = getAliveEnemies(state, actor);
        // Même pool que selectTarget / performBasicAction (getValidTargets) : évite forcedTarget null
        // si l’UI propose des ennemis « front » implicites (position omise = front) alors que l’ancien
        // filtre exigeait la chaîne exacte "front".
        const basicCandidates = getValidTargets(actor, basicEnemies, false);
        const skillAvailable = shouldUseSkill(actor);
        const previewSlot = selectSkillSlotForAi(actor, state);
        const skillCandidates = previewSlot
          ? getSkillTargetCandidates(state, actor, previewSlot.skill, { skipCdCheck: true })
          : getSkillTargetCandidates(state, actor);
        const currentDecision = decisions[decisionCursor];
        if (!currentDecision) {
          log.summary = {
            winner: null,
            reason: 'awaiting_player_action',
            totalRounds: rounds,
            totalActions: actions,
            totalTurns: rounds,
            playerUnitsAlive: state.units.filter((u) => u.side === 'A' && u.alive).length,
            enemyUnitsAlive: state.units.filter((u) => u.side === 'B' && u.alive).length
          };
          log.battleLog = buildBattleLog(state, log);
          log.replay = { seed, frames: replayFrames };
          const hasSkillTargets = skillCandidates.length > 0;
          const effectiveSuggested = skillAvailable && hasSkillTargets ? 'SKILL' : 'BASIC';
          const mainSkillDescription = getMainSkillDescriptionFromUnit(actor);
          const skillSlotsPayload =
            Array.isArray(actor.activeSkillSlots) && actor.activeSkillSlots.length > 0
              ? actor.activeSkillSlots.map((s) => {
                  const sk = ensureSkillEffects(normalizeSkill(s.skill));
                  const slotTargets = getSkillTargetCandidates(state, actor, sk, { skipCdCheck: true }).map((u) => ({
                    combatIndex: u.combatIndex,
                    name: u.name
                  }));
                  const description =
                    typeof s.skill?.description === 'string' && s.skill.description.trim()
                      ? s.skill.description.trim()
                      : '';
                  const pr = Number(s.priority ?? 999);
                  return {
                    skillKey: s.skillKey,
                    name: s.skill?.name ?? null,
                    priority: Number.isFinite(pr) ? pr : 999,
                    skillCd: Number(s.skillCd ?? 0),
                    ready: s.skillCd === 0 || s.skillCd == null,
                    skillTargets: slotTargets,
                    description
                  };
                })
              : null;
          log.decisionRequest = {
            actorCombatIndex: actor.combatIndex,
            actorName: actor.name,
            skillAvailable,
            skillCd: Number(actor.skillCd ?? 0),
            skillSlots: skillSlotsPayload,
            mainSkillDescription: mainSkillDescription || undefined,
            basicTargets: basicCandidates.map((u) => ({ combatIndex: u.combatIndex, name: u.name })),
            skillTargets: skillCandidates.map((u) => ({ combatIndex: u.combatIndex, name: u.name })),
            suggestedAction: effectiveSuggested
          };
          return log;
        }
        const requestedAction = String(currentDecision.action || '').toUpperCase() === 'SKILL' ? 'SKILL' : 'BASIC';
        usedSkill = requestedAction === 'SKILL' && skillAvailable;
        if (usedSkill && Array.isArray(actor.activeSkillSlots) && actor.activeSkillSlots.length > 0) {
          selectedSkillSlot = pickSkillSlotForInteractive(actor, state, currentDecision);
          usedSkill = selectedSkillSlot != null;
        }
        const targetCombatIndex = Number(currentDecision.targetCombatIndex);
        const pool = usedSkill
          ? selectedSkillSlot
            ? getSkillTargetCandidates(state, actor, selectedSkillSlot.skill, { skipCdCheck: true })
            : skillCandidates
          : basicCandidates;
        forcedTarget = pool.find((u) => u.combatIndex === targetCombatIndex) || null;
        decisionCursor += 1;
      } else if (usedSkill) {
        selectedSkillSlot = selectSkillSlotForAi(actor, state);
        usedSkill = selectedSkillSlot != null;
      }
      if (actor.name === 'Atlas des Profondeurs') {
        console.log('ATLAS DECISION', {
          usedSkill,
          skillCd: actor.skillCd
        });
      }
      const actionType = usedSkill ? 'SKILL' : 'BASIC';
      if (typeof console !== 'undefined' && console.log) {
        console.log('ACTION TYPE:', actor.name, actionType);
        console.log('CD STATE:', actor.skillCd);
      }
      if (usedSkill) {
        const result = performSkillAction(state, actor, rounds, atbBefore, logEvent, forcedTarget, selectedSkillSlot);
        if (!result) {
          // fallback basic si pas de skill applicable
          if (forcedTarget) performBasicAction(state, actor, forcedTarget, { round: rounds, atbBefore });
          else performBasicAction(state, actor, rounds, atbBefore, rng, logEvent);
        }
      } else {
        if (forcedTarget) performBasicAction(state, actor, forcedTarget, { round: rounds, atbBefore });
        else performBasicAction(state, actor, rounds, atbBefore, rng, logEvent);
      }

      if (!actor.alive) {
        actor.atb = 0;
        if (state.logEvent) state.logEvent(state, { type: 'skip_dead', actorId: actor.combatIndex });
        continue;
      }

      // Boss ch10 hard : après résurrection, applique DOT 1 tour à tous les ennemis à chaque action
      const mod = state.bossModifier;
      if (state.bossUid && actor.uid === state.bossUid && mod?.resurrectThenDot && state.bossResurrected) {
        for (const u of state.units) {
          if (u.side === 'A' && u.alive) {
            applyEffect(u, { type: EffectType.DOT, value: 0, remainingActions: 1, isDebuff: true, sourceId: actor?.uid });
          }
        }
        if (state.logEvent) {
          state.logEvent(state, { type: 'BOSS_TRIGGER', subType: 'resurrectThenDot', unit: actor.combatIndex, duration: 1 });
        }
      }

      const result = isBattleFinished(state.units);
      if (result) {
        const playerAlive = state.units.filter((u) => u.side === 'A' && u.alive).length;
        const enemyAlive = state.units.filter((u) => u.side === 'B' && u.alive).length;
        log.summary = {
          winner: result,
          reason: 'all_units_down',
          totalRounds: rounds,
          totalActions: actions,
          totalTurns: rounds,
          playerUnitsAlive: playerAlive,
          enemyUnitsAlive: enemyAlive
        };
        log.battleLog = buildBattleLog(state, log);
        log.replay = { seed, frames: replayFrames };
        return log;
      }

      break;
    }
  }

  if (!log.summary) {
    const playerAlive = state.units.filter((u) => u.side === 'A' && u.alive).length;
    const enemyAlive = state.units.filter((u) => u.side === 'B' && u.alive).length;
    log.summary = {
      winner: 'draw',
      reason: 'max_actions_or_rounds',
      totalRounds: rounds,
      totalActions: actions,
      totalTurns: rounds,
      playerUnitsAlive: playerAlive,
      enemyUnitsAlive: enemyAlive
    };
  }
  log.battleLog = buildBattleLog(state, log);
  log.replay = { seed, frames: replayFrames };
  return log;
}

