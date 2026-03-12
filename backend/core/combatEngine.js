/**
 * Moteur de combat (stub minimal pour démarrage de la stack).
 * À remplacer par une implémentation complète.
 */

/**
 * Calcule les stats scalées selon le niveau (et spé si besoin).
 * @param {Object} unit - Unité avec base_hp, base_attack, base_defense, base_speed, mastery
 * @param {{ level: number, specialization: string|null }} userUnit
 * @returns {{ maxHp: number, attack: number, defense: number, speed: number, mastery: number }}
 */
export function computeScaledStats(unit, userUnit) {
  const level = Math.max(1, Number(userUnit?.level) || 1);
  const scale = 1 + (level - 1) * 0.05;
  const base = (v) => Math.round((Number(v) || 0) * scale);
  return {
    maxHp: base(unit.base_hp),
    attack: base(unit.base_attack),
    defense: base(unit.base_defense),
    speed: base(unit.base_speed),
    mastery: base(unit.mastery) || 0
  };
}

/**
 * Simule un combat entre deux équipes (stub : A gagne par défaut).
 * Retourne battleLog + summary pour compatibilité avec le frontend (logs de combat).
 * @param {Array} teamA
 * @param {Array} teamB
 * @param {Object} config
 * @returns {{ summary: { winner, totalTurns, playerUnitsAlive, enemyUnitsAlive }, events: Array, battleLog: Array }}
 */
export function simulateBattle(teamA, teamB, config = {}) {
  const sideA = (teamA || []).map((u, i) => ({
    side: 'A',
    uid: `A-${i}`,
    name: u.name ?? `Unité A-${i}`,
    hp: u.maxHp != null ? Math.max(0, u.maxHp - 1) : 0
  }));
  const sideB = (teamB || []).map((u, i) => ({
    side: 'B',
    uid: `B-${i}`,
    name: u.name ?? `Ennemi B-${i}`,
    hp: 0
  }));
  const namesA = (teamA || []).map((u, i) => u.name ?? `Unité A-${i}`);
  const namesB = (teamB || []).map((u, i) => u.name ?? `Ennemi B-${i}`);
  const battleLog = [
    { turn: 1, type: 'TURN_START', sourceId: null, sourceName: null, targetId: null, targetName: null, value: null, meta: {}, actorId: null, actorName: null, actionType: 'turn_start', targetId: null, targetName: null, isCrit: false, isBlocked: false, extra: {} },
    { turn: 1, type: 'BASIC_ATTACK', sourceId: 'A-0', sourceName: namesA[0] ?? 'Équipe A', targetId: 'B-0', targetName: namesB[0] ?? 'Ennemi', value: null, meta: {}, actorId: 'A-0', actorName: namesA[0] ?? 'Équipe A', actionType: 'basic_attack', targetId: 'B-0', targetName: namesB[0] ?? 'Ennemi', value: 1, isCrit: false, isBlocked: false, extra: {} },
    { turn: 1, type: 'DAMAGE', sourceId: 'A-0', sourceName: namesA[0] ?? 'Équipe A', targetId: 'B-0', targetName: namesB[0] ?? 'Ennemi', value: 1, meta: { isCrit: false }, actorId: 'A-0', actorName: namesA[0] ?? 'Équipe A', targetId: 'B-0', targetName: namesB[0] ?? 'Ennemi', isCrit: false, isBlocked: false, extra: {} },
    { turn: 1, type: 'DEATH', sourceId: null, sourceName: null, targetId: 'B-0', targetName: namesB[0] ?? 'Ennemi', value: null, meta: {}, actorId: null, actorName: null, actionType: 'death', targetId: 'B-0', targetName: namesB[0] ?? 'Ennemi', isCrit: false, isBlocked: false, extra: {} },
    { turn: 1, type: 'BATTLE_END', sourceId: null, sourceName: null, targetId: null, targetName: null, value: null, meta: {}, actorId: null, actorName: null, actionType: 'battle_end', targetId: null, targetName: null, isCrit: false, isBlocked: false, extra: {} }
  ];
  return {
    summary: {
      winner: 'A',
      totalRounds: 1,
      totalTurns: 1,
      playerUnitsAlive: sideA.filter((u) => u.hp > 0).length,
      enemyUnitsAlive: 0
    },
    events: [{ stateSnapshot: [...sideA, ...sideB] }],
    battleLog
  };
}
