/**
 * Durée de base en tours pour les effets avec remainingActions (hors modificateurs Durée +1/+2).
 * Effets « puissants » : 1 tour. Effets standards : 2 tours.
 * Les effets instantanés (dégâts, soin, ATB, strip, etc.) n’utilisent pas ce réglage.
 */

const ONE_TURN_BASE = new Set([
  'STUN',
  'PROVOKE',
  'IMMUNITY',
  'INVINCIBILITY',
  'DEF_DOWN',
  'STEAL_STAT',
  'DEFEND'
]);

/**
 * @param {string} effectId
 * @returns {number} 1 ou 2 (défaut 2 pour tout effet à durée non listé en « puissant »)
 */
export function getBaseDurationTurnsForEffect(effectId) {
  const id = String(effectId || '')
    .trim()
    .toUpperCase();
  if (ONE_TURN_BASE.has(id)) return 1;
  return 2;
}
