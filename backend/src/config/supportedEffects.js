/**
 * Source de vérité des effets supportés par le moteur de combat.
 * Utilisé pour la validation admin et le formulaire de création d'unités.
 */
import { BUFF_FIXED_VALUES } from '../../../core/buffFixedValues.js';

export { BUFF_FIXED_VALUES };

/** Libellés studio pour affichage admin (bonus lisibilité). */
export const BUFF_FIXED_LABELS = {
  ATK_UP: '+50% attaque',
  DEF_UP: '+50% défense',
  SPEED_UP: '+30% vitesse'
};

export const SUPPORTED_EFFECTS = {
  /**
   * Dégâts directs + bonus flat lié à un effet précédent (ex. STRIP → valuePerRemoved × buffs retirés).
   * scaleMetric : removedCount (défaut), effectiveDamage.
   */
  DAMAGE: {
    requiredOneOf: ['mult', 'percentMaxHp', 'percentMaxHpCaster', 'scaleFromEffectIndex'],
    optional: ['target', 'count', 'missingHpScaling', 'scaleFromEffectIndex', 'valuePerRemoved', 'scaleMetric']
  },
  /**
   * Soin + bonus flat par unité de métrique (ex. CLEANSE → valuePerRemoved × débuffs retirés).
   */
  HEAL: {
    requiredOneOf: ['value', 'percentMaxHp', 'percentMaxHpCaster', 'scaleFromEffectIndex'],
    optional: ['target', 'scaleFromEffectIndex', 'valuePerRemoved', 'scaleMetric']
  },
  APPLY_BUFF: {
    required: ['buffType', 'remainingActions'],
    optional: ['target', 'value', 'percentMaxHp', 'percentMaxHpCaster', 'scaleFromEffectIndex', 'valuePerRemoved', 'scaleMetric']
  },
  APPLY_DEBUFF: {
    required: ['debuffType', 'remainingActions'],
    optional: ['target', 'chance']
  },
  STRIP: {
    required: ['count'],
    optional: ['target', 'chance']
  },
  CLEANSE: {
    optional: ['target', 'count']
  },
  /**
   * Réduit la barre ATB (équivalent « ATB down » instantané côté jauge). Chaînage comme ATB_UP.
   * Exemple : STRIP puis REDUCE_ATB avec percent 0, scaleFromEffectIndex 0, percentPerRemoved 0.05.
   */
  REDUCE_ATB: {
    optional: ['target', 'chance', 'percent', 'scaleFromEffectIndex', 'percentPerRemoved', 'scaleMetric']
  },
  /**
   * Barre d’action : % fixe via `percent` et/ou partie dynamique liée à un effet précédent dans la même compétence.
   * - `scaleFromEffectIndex` : index 0-based d’un effet placé **avant** dans `effects` (ex. 0 = premier effet).
   * - `percentPerRemoved` : % d’ATB ajouté ou retiré **par unité** du compteur `removed` (CLEANSE = débuffs retirés, STRIP = buffs retirés).
   * - `scaleMetric` : `removedCount` (défaut), `effectiveDamage`.
   * Exemple : CLEANSE count 2 + ATB_UP target TEAM_ALLY avec percent 0, scaleFromEffectIndex 0, percentPerRemoved 0.05.
   */
  ATB_UP: {
    optional: ['target', 'chance', 'percent', 'scaleFromEffectIndex', 'percentPerRemoved', 'scaleMetric']
  },
  RESET_SKILL_COOLDOWN: {
    optional: ['target', 'chance']
  },
  SET_SKILL_COOLDOWN_MAX: {
    optional: ['target', 'chance']
  },
  STEAL_STAT: {
    required: ['stat', 'percent', 'remainingActions'],
    optional: ['target', 'chance']
  },
  /** Augmente le cooldown courant de la cible de `value` tours (actions). Probabilité via `chance` (0–1 ou %). */
  CD_UP: {
    required: ['value'],
    optional: ['target', 'chance']
  },
  /** Diminue le cooldown courant de la cible de `value` tours (plancher 0). */
  CD_DOWN: {
    required: ['value'],
    optional: ['target', 'chance']
  },
  RESURRECT: {
    requiredOneOf: ['percentHp', 'flatHp'],
    optional: ['target']
  }
};

