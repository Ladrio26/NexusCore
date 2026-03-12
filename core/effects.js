// Gestion des buffs / debuffs non stackables (on ne cumule pas les valeurs
// d'un même type, on réinitialise la durée en actions de la cible).

export const EffectType = {
  SILENCE: 'SILENCE',
  PROVOKE: 'PROVOKE',
  ATK_DOWN: 'ATK_DOWN',
  ATK_UP: 'ATK_UP',
  DEF_DOWN: 'DEF_DOWN',
  DEF_UP: 'DEF_UP',
  SHIELD: 'SHIELD',
  ANTI_SHIELD: 'ANTI_SHIELD',
  HEAL_BONUS: 'HEAL_BONUS',
  ANTI_HEAL: 'ANTI_HEAL',
  ATB_UP: 'ATB_UP',
  ATB_DOWN: 'ATB_DOWN',
  SLOW: 'SLOW',
  SPEED: 'SPEED',
  IMMUNITY: 'IMMUNITY',
  COUNTER_ATTACK: 'COUNTER_ATTACK',
  RESURRECT: 'RESURRECT',
  INVINCIBILITY: 'INVINCIBILITY',
  BLIND: 'BLIND',
  REGEN: 'REGEN',
  STUN: 'STUN',
  ANTI_BUFF: 'ANTI_BUFF',
  DOT: 'DOT',
  DEFEND: 'DEFEND',
  STAT_STEAL_BUFF: 'STAT_STEAL_BUFF',
  STAT_STEAL_DEBUFF: 'STAT_STEAL_DEBUFF'
};

function normalizeStatKey(stat) {
  const raw = String(stat || '').trim().toLowerCase();
  if (raw === 'atk') return 'attack';
  if (raw === 'def') return 'defense';
  if (raw === 'spd') return 'speed';
  return raw;
}

function applyFlatStatModifier(target, stat, value) {
  const amount = Number(value) || 0;
  switch (normalizeStatKey(stat)) {
    case 'attack':
      target.atkFlat += amount;
      break;
    case 'defense':
      target.defFlat += amount;
      break;
    case 'speed':
      target.speedFlat += amount;
      break;
    case 'mastery':
      target.masteryFlat += amount;
      break;
    default:
      break;
  }
}

/**
 * Normalise une configuration d'effet en un status interne enrichi.
 * Ne change pas la logique de jeu actuelle : fournit seulement des
 * champs supplémentaires (key, sourceId, meta, chance) pour usage futur.
 */
function normalizeStatusInput(effectConfig, sourceId) {
  const cfg = effectConfig || {};
  const type = cfg.type;
  return {
    type,
    key: cfg.key ?? type,
    value: cfg.value ?? 0,
    remainingActions: cfg.remainingActions ?? 0,
    isDebuff: !!cfg.isDebuff,
    sourceId: sourceId ?? null,
    meta: cfg.meta ?? {},
    chance: cfg.chance ?? 1
  };
}

/** Un seul buff par (type, sourceId) : refresh durée si déjà présent, sinon push. */
function applyBuff(target, buff) {
  if (!target.buffs) target.buffs = [];
  const type = buff.type || buff.key;
  const sourceId = buff.sourceId;
  const existing = target.buffs.find((b) => (b.type || b.key) === type && b.sourceId === sourceId);
  if (existing) {
    existing.remainingActions = Math.max(
      existing.remainingActions ?? 0,
      buff.remainingActions ?? 0
    );
    return;
  }
  target.buffs.push({ ...buff });
}

/** Un seul debuff par (type, sourceId) : refresh durée si déjà présent, sinon push. */
function applyDebuff(target, debuff) {
  if (!target.debuffs) target.debuffs = [];
  const type = debuff.type || debuff.key;
  const sourceId = debuff.sourceId;
  const existing = target.debuffs.find((d) => (d.type || d.key) === type && d.sourceId === sourceId);
  if (existing) {
    existing.remainingActions = Math.max(
      existing.remainingActions ?? 0,
      debuff.remainingActions ?? 0
    );
    return;
  }
  target.debuffs.push({ ...debuff });
}

