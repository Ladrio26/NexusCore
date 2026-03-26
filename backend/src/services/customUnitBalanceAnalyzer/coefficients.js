/**
 * Coefficients centralisés pour l’analyse d’équilibrage (unités roster + arbre custom).
 * Ajuster ici plutôt que dans la logique métier.
 */

/** Plafonds de référence pour normaliser les stats (0–1 avant pondération). */
export const REF_STAT_MAX = {
  hp: 2600,
  attack: 200,
  defense: 200,
  speed: 160,
  mastery: 160
};

/** Pondération finale des blocs dans le score unité roster. */
export const UNIT_SCORE_WEIGHTS = {
  stats: 0.28,
  skill1: 0.26,
  skill2: 0.26,
  synergy: 0.2
};

/** Pondération des sous-scores dans le score d’un skill (somme ≈ 1). */
export const SKILL_SCORE_WEIGHTS = {
  rawEffects: 0.72,
  cooldownEfficiency: 0.18,
  targetingScope: 0.1
};

/** Réduction de valeur par tour de CD (actifs). */
export const CD_PRESSURE = 0.12;

/** Multiplicateur de portée par cible d’effet. */
export const TARGET_SCOPE_MULT = {
  SELF: 0.85,
  ENEMY_SINGLE: 1,
  ALLY_SINGLE: 1,
  LOWEST_HP_ALLY: 1.05,
  ALLY_DEAD_SINGLE: 1.15,
  TEAM_ENEMY: 1.65,
  TEAM_ALLY: 1.55,
  TEAM_ALLY_DEAD: 1.2,
  default: 1
};

/** Valeurs de base par type d’effet (avant modificateurs contextuels). */
export const EFFECT_BASE_VALUE = {
  DAMAGE: 12,
  HEAL: 14,
  APPLY_BUFF: 10,
  APPLY_DEBUFF: 11,
  ATB_UP: 16,
  REDUCE_ATB: 14,
  STRIP: 13,
  CLEANSE: 12,
  RESURRECT: 22,
  STEAL_STAT: 12,
  CD_UP: 8,
  CD_DOWN: 10,
  default: 6
};

/** Bonus par sous-type de buff (clé = buffType). */
export const BUFF_TYPE_MULT = {
  SHIELD: 1.15,
  ATK_UP: 1.05,
  DEF_UP: 1.05,
  SPEED_UP: 1.1,
  REGEN: 1.1,
  IMMUNITY: 1.25,
  INVINCIBILITY: 1.35,
  LIFESTEAL: 1.1,
  COUNTER_ATTACK: 1.05,
  DEFEND: 1.1,
  DOT: 1,
  default: 1
};

/** Bonus par sous-type de debuff. */
export const DEBUFF_TYPE_MULT = {
  STUN: 1.35,
  SILENCE: 1.2,
  SLOW: 1.05,
  PROVOKE: 1.1,
  ATK_DOWN: 1.05,
  DEF_DOWN: 1.05,
  ANTI_HEAL: 1.15,
  ANTI_BUFF: 1.15,
  ANTI_SHIELD: 1.1,
  default: 1
};

/** Cible de puissance custom vs percentile du roster (épique haut / légende bas). */
export const CUSTOM_TARGET_PERCENTILE = {
  /** Percentile visé sur le segment rareté+rôle du roster (0–100). */
  targetPercentile: 72,
  /** Fenêtre acceptable autour de la cible (±). */
  bandWidth: 12
};

/** Seuils pour classer un build custom (écart vs cible normalisée 0–1). */
export const CUSTOM_BUILD_THRESHOLDS = {
  overpowered: 0.22,
  underpowered: -0.18
};

/** Nombre de builds aléatoires par rôle pour l’audit Monte Carlo. */
export const AUDIT_SAMPLES_PER_ROLE = 400;

/** Graine par défaut pour reproductibilité. */
export const DEFAULT_AUDIT_SEED = 42;