export const VALID_TARGETS = [
  'SELF',
  'TEAM_ALLY',
  'TEAM_ENEMY',
  'ENEMY_SINGLE',
  'ALLY_SINGLE',
  'ALLY_DEAD_SINGLE',
  'TEAM_ALLY_DEAD',
  'LOWEST_HP_ALLY'
];

/** Buffs et debuffs : un seul type APPLY_BUFF avec buffType (debuff = buffType *_DOWN / SLOW / etc.). */
export const BUFF_TYPES = [
  'ATK_UP', 'DEF_UP', 'SPEED_UP', 'SHIELD', 'DEFEND', 'LIFESTEAL', 'REGEN', 'IMMUNITY', 'INVINCIBILITY', 'COUNTER_ATTACK', 'PROVOKE',
  'ATK_DOWN', 'DEF_DOWN', 'SLOW', 'SILENCE', 'STUN', 'BLIND', 'ANTI_HEAL', 'ANTI_SHIELD', 'ANTI_BUFF', 'DOT',
  /** APPLY_BUFF + buffType (même schéma que les autres debuffs « buffType »). */
  'DEATH_MARK'
];

/** @deprecated Utiliser BUFF_TYPES pour APPLY_BUFF (debuff = buffType DEF_DOWN etc.). */
export const DEBUFF_TYPES = [
  'ATK_DOWN', 'DEF_DOWN', 'SLOW', 'SILENCE', 'STUN', 'BLIND', 'PROVOKE', 'ANTI_HEAL', 'ANTI_SHIELD', 'ANTI_BUFF', 'DOT',
  /** Expire en fin d’action : explosion 90 % PV max si fin naturelle (pas CLEANSE). */
  'DEATH_MARK'
];

export const STEALABLE_STATS = ['attack', 'defense', 'speed', 'mastery'];

/** Triggers supportés pour les passifs (skill_data.passives[].trigger). */
export const SUPPORTED_TRIGGERS = [
  'ON_ATTACK',
  'ON_HIT',
  'ON_DEATH',
  'ON_KILL',
  'ON_ACTION_START',
  'ON_ACTION_END',
  'ON_RECEIVE_DAMAGE',
  'ON_DEAL_DAMAGE',
  /** Début du combat : avant tout tour ; ordre d'exécution = vitesse effective décroissante. */
  'ON_COMBAT_START',
  /** Un ennemi de l’acteur est mis KO (témoins : alliés du défunt). */
  'ON_ENEMY_KO',
  /** Un allié de l’acteur est mis KO. */
  'ON_ALLY_KO',
  /** Un autre allié (pas soi) subit des dégâts ; contexte : source = attaquant, target = blessé. */
  'ON_ALLY_RECEIVE_DAMAGE',
  /** Un ennemi commence son tour (ATB) ; déclenché pour chaque unité adverse avant ON_ACTION_START de cet ennemi. */
  'ON_ENEMY_TURN_START',
  /**
   * S’exécute à chaque déclenchement de passif (en plus des passifs du trigger courant).
   * Utile pour des effets qui doivent suivre toute l’action / tous les événements.
   */
  'ALWAYS'
];

/**
 * Passif sans déclencheur : permanent sur le terrain (pas d'effet à lister).
 * - DEBUFF_IMMUNITY : immunise aux débuffs, STRIP, réduction d’ATB, SET_SKILL_COOLDOWN_MAX, CD_UP, vol de stat, etc.
 * - STEEL : value = % réduction des dégâts directs (attaques de base, DAMAGE, etc. ; pas les DoT).
 * - MULTI_HIT_SHIELD : value = nombre de sources de dégâts absorbées par tour (directs, DoT, etc.) ; réinitialisé au début de chaque tour de l’unité.
 */
export const PASSIVE_KINDS_PERMANENT = ['DEBUFF_IMMUNITY', 'STEEL', 'MULTI_HIT_SHIELD'];
