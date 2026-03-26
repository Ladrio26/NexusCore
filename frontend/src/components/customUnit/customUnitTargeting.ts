/**
 * Règles de ciblage et modificateurs (miroir de backend/src/data/customUnitTargetRules.js).
 */

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

export const ALL_TARGETS_ORDERED: string[] = [
  'ENEMY_SINGLE',
  'TEAM_ENEMY',
  'SELF',
  'ALLY_SINGLE',
  'TEAM_ALLY',
  'ALLY_DEAD_SINGLE',
  'TEAM_ALLY_DEAD',
  'LOWEST_HP_ALLY'
];

export function validateTargetForEffect(effectId: string, target: string): string[] {
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

export function pickDefaultTargetForEffect(effectId: string): string {
  const id = String(effectId || '')
    .trim()
    .toUpperCase();
  if (!id) return 'ENEMY_SINGLE';
  if (id === 'RESURRECT') return 'ALLY_DEAD_SINGLE';
  if (POSITIVE_EFFECT_IDS.has(id)) return 'SELF';
  return 'ENEMY_SINGLE';
}

export function allowedTargetsForEffect(effectId: string): string[] {
  const id = String(effectId || '')
    .trim()
    .toUpperCase();
  if (!id) return [...ALL_TARGETS_ORDERED];
  if (id === 'RESURRECT') return ['ALLY_DEAD_SINGLE', 'TEAM_ALLY_DEAD'];
  const out: string[] = [];
  if (POSITIVE_EFFECT_IDS.has(id)) {
    if (id === 'ATB_UP_100') {
      out.push('SELF', 'ALLY_SINGLE', 'LOWEST_HP_ALLY');
    } else {
      out.push('SELF', 'ALLY_SINGLE', 'TEAM_ALLY', 'LOWEST_HP_ALLY');
    }
  }
  if (NEGATIVE_EFFECT_IDS.has(id)) {
    out.push('ENEMY_SINGLE', 'TEAM_ENEMY');
  }
  if (!out.length) return ['ENEMY_SINGLE'];
  return [...new Set(out)].sort(
    (a, b) => ALL_TARGETS_ORDERED.indexOf(a) - ALL_TARGETS_ORDERED.indexOf(b)
  );
}

export function effectSupportsDurationModifiers(effectId: string): boolean {
  const id = String(effectId || '')
    .trim()
    .toUpperCase();
  return EFFECT_WITH_DURATION_MODIFIERS.has(id);
}

/** Durée +1 / +2 : interdits pour certaines combinaisons (ex. étourdissement d’équipe). */
export function effectAllowsDurationModifier(
  effectId: string,
  mod: string,
  target?: string
): boolean {
  if (!effectSupportsDurationModifiers(effectId)) return false;
  const id = String(effectId || '')
    .trim()
    .toUpperCase();
  const m = String(mod || '')
    .trim()
    .toUpperCase();
  const t = String(target || '')
    .trim()
    .toUpperCase();
  if (id === 'STUN') {
    if (m === 'DURATION_2') return false;
    if (t === 'TEAM_ENEMY') return false;
  }
  return m === 'DURATION_1' || m === 'DURATION_2';
}

/** Dégâts +20 % : uniquement DAMAGE (pas % PV, pas DOT). */
export function effectSupportsDamage20Percent(effectId: string): boolean {
  const id = String(effectId || '')
    .trim()
    .toUpperCase();
  return id === 'DAMAGE';
}

export function sanitizeModifiersForEffect(effectId: string, modifiers: string[], target?: string): string[] {
  const id = String(effectId || '')
    .trim()
    .toUpperCase();
  const tgt = String(target || '')
    .trim()
    .toUpperCase();
  let out = modifiers.map((m) => String(m).toUpperCase()).filter((m) => m !== 'CD_MINUS_1');
  if (!effectSupportsDurationModifiers(id)) {
    out = out.filter((m) => m !== 'DURATION_1' && m !== 'DURATION_2');
  } else if (id === 'STUN') {
    out = out.filter((m) => m !== 'DURATION_2');
    if (tgt === 'TEAM_ENEMY') {
      out = out.filter((m) => m !== 'DURATION_1' && m !== 'DURATION_2');
    }
  }
  if (!effectSupportsDamage20Percent(id)) {
    out = out.filter((m) => m !== 'DAMAGE_20_PERCENT');
  }
  return out;
}

export function clampCooldownModifier(n: number): number {
  return n === -1 ? -1 : 0;
}
