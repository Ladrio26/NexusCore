import { query } from '../config/db.js';
import { getPowerLevelFromOpenings, getPowerProgress, MAX_POWER_OPENINGS } from '../../../core/unitPower.js';

const VALID_RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

export const DUPLICATE_COMPENSATION_BY_RARITY = Object.freeze({
  common: { credits: 5, fragments: 0 },
  uncommon: { credits: 10, fragments: 0 },
  rare: { credits: 20, fragments: 10 },
  epic: { credits: 40, fragments: 25 },
  legendary: { credits: 80, fragments: 50 },
  mythic: { credits: 150, fragments: 100 }
});

function getRunner(executor = null) {
  return executor?.query ?? query;
}

export function normalizeGrantedUnitRarity(rarity) {
  const normalized = String(rarity ?? '').trim().toLowerCase();
  if (!VALID_RARITIES.includes(normalized)) {
    throw new Error(`INVALID_RARITY:${rarity}`);
  }
  return normalized;
}

export async function ensureWalletRow(userId, executor = null) {
  const runQuery = getRunner(executor);
  await runQuery(
    `INSERT INTO user_wallet (user_id, credits, cores, fragments, ascension_essence, gold)
     VALUES (?, 0, 0, 0, 0, 0)
     ON DUPLICATE KEY UPDATE user_id = user_id`,
    [userId]
  );
}

export async function getWalletSnapshot(userId, executor = null) {
  const runQuery = getRunner(executor);
  await ensureWalletRow(userId, executor);
  const rows = await runQuery(
    'SELECT credits, cores, fragments, ascension_essence, gold, divine_cores, divine_credits, divine_fragments FROM user_wallet WHERE user_id = ? LIMIT 1',
    [userId]
  );
  const r = rows[0];
  return {
    credits: Number(r?.credits ?? 0),
    cores: Number(r?.cores ?? 0),
    fragments: Number(r?.fragments ?? 0),
    ascension_essence: Number(r?.ascension_essence ?? 0),
    gold: Number(r?.gold ?? 0),
    divine_cores: Number(r?.divine_cores ?? 0),
    divine_credits: Number(r?.divine_credits ?? 0),
    divine_fragments: Number(r?.divine_fragments ?? 0)
  };
}

function parseJson(v) {
  if (v == null) return null;
  if (typeof v === 'object') return v;
  try {
    return typeof v === 'string' ? JSON.parse(v || 'null') : v;
  } catch {
    return null;
  }
}

export async function getBasicUnitRow(unitId, executor = null) {
  const runQuery = getRunner(executor);
  const rows = await runQuery(
    'SELECT id, code, name, rarity, role, attack_type, element, image_url, skill_data FROM units WHERE id = ? LIMIT 1',
    [unitId]
  );
  const row = rows[0] ?? null;
  if (!row) return null;
  return {
    ...row,
    skill_data: parseJson(row.skill_data)
  };
}

export async function grantSummonedUnitToUser(userId, unitId, rarity, executor = null) {
  const normalizedRarity = normalizeGrantedUnitRarity(rarity);
  const runQuery = getRunner(executor);

  await ensureWalletRow(userId, executor);

  const existingRows = await runQuery(
    'SELECT id, power_level, power_openings FROM user_units WHERE user_id = ? AND unit_id = ? LIMIT 1',
    [userId, unitId]
  );
  const existingUnit = existingRows[0] ?? null;
  const isNewUnit = existingUnit == null;
  const previousPowerOpenings = isNewUnit ? 0 : Math.max(1, Number(existingUnit.power_openings ?? 1));
  const previousPowerLevel = isNewUnit ? 0 : getPowerLevelFromOpenings(previousPowerOpenings);
  const powerOpenings = previousPowerOpenings + 1;
  const powerLevel = getPowerLevelFromOpenings(powerOpenings);
  const powerLevelUp = !isNewUnit && powerLevel > previousPowerLevel;
  const powerProgress = getPowerProgress(powerOpenings);
  const duplicateRewards = !isNewUnit && previousPowerOpenings >= MAX_POWER_OPENINGS
    ? { ...(DUPLICATE_COMPENSATION_BY_RARITY[normalizedRarity] ?? { credits: 0, fragments: 0 }) }
    : { credits: 0, fragments: 0 };

  if (isNewUnit) {
    const countRows = await runQuery(
      'SELECT COUNT(*) AS cnt FROM user_units WHERE user_id = ?',
      [userId]
    );
    const existingUnitCount = Number(countRows[0]?.cnt ?? 0);
    const initialLevel = existingUnitCount < 5 ? 5 : 1;

    await runQuery(
      `INSERT INTO user_units (user_id, unit_id, level, xp, fatigue, fatigue_last_update, injury_level, is_injured, power_level, power_openings)
       VALUES (?, ?, ?, 0, 0, NOW(), 0, 0, 1, 1)`,
      [userId, unitId, initialLevel]
    );
  } else {
    await runQuery(
      'UPDATE user_units SET power_level = ?, power_openings = ? WHERE id = ?',
      [powerLevel, powerOpenings, existingUnit.id]
    );
    if (duplicateRewards.credits || duplicateRewards.fragments) {
      await runQuery(
        `UPDATE user_wallet
         SET credits = credits + ?, fragments = fragments + ?
         WHERE user_id = ?`,
        [duplicateRewards.credits ?? 0, duplicateRewards.fragments ?? 0, userId]
      );
    }
  }

  return {
    isNewUnit,
    previousPowerLevel: Math.max(1, previousPowerLevel || 1),
    powerLevel,
    powerOpenings,
    powerLevelUp,
    powerProgress,
    duplicateRewards
  };
}
