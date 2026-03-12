import { query, withTransaction } from '../config/db.js';
import {
  ARTIFACT_STAT_LABELS_FR,
  chooseRandomArtifactStat,
  formatArtifactModifierFr,
  getArtifactBonusValue,
  getArtifactUpgradeCost,
  getArtifactUpgradeSuccessChance,
  isValidArtifactStatKey
} from '../../../core/artifacts.js';

function normalizeArtifactRow(row) {
  return {
    id: Number(row.id),
    stat_key: String(row.stat_key),
    statLabel: ARTIFACT_STAT_LABELS_FR[String(row.stat_key)] || String(row.stat_key),
    level: Number(row.level ?? 0),
    equipped_user_unit_id: row.equipped_user_unit_id != null ? Number(row.equipped_user_unit_id) : null,
    created_at: row.created_at ?? null,
    bonus_value: getArtifactBonusValue(row.stat_key, row.level ?? 0),
    bonus_label: formatArtifactModifierFr(row.stat_key, row.level ?? 0),
    upgrade_cost: getArtifactUpgradeCost(row.level ?? 0),
    upgrade_success_chance: getArtifactUpgradeSuccessChance(row.level ?? 0)
  };
}

export async function ensureWalletWithGold(userId, executor = null) {
  const runQuery = executor?.query ?? query;
  await runQuery(
    `INSERT INTO user_wallet (user_id, credits, cores, fragments, ascension_essence, gold)
     VALUES (?, 0, 0, 0, 0, 0)
     ON DUPLICATE KEY UPDATE user_id = user_id`,
    [userId]
  );
}

export async function getWalletWithGold(userId, executor = null) {
  const runQuery = executor?.query ?? query;
  await ensureWalletWithGold(userId, executor);
  const rows = await runQuery(
    'SELECT credits, cores, fragments, ascension_essence, gold FROM user_wallet WHERE user_id = ?',
    [userId]
  );
  return {
    credits: Number(rows[0]?.credits ?? 0),
    cores: Number(rows[0]?.cores ?? 0),
    fragments: Number(rows[0]?.fragments ?? 0),
    ascension_essence: Number(rows[0]?.ascension_essence ?? 0),
    gold: Number(rows[0]?.gold ?? 0)
  };
}

export async function grantCombatArtifactRewards(userId, { victory, executor = null } = {}) {
  const runQuery = executor?.query ?? query;
  await ensureWalletWithGold(userId, executor);
  const goldGained = victory ? 20 : 10;
  await runQuery('UPDATE user_wallet SET gold = gold + ? WHERE user_id = ?', [goldGained, userId]);

  let artifactDrop = null;
  if (victory && Math.random() < 0.01) {
    const statKey = chooseRandomArtifactStat();
    const result = await runQuery(
      'INSERT INTO user_artifacts (user_id, stat_key, level, equipped_user_unit_id) VALUES (?, ?, 0, NULL)',
      [userId, statKey]
    );
    artifactDrop = normalizeArtifactRow({
      id: result.insertId,
      stat_key: statKey,
      level: 0,
      equipped_user_unit_id: null
    });
  }

  return {
    goldGained,
    artifactDrop,
    wallet: await getWalletWithGold(userId, executor)
  };
}

export async function getEquippedArtifactsForUnitIds(userId, unitIds, executor = null) {
  const ids = Array.isArray(unitIds) ? unitIds.map(Number).filter((id) => Number.isInteger(id) && id > 0) : [];
  if (ids.length === 0) return new Map();
  const runQuery = executor?.query ?? query;
  const placeholders = ids.map(() => '?').join(',');
  const rows = await runQuery(
    `SELECT id, user_id, stat_key, level, equipped_user_unit_id
     FROM user_artifacts
     WHERE user_id = ? AND equipped_user_unit_id IN (${placeholders})`,
    [userId, ...ids]
  );
  const map = new Map();
  for (const row of rows) {
    const unitId = Number(row.equipped_user_unit_id);
    const current = map.get(unitId) || [];
    current.push(normalizeArtifactRow(row));
    map.set(unitId, current);
  }
  return map;
}

