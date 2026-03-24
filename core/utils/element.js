/**
 * Cycle élémentaire : Plante > Eau > Feu > Plante.
 * Lumière et Ténèbre : neutres vs feu/eau/plante, forts l'un contre l'autre (lumière > ténèbre, ténèbre > lumière).
 * Retourne true si l'attaquant a l'avantage sur le défenseur.
 * @param {string} attacker - Élément de l'attaquant (fire, water, plant, light, dark, ou variantes FR)
 * @param {string} defender - Élément du défenseur
 */
export function hasElementAdvantage(attacker, defender) {
  const a = String(attacker || '').toLowerCase().trim();
  const d = String(defender || '').toLowerCase().trim();
  if (!a || !d) return false;
  const plant = 'plant';
  const water = 'water';
  const fire = 'fire';
  const light = 'light';
  const dark = 'dark';
  const aNorm = a === 'plante' || a === 'plant' ? plant : a === 'eau' || a === 'water' ? water : a === 'feu' || a === 'fire' ? fire : a === 'lumiere' || a === 'lumière' || a === 'light' ? light : a === 'tenebre' || a === 'ténèbre' || a === 'tenebres' || a === 'ténèbres' || a === 'dark' ? dark : a;
  const dNorm = d === 'plante' || d === 'plant' ? plant : d === 'eau' || d === 'water' ? water : d === 'feu' || d === 'fire' ? fire : d === 'lumiere' || d === 'lumière' || d === 'light' ? light : d === 'tenebre' || d === 'ténèbre' || d === 'tenebres' || d === 'ténèbres' || d === 'dark' ? dark : d;
  // Cycle classique : Plante > Eau > Feu > Plante
  if (
    (aNorm === plant && dNorm === water) ||
    (aNorm === water && dNorm === fire) ||
    (aNorm === fire && dNorm === plant)
  ) return true;
  // Lumière et Ténèbre : forts l'un contre l'autre
  if (aNorm === light && dNorm === dark) return true;
  if (aNorm === dark && dNorm === light) return true;
  return false;
}