/** Retire un buff par type + sourceId (splice en place, ne recrée pas le tableau). */
export function removeBuff(target, buffType, sourceId) {
  if (!target.buffs) return;
  for (let i = target.buffs.length - 1; i >= 0; i--) {
    const b = target.buffs[i];
    if ((b.type || b.key) === buffType && b.sourceId === sourceId) {
      target.buffs.splice(i, 1);
    }
  }
}

/** Retire un debuff par type + sourceId (splice en place). */
export function removeDebuff(target, debuffType, sourceId) {
  if (!target.debuffs) return;
  for (let i = target.debuffs.length - 1; i >= 0; i--) {
    const d = target.debuffs[i];
    if ((d.type || d.key) === debuffType && d.sourceId === sourceId) {
      target.debuffs.splice(i, 1);
    }
  }
}

/** True si l'unité a au moins un debuff du type donné. */
export function hasDebuff(unit, debuffType) {
  if (!unit?.debuffs) return false;
  const wanted = String(debuffType || '').toUpperCase();
  return unit.debuffs.some((d) => (d.type || d.key || '').toUpperCase() === wanted);
}

export function applyEffect(target, effect) {
  if (!target.alive) return;
  const typeToMatch = effect.type || effect.buffType || effect.debuffType;
  if (!typeToMatch) return;

  // ANTI_BUFF : empêche l'unité de recevoir de nouveaux buffs (pas les debuffs, pas SHIELD qui passe par applyShield).
  if (!effect.isDebuff && typeToMatch !== EffectType.SHIELD && hasDebuff(target, EffectType.ANTI_BUFF)) {
    return;
  }

  const normalized = normalizeStatusInput(effect, effect.sourceId);
  const duration = effect.remainingActions ?? effect.duration ?? 1;
  normalized.remainingActions = typeof duration === 'number' && duration >= 0 ? duration : 1;
  if (!normalized.type) normalized.type = typeToMatch;
  if (!normalized.key) normalized.key = typeToMatch;

  // SHIELD : stackable par défaut — chaque application = un buff séparé (applyShield dans le moteur).
  // DOT : debuff cumulable (chaque application = une stack).
  const isShield = typeToMatch === EffectType.SHIELD;
  const isRegen = typeToMatch === EffectType.REGEN && !effect.isDebuff;
  const isDot = typeToMatch === EffectType.DOT && !!effect.isDebuff;
  const isStatSteal = typeToMatch === EffectType.STAT_STEAL_BUFF || typeToMatch === EffectType.STAT_STEAL_DEBUFF;
  const stackable = isShield ? (effect.stackable !== false) : (isDot || isRegen || isStatSteal);

  if (stackable) {
    if (effect.isDebuff) {
      if (!target.debuffs) target.debuffs = [];
      target.debuffs.push({ ...normalized });
    } else if (!isShield) {
      // Buff stackable autre que SHIELD (rare)
      if (!target.buffs) target.buffs = [];
      target.buffs.push({ ...normalized });
    } else {
      if (!target.buffs) target.buffs = [];
      target.buffs.push({ ...normalized });
    }
    return;
  }

  if (effect.isDebuff) {
    applyDebuff(target, normalized);
  } else {
    applyBuff(target, normalized);
  }
}

/**
 * Wrapper non destructif autour de applyEffect, à utiliser
 * par les nouveaux effets pour bénéficier du modèle enrichi.
 * N'est pas encore utilisé par le moteur existant.
 */
export function applyStatus(target, effectConfig, sourceId) {
  const normalized = normalizeStatusInput(effectConfig, sourceId);
  applyEffect(target, normalized);
}

