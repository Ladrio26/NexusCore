import { query } from '../config/db.js';

// Formule Elo simple avec K factor configurable
// Ne gère PAS le multiplicateur fantôme (appliqué plus loin)
function computeEloChange(ratingA, ratingB, scoreA, { kFactor = 32 } = {}) {
  const expectedA = 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
  const deltaA = Math.round(kFactor * (scoreA - expectedA));
  const deltaB = -deltaA;
  return { deltaA, deltaB };
}

export async function enqueueRanked(userId) {
  const users = await query('SELECT elo, last_opponent_id FROM users WHERE id = ?', [userId]);
  if (!users.length) {
    throw new Error('USER_NOT_FOUND');
  }
  const { elo, last_opponent_id: lastOpponentId } = users[0];

  await query(
    'UPDATE matchmaking_queue SET status = "cancelled" WHERE user_id = ? AND status = "queued"',
    [userId]
  );

  await query(
    `INSERT INTO matchmaking_queue (user_id, mode, elo_snapshot, status, search_start_at, last_search_at, current_range)
     VALUES (?, 'ranked', ?, 'queued', NOW(), NOW(), 50)`,
    [userId, elo]
  );

  const match = await findMatchForUser(userId, elo, lastOpponentId);
  return match;
}

export async function cancelQueue(userId) {
  await query(
    'UPDATE matchmaking_queue SET status = "cancelled" WHERE user_id = ? AND status = "queued"',
    [userId]
  );
}

export async function getQueueStatus(userId) {
  const rows = await query(
    'SELECT id, status, elo_snapshot, search_start_at, current_range FROM matchmaking_queue WHERE user_id = ? ORDER BY id DESC LIMIT 1',
    [userId]
  );
  if (!rows.length) return { status: 'idle' };
  return rows[0];
}

async function findMatchForUser(userId, elo, lastOpponentId) {
  const ranges = [50, 100, 200];

  for (const range of ranges) {
    const opponents = await query(
      `SELECT q.user_id, q.elo_snapshot
       FROM matchmaking_queue q
       WHERE q.status = 'queued'
         AND q.user_id != ?
         AND q.user_id != IFNULL(?, -1)
         AND ABS(q.elo_snapshot - ?) <= ?
       ORDER BY q.search_start_at ASC
       LIMIT 1`,
      [userId, lastOpponentId, elo, range]
    );

    if (opponents.length) {
      const opponent = opponents[0];
      await query(
        'UPDATE matchmaking_queue SET status = "matched", opponent_id = ?, updated_at = NOW() WHERE user_id IN (?, ?)',
        [opponent.user_id, userId, opponent.user_id]
      );

      const userRow = await query('SELECT elo FROM users WHERE id = ?', [userId]);
      const oppRow = await query('SELECT elo FROM users WHERE id = ?', [opponent.user_id]);
      return {
        matched: true,
        opponentId: opponent.user_id,
        eloA: userRow[0].elo,
        eloB: oppRow[0].elo
      };
    }

    await query(
      'UPDATE matchmaking_queue SET current_range = ?, last_search_at = NOW() WHERE user_id = ? AND status = "queued"',
      [range, userId]
    );
  }

  return { matched: false };
}

export async function createGhostIfNecessary(userId) {
  const rows = await query(
    `SELECT id, elo_snapshot, TIMESTAMPDIFF(SECOND, search_start_at, NOW()) AS waiting_seconds
     FROM matchmaking_queue
     WHERE user_id = ? AND status = 'queued'
     ORDER BY id DESC
     LIMIT 1`,
    [userId]
  );

  if (!rows.length) return null;
  const queue = rows[0];
  if (queue.waiting_seconds < 30) return null;

  const userRow = await query('SELECT elo, last_opponent_id FROM users WHERE id = ?', [
    userId
  ]);
  if (!userRow.length) return null;

  const realElo = userRow[0].elo;
  const lastOpponentId = userRow[0].last_opponent_id ?? null;

  // Cherche un "donneur" de fantôme proche en Elo, différent du joueur et de son last_opponent_id
  const candidates = await query(
    `SELECT id, elo
     FROM users
     WHERE id != ?
       AND id != IFNULL(?, -1)
     ORDER BY ABS(elo - ?) ASC
     LIMIT 1`,
    [userId, lastOpponentId, realElo]
  );

  if (!candidates.length) {
    // Pas de candidat : on renvoie un fantôme "neutre" basé sur le joueur lui-même
    await query(
      'UPDATE matchmaking_queue SET status = "matched", opponent_id = NULL, updated_at = NOW() WHERE id = ?',
      [queue.id]
    );

    return {
      isGhost: true,
      ghostUserId: null,
      userElo: realElo
    };
  }

  const ghostUser = candidates[0];

  await query(
    'UPDATE matchmaking_queue SET status = "matched", opponent_id = ?, updated_at = NOW() WHERE id = ?',
    [ghostUser.id, queue.id]
  );

  return {
    isGhost: true,
    ghostUserId: ghostUser.id,
    ghostElo: ghostUser.elo,
    userElo: realElo
  };
}

export { computeEloChange };

