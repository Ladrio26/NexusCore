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
  DAMAGE: {
    requiredOneOf: ['mult', 'percentMaxHp', 'percentMaxHpCaster'],
    optional: ['target', 'count', 'missingHpScaling']
  },
  HEAL: {
    requiredOneOf: ['value', 'percentMaxHp', 'percentMaxHpCaster'],
    optional: ['target']
  },
  APPLY_BUFF: {
    required: ['buffType', 'remainingActions'],
    optional: ['target', 'value', 'percentMaxHp', 'percentMaxHpCaster']
  },
  APPLY_DEBUFF: {
    required: ['debuffType', 'remainingActions'],
    optional: ['target', 'chance']
  },
  STRIP: {
    required: ['count'],
    optional: ['target']
  },
  CLEANSE: {
    optional: ['target', 'count']
  },
  REDUCE_ATB: {
    required: ['percent'],
    optional: ['target']
  },
  ATB_UP: {
    required: ['percent'],
    optional: ['target']
  },
  RESET_SKILL_COOLDOWN: {
    optional: ['target']
  },
  SET_SKILL_COOLDOWN_MAX: {
    optional: ['target']
  },
  STEAL_STAT: {
    required: ['stat', 'percent', 'remainingActions'],
    optional: ['target']
  },
  RESURRECT: {
    requiredOneOf: ['percentHp', 'flatHp'],
    optional: ['target']
  }
};

export const VALID_TARGETS = ['SELF', 'TEAM_ALLY', 'TEAM_ENEMY', 'ENEMY_SINGLE', 'ALLY_SINGLE', 'ALLY_DEAD_SINGLE', 'LOWEST_HP_ALLY'];

/** Buffs et debuffs : un seul type APPLY_BUFF avec buffType (debuff = buffType *_DOWN / SLOW / etc.). */
export const BUFF_TYPES = [
  'ATK_UP', 'DEF_UP', 'SPEED_UP', 'SHIELD', 'DEFEND', 'LIFESTEAL', 'REGEN', 'IMMUNITY', 'INVINCIBILITY', 'COUNTER_ATTACK', 'PROVOKE',
  'ATK_DOWN', 'DEF_DOWN', 'SLOW', 'SILENCE', 'STUN', 'BLIND', 'ANTI_HEAL', 'ANTI_SHIELD', 'ANTI_BUFF', 'DOT'
];

/** @deprecated Utiliser BUFF_TYPES pour APPLY_BUFF (debuff = buffType DEF_DOWN etc.). */
export const DEBUFF_TYPES = ['ATK_DOWN', 'DEF_DOWN', 'SLOW', 'SILENCE', 'STUN', 'BLIND', 'PROVOKE', 'ANTI_HEAL', 'ANTI_SHIELD', 'ANTI_BUFF', 'DOT'];

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
  'ON_DEAL_DAMAGE'
];