export function onUnitActionEnd(unit) {
  // La durée est exprimée en "actions de la cible".
  // Chaque buff/debuff a sa propre durée (ex. chaque stack DOT a son remainingActions).
  // On décrémente de 1 la durée de chaque entrée ; on retire uniquement celles dont la durée tombe à 0
  // (tous les stacks qui n’avaient plus qu’un tour disparaissent, les autres perdent 1 tour).
  decrementBucket(unit.buffs);
  decrementBucket(unit.debuffs);
}

function decrementBucket(bucket) {
  if (!bucket) return;
  for (const e of bucket) {
    if (e.remainingActions > 0) {
      e.remainingActions -= 1;
    }
  }
  for (let i = bucket.length - 1; i >= 0; i -= 1) {
    if (bucket[i].remainingActions <= 0) {
      bucket.splice(i, 1);
    }
  }
}

export function getStatModifiers(unit) {
  let atkMul = 1;
  let defMul = 1;
  let speedMul = 1;
  const flatMods = { atkFlat: 0, defFlat: 0, speedFlat: 0, masteryFlat: 0 };
  let shieldAntiMul = 1;
  let healMul = 1;
  let healReceiveMul = 1;
  let blindChance = 0;
  let shieldReceiveMul = 1;

  const all = [...(unit.buffs || []), ...(unit.debuffs || [])];
  for (const e of all) {
    const t = (e.type || e.key || '').toUpperCase();
    switch (t) {
      case 'ATK_DOWN':
        atkMul *= 0.7; // -30%
        break;
      case 'ATK_UP':
        atkMul *= 1.5; // +50%
        break;
      case 'DEF_DOWN':
        defMul *= 0.7; // -30%
        break;
      case 'DEF_UP':
        defMul *= 1.5; // +50%
        break;
      case 'SPEED_UP':
      case 'SLOW':
        speedMul *= t === 'SLOW' ? 0.8 : 1.3;
        break;
      case 'SPEED':
        speedMul *= 1.3; // +30% vitesse
        break;
      case 'ANTI_SHIELD':
        shieldAntiMul = 0; // empêche tout nouveau bouclier (géré aussi dans applyShield)
        break;
      case 'HEAL_BONUS':
        healMul *= 1.1;
        break;
      case 'ANTI_HEAL':
        healReceiveMul = 0; // empêche tout soin reçu
        break;
      case 'BLIND':
        blindChance = Math.max(blindChance, 0.25);
        break;
      case 'STAT_STEAL_BUFF':
        applyFlatStatModifier(flatMods, e.meta?.stat, e.value);
        break;
      case 'STAT_STEAL_DEBUFF':
        applyFlatStatModifier(flatMods, e.meta?.stat, -Math.abs(Number(e.value) || 0));
        break;
      default:
        break;
    }
  }

  // Bonus de synergie côté unité (ex: DRUIDS 2 pour soins/boucliers reçus)
  if (unit.druidLevel >= 2) {
    healReceiveMul *= 1.1;
    shieldReceiveMul *= 1.1;
  }

  return {
    atkMul,
    defMul,
    speedMul,
    atkFlat: flatMods.atkFlat,
    defFlat: flatMods.defFlat,
    speedFlat: flatMods.speedFlat,
    masteryFlat: flatMods.masteryFlat,
    shieldAntiMul,
    healMul,
    healReceiveMul,
    shieldReceiveMul,
    blindChance
  };
}

export function getEffectiveCombatStats(unit) {
  const mods = getStatModifiers(unit);
  const baseAttack = unit.attack ?? unit.base_attack ?? 0;
  const baseDefense = unit.defense ?? unit.base_defense ?? 0;
  const baseSpeed = unit.speed ?? unit.base_speed ?? 0;
  const baseMastery = unit.mastery ?? 0;
  return {
    attack: Math.max(0, Math.round(baseAttack * mods.atkMul + mods.atkFlat)),
    defense: Math.max(0, Math.round(baseDefense * mods.defMul + mods.defFlat)),
    speed: Math.max(1, Math.round(baseSpeed * mods.speedMul + mods.speedFlat)),
    mastery: Math.max(0, Math.round(baseMastery + mods.masteryFlat))
  };
}

