import { query, withTransaction } from '../config/db.js';
import {
  ARTIFACT_STAT_LABELS_FR,
  canonicalArtifactStatKey,
  createArtifactForRarity,
  formatArtifactModifierFr,
  getArtifactBonusValue,
  getArtifactRarity,
  getArtifactUpgradeCost,
  getArtifactUpgradeSuccessChance,
  isArtifactUpgradable,
  rollDualBonusIncludingKey,
  TRAIT_ARTIFACT_TO_TRAIT
} from '../../../core/artifacts.js';

/** Probabilité (%) d’obtenir un artefact en fin de niveau donjon (niveaux 1–10). */
export const DUNGEON_ARTIFACT_DROP_PERCENT_BY_LEVEL = [5, 10, 15, 25, 35, 45, 55, 65, 75, 100];

/** Or reçu pour la vente d’un artefact (non équipé). */
export const ARTIFACT_SELL_GOLD = 2000;

/** Or débité pour retirer un artefact d’une unité. */
export const ARTIFACT_UNEQUIP_GOLD = 500;

const DUNGEON_ELEMENT_PRIMARY_STAT = Object.freeze({
  fire: 'attack',
  water: 'defense',
  plant: 'maxHp',
  light: 'speed',
  dark: 'mastery'
});

function parseJson(v) {
  if (v == null) return null;
  if (typeof v === 'object') return v;
  if (typeof v !== 'string') return null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

function normalizeArtifactRow(row) {
  const statKey = String(row.stat_key);
  const canonKey = canonicalArtifactStatKey(statKey);
  const extraData = parseJson(row.extra_data);
  const rarity = row.rarity != null ? String(row.rarity) : getArtifactRarity(statKey);
  return {
    id: Number(row.id),
    stat_key: statKey,
    statLabel: ARTIFACT_STAT_LABELS_FR[canonKey] || statKey,
    level: Number(row.level ?? 0),
    rarity,
    extra_data: extraData,
    equipped_user_unit_id: row.equipped_user_unit_id != null ? Number(row.equipped_user_unit_id) : null,
    created_at: row.created_at ?? null,
    bonus_value: getArtifactBonusValue(statKey, row.level ?? 0, extraData),
    bonus_label: formatArtifactModifierFr(statKey, row.level ?? 0, extraData),
    upgrade_cost: getArtifactUpgradeCost(row.level ?? 0),
    upgrade_success_chance: getArtifactUpgradeSuccessChance(row.level ?? 0),
    is_upgradable: isArtifactUpgradable(statKey)
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
    'SELECT credits, cores, fragments, ascension_essence, gold, divine_cores, divine_credits, divine_fragments FROM user_wallet WHERE user_id = ?',
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

export async function grantCombatArtifactRewards(userId, { victory, executor = null, creditsBonus = 0, battleType = 'campaign' } = {}) {
  const runQuery = executor?.query ?? query;
  await ensureWalletWithGold(userId, executor);

  // PvP défaite : aucune récompense (or, crédits, artefact)
  if (battleType === 'pvp' && !victory) {
    return {
      goldGained: 0,
      creditsBonus: 0,
      divineCreditsGained: 0,
      artifactDrop: null,
      wallet: await getWalletWithGold(userId, executor)
    };
  }

  // PvP : pas d’or ni de drop d’artefact (crédits / crédits divins éventuels restent gérés ci‑dessous).
  const goldGained = battleType === 'pvp' ? 0 : (victory ? 50 : 25);
  const updates = ['gold = gold + ?'];
  const params = [goldGained];
  if (creditsBonus > 0) {
    updates.push('credits = credits + ?');
    params.push(creditsBonus);
  }
  let divineCreditsGained = 0;
  if (battleType === 'pvp' && victory && Math.random() < 0.30) {
    divineCreditsGained = 1;
    updates.push('divine_credits = divine_credits + ?');
    params.push(1);
  }
  params.push(userId);
  await runQuery(`UPDATE user_wallet SET ${updates.join(', ')} WHERE user_id = ?`, params);

  // PvP : aucun drop d’artefact. Campagne : pas de drop d’artefact ici non plus.
  const artifactDrop = null;

  return {
    goldGained,
    creditsBonus: creditsBonus || 0,
    divineCreditsGained,
    artifactDrop,
    wallet: await getWalletWithGold(userId, executor)
  };
}

/**
 * Récompenses fin de niveau donjon (après le 3e combat gagné) : or garanti + tirage artefact selon niveau / élément.
 * @param {string} element - fire | water | plant | light | dark
 * @param {number} level - 1–10 (niveau du donjon terminé)
 */
export async function grantDungeonLevelCompleteRewards(userId, element, level, executor = null) {
  const runQuery = executor?.query ?? query;
  await ensureWalletWithGold(userId, executor);

  const lv = Math.min(10, Math.max(1, Number(level) || 1));
  const goldGained = lv * 25;

  const el = String(element || '').toLowerCase().trim();
  const primaryStat = DUNGEON_ELEMENT_PRIMARY_STAT[el];
  if (!primaryStat) {
    await runQuery('UPDATE user_wallet SET gold = gold + ? WHERE user_id = ?', [goldGained, userId]);
    return {
      goldGained,
      creditsBonus: 0,
      divineCreditsGained: 0,
      artifactDrop: null,
      wallet: await getWalletWithGold(userId, executor),
      dungeonArtifactRoll: false
    };
  }

  await runQuery('UPDATE user_wallet SET gold = gold + ? WHERE user_id = ?', [goldGained, userId]);

  const idx = lv - 1;
  const dropPct = DUNGEON_ARTIFACT_DROP_PERCENT_BY_LEVEL[idx] ?? 0;
  const roll = Math.random() * 100;
  let artifactDrop = null;
  let dungeonArtifactRoll = false;

  if (roll < dropPct) {
    dungeonArtifactRoll = true;
    const branch = Math.floor(Math.random() * 3);
    let statKey;
    let rarity;
    let extraData = null;

    if (branch === 0) {
      statKey = primaryStat;
      rarity = 'common';
    } else if (branch === 1) {
      statKey = 'dual_bonus';
      rarity = 'uncommon';
      extraData = rollDualBonusIncludingKey(primaryStat);
    } else {
      const created = createArtifactForRarity('rare');
      statKey = created.statKey;
      rarity = 'rare';
      extraData = created.extraData;
    }

    const extraDataJson = extraData ? JSON.stringify(extraData) : null;
    const insertResult = await runQuery(
      'INSERT INTO user_artifacts (user_id, stat_key, level, equipped_user_unit_id, rarity, extra_data) VALUES (?, ?, 0, NULL, ?, ?)',
      [userId, statKey, rarity, extraDataJson]
    );
    const insertId = insertResult?.insertId ?? insertResult;
    artifactDrop = normalizeArtifactRow({
      id: insertId,
      stat_key: statKey,
      level: 0,
      equipped_user_unit_id: null,
      rarity,
      extra_data: extraData
    });
  }

  return {
    goldGained,
    creditsBonus: 0,
    divineCreditsGained: 0,
    artifactDrop,
    wallet: await getWalletWithGold(userId, executor),
    dungeonArtifactRoll,
    dungeonArtifactDropChance: dropPct
  };
}

/**
 * Récompense unique : première réussite du combat 3 d’un niveau (première ligne dans user_dungeon_floor_clear).
 * 50 Crédits × niveau, 5 Cores × niveau, 5 Fragments × niveau, 5 Crédits divins × niveau,
 * 1 Core divin × niveau, 1 Fragment divin × niveau.
 */
export async function grantDungeonFirstClearRewards(userId, level, executor = null) {
  const runQuery = executor?.query ?? query;
  await ensureWalletWithGold(userId, executor);
  const lv = Math.min(10, Math.max(1, Number(level) || 1));
  const credits = 50 * lv;
  const cores = 5 * lv;
  const fragments = 5 * lv;
  const divine_credits = 5 * lv;
  const divine_cores = lv;
  const divine_fragments = lv;
  await runQuery(
    `UPDATE user_wallet SET
      credits = credits + ?,
      cores = cores + ?,
      fragments = fragments + ?,
      divine_credits = divine_credits + ?,
      divine_cores = divine_cores + ?,
      divine_fragments = divine_fragments + ?
     WHERE user_id = ?`,
    [credits, cores, fragments, divine_credits, divine_cores, divine_fragments, userId]
  );
  return {
    credits,
    cores,
    fragments,
    divine_credits,
    divine_cores,
    divine_fragments,
    wallet: await getWalletWithGold(userId, executor)
  };
}

export async function getEquippedArtifactsForUnitIds(userId, unitIds, executor = null) {
  const ids = Array.isArray(unitIds) ? unitIds.map(Number).filter((id) => Number.isInteger(id) && id > 0) : [];
  if (ids.length === 0) return new Map();
  const runQuery = executor?.query ?? query;
  const placeholders = ids.map(() => '?').join(',');
  const rows = await runQuery(
    `SELECT id, user_id, stat_key, level, equipped_user_unit_id, rarity, extra_data
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

/** Retourne le Set des user_unit_id qui ont l'artefact xp_boost équipé. */
export async function getUnitsWithXpBoostEquipped(userUnitIds, executor = null) {
  const ids = Array.isArray(userUnitIds) ? userUnitIds.map(Number).filter((id) => Number.isInteger(id) && id > 0) : [];
  if (ids.length === 0) return new Set();
  const runQuery = executor?.query ?? query;
  const placeholders = ids.map(() => '?').join(',');
  const rows = await runQuery(
    `SELECT equipped_user_unit_id FROM user_artifacts
     WHERE stat_key = 'xp_boost' AND equipped_user_unit_id IN (${placeholders})`,
    ids
  );
  return new Set(rows.map((r) => Number(r.equipped_user_unit_id)).filter(Boolean));
}

export async function getArtifactInventory(userId, executor = null) {
  const runQuery = executor?.query ?? query;
  const wallet = await getWalletWithGold(userId, executor);
  const artifactRows = await runQuery(
    `SELECT ua.id, ua.stat_key, ua.level, ua.equipped_user_unit_id, ua.created_at, ua.rarity, ua.extra_data
     FROM user_artifacts ua
     WHERE ua.user_id = ?
     ORDER BY ua.stat_key ASC, ua.level DESC, ua.id ASC`,
    [userId]
  );
  const unitRows = await runQuery(
    `SELECT uu.id AS user_unit_id, uu.level, u.name, u.rarity, u.element, u.image_url, u.traits
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
    traits: parseJson(row.traits) || [],
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
      'SELECT uu.id, u.traits FROM user_units uu JOIN units u ON u.id = uu.unit_id WHERE uu.id = ? AND uu.user_id = ? LIMIT 1',
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

    const artifactStatKey = String(artifactRow.stat_key);
    if (artifactStatKey.startsWith('trait_')) {
      const trait = TRAIT_ARTIFACT_TO_TRAIT[artifactStatKey];
      const unitTraits = parseJson(unitRow.traits) || [];
      const hasTrait = Array.isArray(unitTraits) && unitTraits.some((t) => String(t).toUpperCase() === String(trait).toUpperCase());
      if (hasTrait) throw new Error('ARTIFACT_CANNOT_EQUIP_ON_TRAIT');
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
    if (currentGold < ARTIFACT_UNEQUIP_GOLD) throw new Error('INSUFFICIENT_GOLD');

    await tx.query('UPDATE user_wallet SET gold = gold - ? WHERE user_id = ?', [
      ARTIFACT_UNEQUIP_GOLD,
      userId
    ]);
    await tx.query(
      'UPDATE user_artifacts SET equipped_user_unit_id = NULL WHERE id = ? AND user_id = ?',
      [normalizedArtifactId, userId]
    );

    return {
      gold_spent: ARTIFACT_UNEQUIP_GOLD,
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
    if (!isArtifactUpgradable(artifact.stat_key)) throw new Error('ARTIFACT_NOT_UPGRADABLE');

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

/**
 * Retourne les user_unit_id qui ont l'artefact xp_boost équipé.
 */
export async function getUnitIdsWithXpBoost(userUnitIds, executor = null) {
  if (!Array.isArray(userUnitIds) || userUnitIds.length === 0) return new Set();
  const runQuery = executor?.query ?? query;
  const placeholders = userUnitIds.map(() => '?').join(',');
  const rows = await runQuery(
    `SELECT equipped_user_unit_id FROM user_artifacts
     WHERE stat_key = 'xp_boost' AND equipped_user_unit_id IN (${placeholders})`,
    userUnitIds
  );
  return new Set(rows.map((r) => Number(r.equipped_user_unit_id)).filter(Boolean));
}

export async function destroyArtifactById(userId, artifactId) {
  const normalizedArtifactId = Number(artifactId);
  if (!Number.isInteger(normalizedArtifactId) || normalizedArtifactId <= 0) {
    throw new Error('INVALID_ARTIFACT_ID');
  }

  return withTransaction(async (tx) => {
    await ensureWalletWithGold(userId, tx);
    const rows = await tx.query(
      'SELECT id, equipped_user_unit_id FROM user_artifacts WHERE id = ? AND user_id = ? LIMIT 1',
      [normalizedArtifactId, userId]
    );
    const row = rows[0];
    if (!row) throw new Error('ARTIFACT_NOT_FOUND');
    if (row.equipped_user_unit_id != null) throw new Error('ARTIFACT_EQUIPPED');

    await tx.query('DELETE FROM user_artifacts WHERE id = ? AND user_id = ?', [normalizedArtifactId, userId]);
    await tx.query('UPDATE user_wallet SET gold = gold + ? WHERE user_id = ?', [ARTIFACT_SELL_GOLD, userId]);

    return {
      gold_gained: ARTIFACT_SELL_GOLD,
      wallet: await getWalletWithGold(userId, tx),
      inventory: await getArtifactInventory(userId, tx)
    };
  });
}
