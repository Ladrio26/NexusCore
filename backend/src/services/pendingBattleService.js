import { query } from '../config/db.js';

function parsePayload(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function serializePendingBattle(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    battleType: String(row.battle_type || ''),
    ...(parsePayload(row.payload) || {})
  };
}

export async function getPendingBattle(userId) {
  const rows = await query(
    'SELECT id, battle_type, payload, created_at FROM pending_battles WHERE user_id = ? ORDER BY id DESC LIMIT 1',
    [userId]
  );
  return rows[0] || null;
}

export async function createPendingBattle(userId, battleType, payload) {
  // Supprimer tous les anciens combats en attente avant d'en créer un nouveau
  await query('DELETE FROM pending_battles WHERE user_id = ?', [userId]);
  await query(
    'INSERT INTO pending_battles (user_id, battle_type, payload) VALUES (?, ?, ?)',
    [userId, battleType, JSON.stringify(payload)]
  );
  return getPendingBattle(userId);
}

export async function deletePendingBattle(userId, pendingBattleId) {
  await query(
    'DELETE FROM pending_battles WHERE user_id = ? AND id = ?',
    [userId, pendingBattleId]
  );
}

export async function updatePendingBattlePayload(userId, pendingBattleId, payload) {
  await query(
    'UPDATE pending_battles SET payload = ? WHERE user_id = ? AND id = ?',
    [JSON.stringify(payload), userId, pendingBattleId]
  );
  return getPendingBattle(userId);
}