/**
 * Calcule le heal sans modifier target.hp. Le moteur doit appliquer via setUnitHp(target, hpAfter, state).
 */
export function applyHeal(target, baseAmount) {
  if (!baseAmount || baseAmount <= 0 || target.alive !== true) {
    return {
      applied: 0,
      hpBefore: target.hp,
      hpAfter: target.hp
    };
  }
  const mods = getStatModifiers(target);
  let amount = baseAmount * mods.healReceiveMul;
  amount = Math.round(amount);
  if (amount <= 0) {
    return {
      applied: 0,
      hpBefore: target.hp,
      hpAfter: target.hp
    };
  }
  const hpBefore = target.hp;
  const hpAfter = Math.min(target.maxHp, target.hp + amount);
  return {
    applied: hpAfter - hpBefore,
    hpBefore,
    hpAfter
  };
}

/**
 * Ajoute un buff SHIELD dans target.buffs (plus de target.shield).
 * value et remainingActions sont déjà calculés par l'appelant (moteur).
 */
export function applyShield(target, baseValue, remainingActions = 1, sourceId = null) {
  if (!baseValue || baseValue <= 0 || target.alive !== true) {
    return { applied: 0, shieldBefore: getShieldTotal(target), shieldAfter: getShieldTotal(target) };
  }
  // ANTI_SHIELD : empêche tout nouveau bouclier (les boucliers déjà posés restent).
  if (hasDebuff(target, EffectType.ANTI_SHIELD)) {
    return { applied: 0, shieldBefore: getShieldTotal(target), shieldAfter: getShieldTotal(target) };
  }
  const mods = getStatModifiers(target);
  let value = baseValue * mods.shieldReceiveMul * mods.shieldAntiMul;
  value = Math.round(value);
  if (value <= 0) {
    return { applied: 0, shieldBefore: getShieldTotal(target), shieldAfter: getShieldTotal(target) };
  }
  const before = getShieldTotal(target);
  if (!target.buffs) target.buffs = [];
  const dur = typeof remainingActions === 'number' && remainingActions >= 0 ? remainingActions : 1;
  target.buffs.push({
    type: EffectType.SHIELD,
    key: EffectType.SHIELD,
    value,
    remainingActions: dur,
    sourceId: sourceId ?? null,
    isDebuff: false
  });
  return {
    applied: value,
    shieldBefore: before,
    shieldAfter: getShieldTotal(target)
  };
}

/** Somme des value de tous les buffs SHIELD (remplace l'ancien target.shield). */
export function getShieldTotal(unit) {
  if (!unit?.buffs) return 0;
  return unit.buffs.filter((b) => (b.type || b.key) === EffectType.SHIELD).reduce((s, b) => s + (Number(b.value) || 0), 0);
}

/**
 * Consomme du shield par dégâts : retire amount des buffs SHIELD (FIFO).
 * Retire les buffs dont value tombe à 0.
 * @returns { number } dégâts restants après absorption (0 si tout absorbé).
 */
export function consumeShieldBuffs(unit, amount) {
  if (!amount || amount <= 0) return 0;
  let remaining = amount;
  const shields = (unit.buffs || []).filter((b) => (b.type || b.key) === EffectType.SHIELD);
  for (const b of shields) {
    if (remaining <= 0) break;
    const v = Number(b.value) || 0;
    if (v <= 0) continue;
    const consume = Math.min(v, remaining);
    b.value = v - consume;
    remaining -= consume;
  }
  for (let i = (unit.buffs || []).length - 1; i >= 0; i--) {
    if ((unit.buffs[i].type || unit.buffs[i].key) === EffectType.SHIELD && (Number(unit.buffs[i].value) || 0) <= 0) {
      unit.buffs.splice(i, 1);
    }
  }
  return remaining;
}