export async function getArtifactInventory(userId, executor = null) {
  const runQuery = executor?.query ?? query;
  const wallet = await getWalletWithGold(userId, executor);
  const artifactRows = await runQuery(
    `SELECT ua.id, ua.stat_key, ua.level, ua.equipped_user_unit_id, ua.created_at
     FROM user_artifacts ua
     WHERE ua.user_id = ?
     ORDER BY ua.stat_key ASC, ua.level DESC, ua.id ASC`,
    [userId]
  );
  const unitRows = await runQuery(
    `SELECT uu.id AS user_unit_id, uu.level, u.name, u.rarity, u.element, u.image_url
     FROM user_units uu
     JOIN units u ON u.id = uu.unit_id
     WHERE uu.user_id = ?
     ORDER BY u.rarity DESC, u.name ASC`,
    [userId]
  );

  const normalizedArtifacts = artifactRows.map(normalizeArtifactRow);
  const stacksMap = new Map();
  for (const artifact of normalizedArtifacts) {
    const key = `${artifact.stat_key}:${artifact.level}`;
    const current = stacksMap.get(key) || {
      key,
      stat_key: artifact.stat_key,
      statLabel: artifact.statLabel,
      level: artifact.level,
      quantity: 0,
      available_quantity: 0,
      equipped_quantity: 0,
      bonus_value: artifact.bonus_value,
      bonus_label: artifact.bonus_label,
      upgrade_cost: artifact.upgrade_cost,
      upgrade_success_chance: artifact.upgrade_success_chance
    };
    current.quantity += 1;
    if (artifact.equipped_user_unit_id == null) current.available_quantity += 1;
    else current.equipped_quantity += 1;
    stacksMap.set(key, current);
  }

  const equippedByUnit = new Map();
  for (const artifact of normalizedArtifacts) {
    if (artifact.equipped_user_unit_id == null) continue;
    const current = equippedByUnit.get(artifact.equipped_user_unit_id) || [];
    current.push(artifact);
    equippedByUnit.set(artifact.equipped_user_unit_id, current);
  }

  const units = unitRows.map((row) => ({
    user_unit_id: Number(row.user_unit_id),
    level: Number(row.level ?? 1),
    name: row.name,
    rarity: row.rarity,
    element: row.element,
    image_url: row.image_url ?? null,
    equipped_artifacts: equippedByUnit.get(Number(row.user_unit_id)) || []
  }));

  return {
    wallet,
    artifacts: normalizedArtifacts,
    stacks: Array.from(stacksMap.values()),
    units
  };
}

export async function equipArtifactById(userId, { artifactId, userUnitId }) {
  const normalizedArtifactId = Number(artifactId);
  const normalizedUnitId = Number(userUnitId);
  if (!Number.isInteger(normalizedArtifactId) || normalizedArtifactId <= 0) {
    throw new Error('INVALID_ARTIFACT_ID');
  }
  if (!Number.isInteger(normalizedUnitId) || normalizedUnitId <= 0) {
    throw new Error('INVALID_USER_UNIT_ID');
  }

  return withTransaction(async (tx) => {
    const [unitRow] = await tx.query(
      'SELECT id FROM user_units WHERE id = ? AND user_id = ? LIMIT 1',
      [normalizedUnitId, userId]
    );
    if (!unitRow) throw new Error('USER_UNIT_NOT_FOUND');

    const equippedRows = await tx.query(
      'SELECT id, stat_key FROM user_artifacts WHERE user_id = ? AND equipped_user_unit_id = ?',
      [userId, normalizedUnitId]
    );
    const artifactRows = await tx.query(
      `SELECT id, stat_key, equipped_user_unit_id
       FROM user_artifacts
       WHERE user_id = ? AND id = ?
       LIMIT 1`,
      [userId, normalizedArtifactId]
    );
    const artifactRow = artifactRows[0];
    if (!artifactRow) throw new Error('ARTIFACT_NOT_FOUND');
    if (artifactRow.equipped_user_unit_id != null) throw new Error('ARTIFACT_ALREADY_EQUIPPED');
    if (equippedRows.length >= 2) throw new Error('ARTIFACT_SLOTS_FULL');
    if (equippedRows.some((row) => String(row.stat_key) === String(artifactRow.stat_key))) {
      throw new Error('DUPLICATE_ARTIFACT_STAT');
    }

    await tx.query(
      'UPDATE user_artifacts SET equipped_user_unit_id = ? WHERE id = ? AND user_id = ?',
      [normalizedUnitId, artifactRow.id, userId]
    );

    return getArtifactInventory(userId, tx);
  });
}

