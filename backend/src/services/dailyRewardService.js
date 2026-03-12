import { withTransaction } from '../config/db.js';

export const DAILY_REWARD = Object.freeze({
  credits: 90,
  cores: 2,
  fragments: 10
});

export const PARIS_TIME_ZONE = 'Europe/Paris';

const parisDayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: PARIS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

function getParisDayKey(date = new Date()) {
  const parts = parisDayFormatter.formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function getNextParisResetAt(now = new Date()) {
  const parisWallClockNow = new Date(now.toLocaleString('en-US', { timeZone: PARIS_TIME_ZONE }));
  const nextParisMidnight = new Date(parisWallClockNow);
  nextParisMidnight.setHours(24, 0, 0, 0);
  const deltaMs = nextParisMidnight.getTime() - parisWallClockNow.getTime();
  return new Date(now.getTime() + deltaMs);
}

function normalizeWallet(row) {
  return {
    credits: Number(row?.credits ?? 0),
    cores: Number(row?.cores ?? 0),
    fragments: Number(row?.fragments ?? 0),
    ascension_essence: Number(row?.ascension_essence ?? 0)
  };
}

async function ensureWallet(tx, userId) {
  await tx.query(
    `INSERT INTO user_wallet (user_id, credits, cores, fragments, ascension_essence)
     VALUES (?, 0, 0, 0, 0)
     ON DUPLICATE KEY UPDATE user_id = user_id`,
    [userId]
  );
}

async function getWallet(tx, userId) {
  await ensureWallet(tx, userId);
  const walletRows = await tx.query(
    'SELECT credits, cores, fragments, ascension_essence FROM user_wallet WHERE user_id = ?',
    [userId]
  );
  return normalizeWallet(walletRows[0]);
}

export async function claimDailyReward(userId) {
  const now = new Date();
  const dayKey = getParisDayKey(now);

  return withTransaction(async (tx) => {
    const userRows = await tx.query(
      'SELECT id, last_daily_reward_claim_at, last_daily_reward_claim_day_key FROM users WHERE id = ? FOR UPDATE',
      [userId]
    );
    if (!userRows.length) {
      const err = new Error('USER_NOT_FOUND');
      err.code = 'USER_NOT_FOUND';
      throw err;
    }

    const lastClaimDayKey = userRows[0].last_daily_reward_claim_day_key
      ? String(userRows[0].last_daily_reward_claim_day_key)
      : null;
    const lastClaimAt = userRows[0].last_daily_reward_claim_at
      ? new Date(userRows[0].last_daily_reward_claim_at)
      : null;
    const alreadyClaimedToday = lastClaimDayKey
      ? lastClaimDayKey === dayKey
      : Boolean(lastClaimAt && getParisDayKey(lastClaimAt) === dayKey);

    if (!alreadyClaimedToday) {
      await ensureWallet(tx, userId);
      await tx.query(
        `UPDATE user_wallet
         SET credits = credits + ?, cores = cores + ?, fragments = fragments + ?
         WHERE user_id = ?`,
        [DAILY_REWARD.credits, DAILY_REWARD.cores, DAILY_REWARD.fragments, userId]
      );
      await tx.query(
        'UPDATE users SET last_daily_reward_claim_at = UTC_TIMESTAMP(), last_daily_reward_claim_day_key = ? WHERE id = ?',
        [dayKey, userId]
      );
    }

    const wallet = await getWallet(tx, userId);

    return {
      claimed: !alreadyClaimedToday,
      reward: !alreadyClaimedToday ? DAILY_REWARD : null,
      wallet,
      dayKey,
      timeZone: PARIS_TIME_ZONE,
      nextResetAt: getNextParisResetAt(now).toISOString()
    };
  });
}
