/**
 * Centre de Repos : jusqu'à 6 user_unit_id par joueur ; récupération de fatigue ×2 (points/min).
 */
import { query } from '../config/db.js';

export const REST_CENTER_MAX_SLOTS = 6;
/** Points de fatigue retirés par minute réelle (hors centre : 1). */
export const DEFAULT_FATIGUE_RECOVERY_PER_MINUTE = 1;
/** Au centre de repos. */
export const REST_CENTER_FATIGUE_RECOVERY_PER_MINUTE = 2;

/**
 * @param {unknown} raw — JSON/colonne MySQL
 * @returns {Array<number|null>} toujours longueur REST_CENTER_MAX_SLOTS
 */
export function normalizeRestCenterSlots(raw) {
  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
  }
  if (!Array.isArray(parsed)) {
    return Array(REST_CENTER_MAX_SLOTS).fill(null);
  }
  const out = parsed.map((x) => {
    if (x == null || x === '') return null;
    const n = Number(x);
    return Number.isInteger(n) && n > 0 ? n : null;
  });
  while (out.length < REST_CENTER_MAX_SLOTS) out.push(null);
  return out.slice(0, REST_CENTER_MAX_SLOTS);
}

/** @param {number} userId */
export async function getRestCenterSlotsForUser(userId) {
  const rows = await query('SELECT rest_center_slots FROM users WHERE id = ?', [userId]);
  return normalizeRestCenterSlots(rows[0]?.rest_center_slots);
}

/**
 * @param {number[]} userIds
 * @returns {Promise<Map<number, Set<number>>>} userId -> Set<user_unit_id>
 */
export async function getRestCenterSetsForUserIds(userIds) {
  const unique = [...new Set(userIds.map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  const map = new Map();
  if (!unique.length) return map;
  const ph = unique.map(() => '?').join(',');
  const rows = await query(`SELECT id, rest_center_slots FROM users WHERE id IN (${ph})`, unique);
  for (const r of rows) {
    const set = new Set(normalizeRestCenterSlots(r.rest_center_slots).filter((x) => x != null));
    map.set(Number(r.id), set);
  }
  for (const id of unique) {
    if (!map.has(id)) map.set(id, new Set());
  }
  return map;
}

/** @param {number} userId */
export async function getRestCenterUserUnitIdSet(userId) {
  const m = await getRestCenterSetsForUserIds([userId]);
  return m.get(Number(userId)) ?? new Set();
}

/**
 * @param {number} userId
 * @param {Array<number|null>} slots
 */
export async function saveRestCenterSlots(userId, slots) {
  const normalized = normalizeRestCenterSlots(slots);
  const ids = normalized.filter((x) => x != null);
  const unique = [...new Set(ids)];
  if (unique.length !== ids.length) {
    const err = new Error('REST_CENTER_DUPLICATE_UNIT');
    err.code = 'REST_CENTER_DUPLICATE_UNIT';
    throw err;
  }
  if (unique.length > 0) {
    const ph = unique.map(() => '?').join(',');
    const rows = await query(
      `SELECT id FROM user_units WHERE user_id = ? AND id IN (${ph})`,
      [userId, ...unique]
    );
    if (rows.length !== unique.length) {
      const err = new Error('REST_CENTER_INVALID_UNIT');
      err.code = 'REST_CENTER_INVALID_UNIT';
      throw err;
    }
  }
  await query('UPDATE users SET rest_center_slots = ? WHERE id = ?', [JSON.stringify(normalized), userId]);
  return normalized;
}
