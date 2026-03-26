/**
 * Budget par rôle et coûts en points pour les compétences custom (unités personnalisées).
 * Équilibrage : modifier les valeurs ici.
 */

export const ROLE_POINT_BUDGET = {
  dps: 13,
  assassin: 13,
  tank: 15,
  support: 15
};

/** Coût de base de la compétence 2 (ACTIVE ou PASSIVE) en plus des effets. */
export const SECOND_SKILL_COST = 0;

/** Effets de base (identifiant → coût). */
export const EFFECT_BASE_COSTS = {
  DAMAGE: 1,
  DAMAGE_HP_CASTER: 2,
  DAMAGE_HP_TARGET: 3,
  HEAL: 1,
  RESURRECT: 4,
  STRIP_ONE: 1,
  STRIP_ALL: 2,
  CLEANSE_ONE: 1,
  CLEANSE_ALL: 2,
  ATB_UP_50: 2,
  ATB_UP_100: 3,
  REDUCE_ATB_50: 2,
  REDUCE_ATB_100: 3,
  RESET_SKILL_CD: 4,
  SET_SKILL_CD_MAX: 4,
  CD_UP_1: 2,
  CD_UP_2: 3,
  CD_DOWN_1: 2,
  CD_DOWN_2: 3,
  STEAL_STAT: 3,
  DEFEND: 3,

  ATK_UP: 1,
  DEF_UP: 1,
  SPEED: 1,
  SHIELD: 1,
  IMMUNITY: 3,
  INVINCIBILITY: 4,
  REGEN: 1,

  SILENCE: 1,
  PROVOKE: 3,
  ATK_DOWN: 1,
  DEF_DOWN: 2,
  SLOW: 2,
  ANTI_SHIELD: 1,
  ANTI_HEAL: 1,
  BLIND: 1,
  STUN: 3,
  ANTI_BUFF: 2,
  DOT: 1
};

/** Modificateurs (additifs sur le coût de ligne, avant × cible). */
export const MODIFIER_COSTS = {
  DURATION_1: 1,
  DURATION_2: 2,
  DAMAGE_20_PERCENT: 1
};

/**
 * Multiplicateur de ciblage (après somme effet + mods sur la ligne).
 * Ennemi / allié unique ×1 ; équipes ×3 ; soi / PV bas ×0,8 ; morts ×1 ou ×2.
 */
export const TARGET_COST_MULTIPLIER_BY_TARGET = {
  ENEMY_SINGLE: 1,
  ALLY_SINGLE: 1,
  TEAM_ENEMY: 3,
  TEAM_ALLY: 3,
  SELF: 0.8,
  LOWEST_HP_ALLY: 0.8,
  ALLY_DEAD_SINGLE: 1,
  TEAM_ALLY_DEAD: 2
};

/** Coût budget pour la recharge « Rapide (−1 tour de CD) » (hors effets). */
export const RECHARGE_RAPIDE_BUDGET_COST = 2;

export const PASSIVE_MULTIPLIER_NORMAL = 2;
export const PASSIVE_MULTIPLIER_CRITICAL = 3;

/**
 * Effets « critiques » : passif avec l’un de ces ids = multiplicateur x3 au lieu de x2.
 */
export const PASSIVE_CRITICAL_EFFECT_IDS = new Set([
  'ATB_UP_50',
  'ATB_UP_100',
  'REDUCE_ATB_50',
  'REDUCE_ATB_100',
  'RESET_SKILL_CD',
  'SET_SKILL_CD_MAX',
  'CD_UP_1',
  'CD_UP_2',
  'CD_DOWN_1',
  'CD_DOWN_2',
  'RESURRECT',
  'IMMUNITY',
  'INVINCIBILITY',
  'STUN',
  'PROVOKE',
  'DEF_DOWN',
  'ANTI_BUFF',
  'DEFEND',
  'STEAL_STAT'
]);
