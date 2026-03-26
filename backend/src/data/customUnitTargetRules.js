/**
 * Règles de ciblage par effet (unités custom) — alignées sur l’UI.
 */

/** Effets « positifs » : alliés / soi (hors résurrection, traitée à part). */
export const POSITIVE_EFFECT_IDS = new Set([
  'HEAL',
  'REGEN',
  'CLEANSE_ONE',
  'CLEANSE_ALL',
  'ATK_UP',
  'DEF_UP',
  'SPEED',
  'SHIELD',
  'IMMUNITY',
  'INVINCIBILITY',
  'DEFEND',
  'CD_DOWN_1',
  'CD_DOWN_2',
  'RESET_SKILL_CD',
  'ATB_UP_50',
  'ATB_UP_100'
]);

/** Effets « négatifs » : ennemis. */
export const NEGATIVE_EFFECT_IDS = new Set([
  'DAMAGE',
  'DAMAGE_HP_CASTER',
  'DAMAGE_HP_TARGET',
  'DOT',
  'STRIP_ONE',
  'STRIP_ALL',
  'SILENCE',
  'PROVOKE',
  'ATK_DOWN',
  'DEF_DOWN',
  'SLOW',
  'ANTI_SHIELD',
  'ANTI_HEAL',
  'BLIND',
  'STUN',
  'REDUCE_ATB_50',
  'REDUCE_ATB_100',
  'SET_SKILL_CD_MAX',
  'CD_UP_1',
  'CD_UP_2',
  'STEAL_STAT',
  'ANTI_BUFF'
]);

/** Modificateurs de durée applicables uniquement à ces effets. */
export const EFFECT_WITH_DURATION_MODIFIERS = new Set([
  'STEAL_STAT',
  'DEFEND',
  'ATK_UP',
  'DEF_UP',
  'SPEED',
  'SHIELD',
  'IMMUNITY',
  'INVINCIBILITY',
  'REGEN',
  'DOT',
  'SILENCE',
  'PROVOKE',
  'ATK_DOWN',
  'DEF_DOWN',
  'SLOW',
  'ANTI_SHIELD',
  'ANTI_HEAL',
  'BLIND',
  'STUN',
  'ANTI_BUFF'
]);

const TARGET_DEAD = new Set(['ALLY_DEAD_SINGLE', 'TEAM_ALLY_DEAD']);
const TARGET_POSITIVE = new Set(['SELF', 'ALLY_SINGLE', 'TEAM_ALLY', 'LOWEST_HP_ALLY']);
const TARGET_NEGATIVE = new Set(['ENEMY_SINGLE', 'TEAM_ENEMY']);

const MSG = {
  resurrectOnlyDead: 'La résurrection ne cible que les unités mortes.',
  deadOnlyResurrect: 'Les cibles « mortes » sont réservées à la résurrection.',
  positiveOnly: 'Cette cible alliée est réservée aux effets positifs.',
  negativeOnly: 'Cette cible ennemie est réservée aux effets négatifs.',
  unknownTarget: 'Cible invalide pour cet effet.',
  atb100NoTeamAlly: 'L’ATB +100 % ne peut pas cibler toute l’équipe alliée.'
};

/**
 * @param {string} effectId
 * @param {string} target
 * @returns {string[]}
 */
export function validateTargetForEffect(effectId, target) {
  const id = String(effectId || '')
    .trim()
    .toUpperCase();
  const t = String(target || '')
    .trim()
    .toUpperCase();
  if (!id) return [];

  if (id === 'RESURRECT') {
    if (!TARGET_DEAD.has(t)) return [MSG.resurrectOnlyDead];
    return [];
  }

  if (id === 'ATB_UP_100' && t === 'TEAM_ALLY') {
    return [MSG.atb100NoTeamAlly];
  }

  if (TARGET_DEAD.has(t)) return [MSG.deadOnlyResurrect];

  if (TARGET_POSITIVE.has(t)) {
    if (!POSITIVE_EFFECT_IDS.has(id)) return [MSG.positiveOnly];
    return [];
  }

  if (TARGET_NEGATIVE.has(t)) {
    if (!NEGATIVE_EFFECT_IDS.has(id)) return [MSG.negativeOnly];
    return [];
  }

  return [MSG.unknownTarget];
}

/**
 * @param {string} effectId
 * @returns {string}
 */
export function pickDefaultTargetForEffect(effectId) {
  const id = String(effectId || '')
    .trim()
    .toUpperCase();
  if (!id) return 'ENEMY_SINGLE';
  if (id === 'RESURRECT') return 'ALLY_DEAD_SINGLE';
  if (POSITIVE_EFFECT_IDS.has(id)) return 'SELF';
  return 'ENEMY_SINGLE';
}

/**
 * @param {string} effectId
 * @param {string[]} modifiers
 * @param {string} [target] — cible de la ligne (pour règles STUN / durée)
 * @returns {string[]}
 */
export function sanitizeModifiersForEffect(effectId, modifiers, target) {
  const id = String(effectId || '')
    .trim()
    .toUpperCase();
  const tgt = String(target || '')
    .trim()
    .toUpperCase();
  const arr = Array.isArray(modifiers) ? modifiers.map((m) => String(m).toUpperCase()) : [];
  let out = arr.filter((m) => m !== 'CD_MINUS_1');
  if (!EFFECT_WITH_DURATION_MODIFIERS.has(id)) {
    out = out.filter((m) => m !== 'DURATION_1' && m !== 'DURATION_2');
  } else if (id === 'STUN') {
    out = out.filter((m) => m !== 'DURATION_2');
    if (tgt === 'TEAM_ENEMY') {
      out = out.filter((m) => m !== 'DURATION_1' && m !== 'DURATION_2');
    }
  }
  if (id !== 'DAMAGE') {
    out = out.filter((m) => m !== 'DAMAGE_20_PERCENT');
  }
  return out;
}