export async function unequipArtifact(userId, artifactId) {
  const normalizedArtifactId = Number(artifactId);
  if (!Number.isInteger(normalizedArtifactId) || normalizedArtifactId <= 0) {
    throw new Error('INVALID_ARTIFACT_ID');
  }

  return withTransaction(async (tx) => {
    await ensureWalletWithGold(userId, tx);
    const rows = await tx.query(
      'SELECT id FROM user_artifacts WHERE id = ? AND user_id = ? AND equipped_user_unit_id IS NOT NULL LIMIT 1',
      [normalizedArtifactId, userId]
    );
    if (!rows[0]) throw new Error('ARTIFACT_NOT_EQUIPPED');
    const walletRows = await tx.query('SELECT gold FROM user_wallet WHERE user_id = ? LIMIT 1', [userId]);
    const currentGold = Number(walletRows[0]?.gold ?? 0);
    if (currentGold < 5000) throw new Error('INSUFFICIENT_GOLD');

    await tx.query('UPDATE user_wallet SET gold = gold - 5000 WHERE user_id = ?', [userId]);
    await tx.query(
      'UPDATE user_artifacts SET equipped_user_unit_id = NULL WHERE id = ? AND user_id = ?',
      [normalizedArtifactId, userId]
    );

    return {
      gold_spent: 5000,
      wallet: await getWalletWithGold(userId, tx),
      inventory: await getArtifactInventory(userId, tx)
    };
  });
}

export async function enhanceArtifactById(userId, artifactId) {
  const normalizedArtifactId = Number(artifactId);
  if (!Number.isInteger(normalizedArtifactId) || normalizedArtifactId <= 0) {
    throw new Error('INVALID_ARTIFACT_ID');
  }

  return withTransaction(async (tx) => {
    await ensureWalletWithGold(userId, tx);
    const artifactRows = await tx.query(
      `SELECT id, stat_key, level, equipped_user_unit_id
       FROM user_artifacts
       WHERE user_id = ? AND id = ?
       LIMIT 1`,
      [userId, normalizedArtifactId]
    );
    const artifact = artifactRows[0];
    if (!artifact) throw new Error('ARTIFACT_NOT_FOUND');

    const currentLevel = Number(artifact.level ?? 0);
    const cost = getArtifactUpgradeCost(currentLevel);
    const chance = getArtifactUpgradeSuccessChance(currentLevel);
    const walletRows = await tx.query('SELECT gold FROM user_wallet WHERE user_id = ? LIMIT 1', [userId]);
    const currentGold = Number(walletRows[0]?.gold ?? 0);
    if (currentGold < cost) throw new Error('INSUFFICIENT_GOLD');

    await tx.query('UPDATE user_wallet SET gold = gold - ? WHERE user_id = ?', [cost, userId]);
    const roll = Math.random() * 100;
    const success = roll < chance;
    if (success) {
      await tx.query(
        'UPDATE user_artifacts SET level = level + 1 WHERE id = ? AND user_id = ?',
        [artifact.id, userId]
      );
    }

    return {
      success,
      previous_level: currentLevel,
      new_level: success ? currentLevel + 1 : currentLevel,
      cost,
      chance,
      artifact_id: normalizedArtifactId,
      wallet: await getWalletWithGold(userId, tx),
      inventory: await getArtifactInventory(userId, tx)
    };
  });
}

export async function destroyArtifactById(userId, artifactId) {
  const normalizedArtifactId = Number(artifactId);
  if (!Number.isInteger(normalizedArtifactId) || normalizedArtifactId <= 0) {
    throw new Error('INVALID_ARTIFACT_ID');
  }

  return withTransaction(async (tx) => {
    await ensureWalletWithGold(userId, tx);
    const rows = await tx.query(
      'SELECT id FROM user_artifacts WHERE id = ? AND user_id = ? LIMIT 1',
      [normalizedArtifactId, userId]
    );
    if (!rows[0]) throw new Error('ARTIFACT_NOT_FOUND');

    await tx.query('DELETE FROM user_artifacts WHERE id = ? AND user_id = ?', [normalizedArtifactId, userId]);
    await tx.query('UPDATE user_wallet SET gold = gold + 50 WHERE user_id = ?', [userId]);

    return {
      gold_gained: 50,
      wallet: await getWalletWithGold(userId, tx),
      inventory: await getArtifactInventory(userId, tx)
    };
  });
}
