import { query } from '../config/db.js';

const MAX_LEVEL = 50;

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
