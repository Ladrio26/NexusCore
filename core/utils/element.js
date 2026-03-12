/**
 * Cycle élémentaire : Plante > Eau > Feu > Plante.
 * Retourne true si l'attaquant a l'avantage sur le défenseur.
 * @param {string} attacker - Élément de l'attaquant (fire, water, plant, ou Feu, Eau, Plante)
 * @param {string} defender - Élément du défenseur
 */
export function hasElementAdvantage(attacker, defender) {
  const a = String(attacker || '').toLowerCase().trim();
  const d = String(defender || '').toLowerCase().trim();
  if (!a || !d) return false;
  const plant = 'plant';
  const water = 'water';
  const fire = 'fire';
  const aNorm = a === 'plante' || a === 'plant' ? plant : a === 'eau' || a === 'water' ? water : a === 'feu' || a === 'fire' ? fire : a;
  const dNorm = d === 'plante' || d === 'plant' ? plant : d === 'eau' || d === 'water' ? water : d === 'feu' || d === 'fire' ? fire : d;
  return (
    (aNorm === plant && dNorm === water) ||
    (aNorm === water && dNorm === fire) ||
    (aNorm === fire && dNorm === plant)
  );
}
