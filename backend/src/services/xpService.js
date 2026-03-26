import { query } from '../config/db.js';

export const MAX_LEVEL = 50;

/**
 * XP requis pour passer du niveau `level` au niveau `level + 1`.
 * @param {number} level
 * @returns {number}
 */
export function getXpRequired(level) {
  return 120 + (level * level * 6);
}

// Validation : XP totale nécessaire pour level 1 → 50
(function () {
  let total = 0;
  for (let level = 1; level < MAX_LEVEL; level++) {
    total += getXpRequired(level);
  }
  console.log(`[xpService] XP totale nécessaire pour level 1→50 : ${total}`);
})();

/**
 * Ajoute de l'XP à une user_unit et monte de niveau si seuil atteint (max level 50).
 * @param {number} userUnitId
 * @param {number} amount
 * @returns {Promise<{ level: number, xp: number, levelsGained: number }>}
 */
export async function addXp(userUnitId, amount) {
  const rows = await query(
    'SELECT id, level, xp FROM user_units WHERE id = ?',
    [userUnitId]
  );
  if (!rows.length) {
    throw new Error('USER_UNIT_NOT_FOUND');
  }

  let { level, xp } = rows[0];
  let totalXp = (xp ?? 0) + amount;
  let levelsGained = 0;

  while (level < MAX_LEVEL) {
    const required = getXpRequired(level);
    if (totalXp < required) break;
    totalXp -= required;
    level += 1;
    levelsGained += 1;
  }

  await query(
    'UPDATE user_units SET level = ?, xp = ? WHERE id = ?',
    [level, totalXp, userUnitId]
  );

  return { level, xp: totalXp, levelsGained };
}

/**
 * Donne de l’XP à plusieurs user_units (ex. unités survivantes en campagne).
 * @param {Array<number>} userUnitIds
 * @param {number} amountPerUnit
 * @returns {Promise<Array<{ userUnitId: number, level: number, xp: number, levelsGained: number }>>}
 */
export async function grantXpToSurvivors(userUnitIds, amountPerUnit) {
  const results = [];
  for (const id of userUnitIds) {
    try {
      const r = await addXp(id, amountPerUnit);
      results.push({ userUnitId: id, ...r });
    } catch (_) {
      results.push({ userUnitId: id, error: true });
    }
  }
  return results;
}

/**
 * Campagne / PvP : l'XP prévue pour les unités déjà niveau max est répartie (parts égales entières)
 * entre les unités survivantes qui ne sont pas encore niveau max.
 * @param {number[]} userUnitIds ordre conservé pour déterminisme des +1 XP de reste
 * @param {Map<number, number>} levelById
 * @param {Map<number, number>} rawAmountById XP calculée par unité (fatigue, boost artefact, etc.)
 * @returns {Map<number, number>} XP à appliquer par id (0 si niveau max sans bénéficiaire alternatif)
 */
export function redistributeXpFromMaxLevelUnits(userUnitIds, levelById, rawAmountById) {
  const uniqueIds = [...new Set(userUnitIds.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0))];
  let overflow = 0;
  const below = [];
  for (const id of uniqueIds) {
    const lvl = Number(levelById.get(id) ?? 1);
    const amt = Math.max(0, Math.floor(Number(rawAmountById.get(id) ?? 0)));
    if (lvl >= MAX_LEVEL) {
      overflow += amt;
    } else {
      below.push(id);
    }
  }
  const out = new Map();
  if (below.length === 0) {
    for (const id of uniqueIds) out.set(id, 0);
    return out;
  }
  const extraPer = Math.floor(overflow / below.length);
  const rem = overflow - extraPer * below.length;
  /** Ordre stable : même ordre que dans l'équipe (premières unités reçoivent le +1 de reste) */
  const belowOrdered = uniqueIds.filter((id) => below.includes(id));
  for (let i = 0; i < belowOrdered.length; i++) {
    const id = belowOrdered[i];
    const base = Math.max(0, Math.floor(Number(rawAmountById.get(id) ?? 0)));
    out.set(id, base + extraPer + (i < rem ? 1 : 0));
  }
  for (const id of uniqueIds) {
    const lvl = Number(levelById.get(id) ?? 1);
    if (lvl >= MAX_LEVEL) out.set(id, 0);
  }
  return out;
}
