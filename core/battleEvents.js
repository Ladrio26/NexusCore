/**
 * Types d'événements du journal de combat (battleLog).
 * Centralise tous les types pour cohérence moteur / frontend.
 */
export const BattleEventType = {
  TURN_START: 'TURN_START',
  TURN_END: 'TURN_END',
  BASIC_ATTACK: 'BASIC_ATTACK',
  SKILL_CAST: 'SKILL_CAST',
  DAMAGE: 'DAMAGE',
  HEAL: 'HEAL',
  SHIELD: 'SHIELD',
  SHIELD_ABSORB: 'SHIELD_ABSORB',
  IMMUNE: 'IMMUNE',
  BUFF_APPLY: 'BUFF_APPLY',
  BUFF_TICK: 'BUFF_TICK',
  BUFF_REMOVE: 'BUFF_REMOVE',
  DEBUFF_APPLY: 'DEBUFF_APPLY',
  DEBUFF_TICK: 'DEBUFF_TICK',
  DEBUFF_REMOVE: 'DEBUFF_REMOVE',
  DEBUFF_RESIST: 'DEBUFF_RESIST',
  STRIP: 'STRIP',
  CLEANSE: 'CLEANSE',
  REDUCE_ATB: 'REDUCE_ATB',
  ATB_UP: 'ATB_UP',
  ATB_DOWN: 'ATB_DOWN',
  DEATH: 'DEATH',
  RESURRECT: 'RESURRECT',
  COUNTER_ATTACK: 'COUNTER_ATTACK',
  DEFEND_REDIRECT: 'DEFEND_REDIRECT',
  PASSIVE_TRIGGER: 'PASSIVE_TRIGGER',
  SYNERGY_TRIGGER: 'SYNERGY_TRIGGER',
  BOSS_TRIGGER: 'BOSS_TRIGGER',
  EFFECT_APPLY: 'EFFECT_APPLY',
  STUN_SKIP: 'STUN_SKIP',
  DOT_DAMAGE: 'DOT_DAMAGE',
  BATTLE_END: 'BATTLE_END'
};

/**
 * Crée une entrée battleLog normalisée.
 * @param {number} turn
 * @param {string} type - BattleEventType
 * @param {string|null} sourceId
 * @param {string|null} sourceName
 * @param {string|null} targetId
 * @param {string|null} targetName
 * @param {number|null} value
 * @param {Object} meta
 */
export function createBattleLogEntry(turn, type, sourceId, sourceName, targetId, targetName, value, meta = {}) {
  return {
    turn,
    type,
    sourceId: sourceId ?? null,
    sourceName: sourceName ?? null,
    targetId: targetId ?? null,
    targetName: targetName ?? null,
    value: value != null ? value : null,
    meta: meta && typeof meta === 'object' ? meta : {}
  };
}
