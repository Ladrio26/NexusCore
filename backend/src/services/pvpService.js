/**
 * Service PvP : Elo, défense, historique, notifications, XP, fatigue.
 * Réutilise le moteur de combat (simulateBattle) et les services existants.
 */
import { query, getPool } from '../config/db.js';
import { MAX_TEAM_PRESETS } from '../constants/teamPresets.js';
import { withTransaction } from '../config/db.js';
import { addXp, redistributeXpFromMaxLevelUnits } from './xpService.js';
import { applyCampaignFatigue } from './campaignService.js';

const ELO_MIN = 0;
const ELO_MATCHMAKING_RANGE = 100;

/**
 * Calcule les deltas Elo PvP selon l'écart entre attaquant et défenseur (jeu à somme nulle).
 * Écart 0–10 : base ±10. Au-delà, par tranches de 10 pts d’écart (bucket max 9) :
 * - Favori gagne : gain modéré (10 − bucket) ; perdre contre plus faible : grosse perte.
 * - Outsider gagne : gros gain (10 + bucket) ; perdre contre plus fort : petite perte (10 − bucket).
 * Le défenseur reçoit toujours l’opposé de l’attaquant (cohérent avec une mise à jour Elo symétrique).
 * @param {number} attackerElo
 * @param {number} defenderElo (même valeur que attacker si PNJ)
 * @param {boolean} attackerWon
 * @returns {{ attackerDelta: number, defenderDelta: number }}
 */
function computePvpEloDeltas(attackerElo, defenderElo, attackerWon) {
  const diff = Math.abs(attackerElo - defenderElo);
  const bucket = diff <= 10 ? 0 : Math.min(9, Math.floor((diff - 1) / 10));
  const attackerIsFavorite = attackerElo >= defenderElo;
  let attackerDelta;
  if (attackerWon) {
    attackerDelta = attackerIsFavorite ? 10 - bucket : 10 + bucket;
  } else {
    attackerDelta = attackerIsFavorite ? -(10 + bucket) : -(10 - bucket);
  }
  const defenderDelta = -attackerDelta;
  return { attackerDelta, defenderDelta };
}
const PVP_XP_WIN = 1000;
const PVP_XP_LOSS = 0;
const PVP_FATIGUE_ATTACKER = 3;
const PVP_RANK_REWARDS = Object.freeze([
  { key: 'SILVER_3', label: 'Argent 3', threshold: 300, credits: 50, cores: 1, fragments: 0, ascension_essence: 0, divine_credits: 0, divine_cores: 0, divine_fragments: 0 },
  { key: 'GOLD_3', label: 'Or 3', threshold: 600, credits: 100, cores: 3, fragments: 10, ascension_essence: 0, divine_credits: 10, divine_cores: 1, divine_fragments: 1 },
  { key: 'PLATINUM_3', label: 'Platine 3', threshold: 900, credits: 150, cores: 6, fragments: 30, ascension_essence: 0, divine_credits: 15, divine_cores: 1, divine_fragments: 3 },
  { key: 'DIAMOND_3', label: 'Diamant 3', threshold: 1200, credits: 200, cores: 10, fragments: 50, ascension_essence: 0, divine_credits: 20, divine_cores: 1, divine_fragments: 5 },
  { key: 'MASTER', label: 'Master', threshold: 1500, credits: 300, cores: 20, fragments: 100, ascension_essence: 0, divine_credits: 30, divine_cores: 2, divine_fragments: 10 },
  { key: 'GRAND_MASTER', label: 'Grand Master', threshold: 1600, credits: 400, cores: 30, fragments: 150, ascension_essence: 0, divine_credits: 40, divine_cores: 3, divine_fragments: 15 },
  { key: 'CHALLENGER', label: 'Challenger', threshold: 1700, credits: 500, cores: 40, fragments: 200, ascension_essence: 1, divine_credits: 50, divine_cores: 4, divine_fragments: 20 }
]);

function getCurrentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatRewardSummary(reward) {
  const parts = [];
  if (reward.credits) parts.push(`${reward.credits} crédits`);
  if (reward.cores) parts.push(`${reward.cores} cores`);
  if (reward.fragments) parts.push(`${reward.fragments} fragments`);
  if (reward.ascension_essence) parts.push(`${reward.ascension_essence} essence`);
  if (reward.divine_credits) parts.push(`${reward.divine_credits} crédits divins`);
  if (reward.divine_cores) parts.push(`${reward.divine_cores} cores divines`);
  if (reward.divine_fragments) parts.push(`${reward.divine_fragments} fragments divins`);
  return parts.join(', ');
}

async function ensureWallet(userId, executor = null) {
  const runQuery = executor?.query ?? query;
  await runQuery(
    `INSERT INTO user_wallet (user_id, credits, cores, fragments, ascension_essence, gold)
     VALUES (?, 0, 0, 0, 0, 0)
     ON DUPLICATE KEY UPDATE user_id = user_id`,
    [userId]
  );
}

async function getWallet(userId, executor = null) {
  const runQuery = executor?.query ?? query;
  await ensureWallet(userId, executor);
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

async function grantRankRewardsForSeason(userId, previousElo, newElo, executor = null) {
  if (newElo <= previousElo) {
    return { rewards: [], wallet: null };
  }

  const seasonKey = getCurrentMonthKey();
  const runQuery = executor?.query ?? query;
  const crossedRewards = PVP_RANK_REWARDS.filter((reward) => previousElo < reward.threshold && newElo >= reward.threshold);
  if (crossedRewards.length === 0) {
    return { rewards: [], wallet: null };
  }

  await ensureWallet(userId, executor);

  const grantedRewards = [];
  for (const reward of crossedRewards) {
    const result = await runQuery(
      `INSERT IGNORE INTO pvp_rank_reward_claims (user_id, season_key, reward_key)
       VALUES (?, ?, ?)`,
      [userId, seasonKey, reward.key]
    );
    if ((result?.affectedRows ?? 0) === 0) {
      continue;
    }

    const divineCredits = reward.divine_credits ?? 0;
    const divineCores = reward.divine_cores ?? 0;
    const divineFragments = reward.divine_fragments ?? 0;
    const hasDivine = divineCredits > 0 || divineCores > 0 || divineFragments > 0;
    if (hasDivine) {
      await runQuery(
        `UPDATE user_wallet
         SET credits = credits + ?, cores = cores + ?, fragments = fragments + ?, ascension_essence = ascension_essence + ?,
             divine_credits = divine_credits + ?, divine_cores = divine_cores + ?, divine_fragments = divine_fragments + ?
         WHERE user_id = ?`,
        [reward.credits, reward.cores, reward.fragments, reward.ascension_essence, divineCredits, divineCores, divineFragments, userId]
      );
    } else {
      await runQuery(
        `UPDATE user_wallet
         SET credits = credits + ?, cores = cores + ?, fragments = fragments + ?, ascension_essence = ascension_essence + ?
         WHERE user_id = ?`,
        [reward.credits, reward.cores, reward.fragments, reward.ascension_essence, userId]
      );
    }
    grantedRewards.push(reward);
  }

  return {
    rewards: grantedRewards,
    wallet: grantedRewards.length ? await getWallet(userId, executor) : null
  };
}

/**
 * Reset Elo PvP le 1er de chaque mois. Vérifie si un reset a déjà été fait ce mois-ci.
 * Crée la table pvp_elo_reset si elle n'existe pas.
 */
export async function ensureMonthlyEloReset() {
  const month = getCurrentMonthKey();
  let rows;
  try {
    rows = await query(
      "SELECT 1 FROM pvp_elo_reset WHERE reset_month = ? LIMIT 1",
      [month]
    );
  } catch (err) {
    if (err?.code === 'ER_NO_SUCH_TABLE') {
      await query(`
        CREATE TABLE IF NOT EXISTS pvp_elo_reset (
          id INT AUTO_INCREMENT PRIMARY KEY,
          reset_month VARCHAR(7) NOT NULL UNIQUE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      rows = [];
    } else {
      throw err;
    }
  }
  if (rows.length > 0) return;
  try {
    await query('UPDATE users SET pvp_elo = 0 WHERE 1=1');
    await query('INSERT INTO pvp_elo_reset (reset_month) VALUES (?)', [month]);
  } catch (err) {
    if (err?.code === 'ER_NO_SUCH_TABLE') {
      await query(`
        CREATE TABLE IF NOT EXISTS pvp_elo_reset (
          id INT AUTO_INCREMENT PRIMARY KEY,
          reset_month VARCHAR(7) NOT NULL UNIQUE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await query('UPDATE users SET pvp_elo = 0 WHERE 1=1');
      await query('INSERT INTO pvp_elo_reset (reset_month) VALUES (?)', [month]);
    } else {
      throw err;
    }
  }
}

/**
 * Récupère l'Elo PvP du joueur (et applique le reset mensuel si besoin).
 */
export async function getPlayerElo(userId) {
  await ensureMonthlyEloReset();
  const rows = await query('SELECT pvp_elo FROM users WHERE id = ?', [userId]);
  const elo = rows[0]?.pvp_elo != null ? Number(rows[0].pvp_elo) : 0;
  return Math.max(ELO_MIN, elo);
}

/**
 * Met à jour l'Elo après un combat. newElo = max(0, elo + delta).
 */
export async function updateElo(userId, currentElo, delta, executor = null) {
  const runQuery = executor?.query ?? query;
  const newElo = Math.max(ELO_MIN, currentElo + delta);
  await runQuery('UPDATE users SET pvp_elo = ? WHERE id = ?', [newElo, userId]);
  return newElo;
}

/**
 * Vérifie si un preset existe et contient au moins une unité.
 */
function isPresetValid(slotsData) {
  return slotsData && slotsData.slots && slotsData.slots.length > 0;
}

/**
 * Définit la défense PvP du joueur (preset_id = preset_index 1..MAX_TEAM_PRESETS).
 * Le preset doit exister et contenir au moins une unité.
 */
export async function setDefense(userId, presetId) {
  const presetIndex = Number(presetId);
  if (!Number.isInteger(presetIndex) || presetIndex < 1 || presetIndex > MAX_TEAM_PRESETS) {
    throw new Error('INVALID_PRESET_ID');
  }
  const slotsData = await getPresetSlots(userId, presetIndex);
  if (!isPresetValid(slotsData)) {
    throw new Error('PRESET_EMPTY_OR_NOT_FOUND');
  }
  await query(
    'REPLACE INTO pvp_defenses (user_id, preset_id) VALUES (?, ?)',
    [userId, presetIndex]
  );
  return { success: true };
}

/**
 * Récupère la défense PvP du joueur (preset_id et slots).
 * Retourne null si le preset n'existe pas ou est vide.
 */
export async function getDefense(userId) {
  const rows = await query(
    'SELECT preset_id FROM pvp_defenses WHERE user_id = ?',
    [userId]
  );
  if (!rows.length) return null;
  const presetId = rows[0].preset_id;
  const slotsData = await getPresetSlots(userId, presetId);
  if (!isPresetValid(slotsData)) return null;
  return { preset_id: presetId };
}

/**
 * Récupère les slots d'un preset (front_slots, back_slots) pour un user.
 */
export async function getPresetSlots(userId, presetIndex) {
  const rows = await query(
    'SELECT front_slots, back_slots, selected_noyau_index FROM user_team_presets WHERE user_id = ? AND preset_index = ?',
    [userId, presetIndex]
  );
  if (!rows.length) return null;
  const front = rows[0].front_slots != null
    ? (Array.isArray(rows[0].front_slots) ? rows[0].front_slots : JSON.parse(rows[0].front_slots || '[]'))
    : [];
  const back = rows[0].back_slots != null
    ? (Array.isArray(rows[0].back_slots) ? rows[0].back_slots : JSON.parse(rows[0].back_slots || '[]'))
    : [];
  const slots = [
    ...front.map((id) => ({ user_unit_id: id, position: 'front' })),
    ...back.map((id) => ({ user_unit_id: id, position: 'back' }))
  ].filter((s) => s.user_unit_id);
  return {
    slots,
    selected_noyau_index: rows[0].selected_noyau_index ?? 0
  };
}

/**
 * Trouve un adversaire : joueur dans la fourchette Elo ±100, ou PNJ.
 * excludeDefenderId : éviter de retomber deux fois d'affilée sur le même joueur (alterner joueur / PNJ si un seul dispo).
 */
/** ELO minimum pour accéder au matchmaking contre de vrais joueurs (Argent 3). */
const ELO_BRONZE_MAX = 299;

export async function findOpponent(attackerId, excludeDefenderId = null) {
  const elo = await getPlayerElo(attackerId);

  // En rang Bronze (ELO ≤ 299), uniquement des PNJ.
  if (elo <= ELO_BRONZE_MAX) {
    return {
      defender_type: 'npc',
      defender_id: null,
      display_name: 'Adversaire PNJ',
      pvp_elo: elo,
      preset_id: null
    };
  }

  const low = Math.max(ELO_MIN, elo - ELO_MATCHMAKING_RANGE);
  const high = elo + ELO_MATCHMAKING_RANGE;
  const params = [attackerId];
  let excludeClause = 'u.id != ?';
  if (excludeDefenderId != null && Number(excludeDefenderId) > 0) {
    params.push(Number(excludeDefenderId));
    excludeClause = 'u.id != ? AND u.id != ?';
  }
  params.push(low, high);
  const [rows] = await getPool().execute(
    `SELECT u.id, u.display_name, u.pvp_elo, d.preset_id
     FROM users u
     INNER JOIN pvp_defenses d ON d.user_id = u.id
     INNER JOIN user_team_presets utp ON utp.user_id = u.id AND utp.preset_index = d.preset_id
     WHERE ${excludeClause}
     AND u.pvp_elo BETWEEN ? AND ?
     AND (JSON_LENGTH(COALESCE(utp.front_slots, '[]')) + JSON_LENGTH(COALESCE(utp.back_slots, '[]'))) > 0
     ORDER BY RAND()
     LIMIT 1`,
    params
  );
  if (rows && rows.length > 0) {
    return {
      defender_type: 'player',
      defender_id: rows[0].id,
      display_name: rows[0].display_name,
      pvp_elo: rows[0].pvp_elo,
      preset_id: rows[0].preset_id
    };
  }
  return {
    defender_type: 'npc',
    defender_id: null,
    display_name: 'Adversaire PNJ',
    pvp_elo: elo,
    preset_id: null
  };
}

/**
 * Enregistre une notification pour un joueur.
 * @param {object} [dataOrExecutor] - données JSON (ex: { result: 'win'|'loss', elo_delta }) ou objet tx avec .query
 * @param {object} [executor] - tx quand dataOrExecutor est des données
 */
export async function createNotification(userId, type, message, dataOrExecutor = null, executor = null) {
  let data = null;
  let runExecutor = executor;
  if (dataOrExecutor && typeof dataOrExecutor === 'object') {
    if (typeof dataOrExecutor.query === 'function') {
      runExecutor = dataOrExecutor;
    } else {
      data = dataOrExecutor;
      runExecutor = executor;
    }
  }
  const runQuery = runExecutor?.query ?? query;
  const dataJson = data != null ? JSON.stringify(data) : null;
  await runQuery(
    'INSERT INTO notifications (user_id, type, message, data) VALUES (?, ?, ?, ?)',
    [userId, type, message, dataJson]
  );
}

/**
 * Enregistre le combat en base et met à jour Elo, XP, fatigue, notification.
 * defenderEloBefore : Elo du défenseur avant le combat (obligatoire si defenderType === 'player', sinon ignoré ; pour PNJ on utilise attackerEloBefore).
 * En cas de match nul (isDraw), aucun Elo n'est modifié.
 */
export async function recordPvpBattle(attackerId, defenderId, defenderType, attackerWon, attackerEloBefore, isDraw = false, defenderEloBefore = null) {
  return withTransaction(async (tx) => {
    const attackerRows = await tx.query(
      'SELECT display_name, pvp_elo FROM users WHERE id = ? FOR UPDATE',
      [attackerId]
    );
    const attackerRow = attackerRows[0];
    const lockedAttackerElo = attackerRow?.pvp_elo != null
      ? Number(attackerRow.pvp_elo)
      : Number(attackerEloBefore ?? 0);

    let attackerEloAfter = lockedAttackerElo;
    let defenderEloAfter = null;
    let lockedDefenderElo = defenderType === 'player' && defenderId
      ? Number(defenderEloBefore ?? 0)
      : lockedAttackerElo;

    if (defenderType === 'player' && defenderId) {
      const defenderRows = await tx.query(
        'SELECT pvp_elo FROM users WHERE id = ? FOR UPDATE',
        [defenderId]
      );
      lockedDefenderElo = defenderRows[0]?.pvp_elo != null
        ? Number(defenderRows[0].pvp_elo)
        : Number(defenderEloBefore ?? 0);
    }

    let defenderDelta = null;
    if (!isDraw) {
      const { attackerDelta, defenderDelta: defDelta } = computePvpEloDeltas(
        lockedAttackerElo,
        lockedDefenderElo,
        attackerWon
      );
      defenderDelta = defDelta;
      attackerEloAfter = await updateElo(attackerId, lockedAttackerElo, attackerDelta, tx);
      if (defenderType === 'player' && defenderId) {
        defenderEloAfter = await updateElo(defenderId, lockedDefenderElo, defenderDelta, tx);
      }
    }

    const attackerRankRewardResult = !isDraw
      ? await grantRankRewardsForSeason(attackerId, lockedAttackerElo, attackerEloAfter, tx)
      : { rewards: [], wallet: null };
    const defenderRankRewardResult = (!isDraw && defenderType === 'player' && defenderId && defenderEloAfter != null)
      ? await grantRankRewardsForSeason(defenderId, lockedDefenderElo, defenderEloAfter, tx)
      : { rewards: [], wallet: null };

    await tx.query(
      `INSERT INTO pvp_battles (attacker_id, defender_id, defender_type, result, elo_before, elo_after)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        attackerId,
        defenderId || null,
        defenderType,
        isDraw ? 'draw' : (attackerWon ? 'win' : 'loss'),
        lockedAttackerElo,
        attackerEloAfter
      ]
    );

    if (defenderType === 'player' && defenderId) {
      const attackerName = attackerRow?.display_name || 'Un joueur';
      let pvpMsg;
      let pvpData = null;
      if (isDraw) {
        pvpMsg = `Vous avez été attaqué en PvP par "${attackerName}" : Match nul.`;
        pvpData = { result: 'draw' };
      } else {
        const defenderWon = !attackerWon;
        const sign = defenderDelta >= 0 ? '+' : '';
        pvpMsg = `Vous avez été attaqué en PvP par "${attackerName}" : ${defenderWon ? 'Victoire' : 'Défaite'} ${sign}${defenderDelta} Elo.`;
        pvpData = { result: defenderWon ? 'win' : 'loss', elo_delta: defenderDelta };
      }
      await createNotification(defenderId, 'pvp_attack', pvpMsg, pvpData, tx);
      for (const reward of defenderRankRewardResult.rewards) {
        await createNotification(
          defenderId,
          'pvp_rank_reward',
          `Palier PvP atteint : ${reward.label}. Récompense obtenue : ${formatRewardSummary(reward)}.`,
          null,
          tx
        );
      }
    }

    for (const reward of attackerRankRewardResult.rewards) {
      await createNotification(
        attackerId,
        'pvp_rank_reward',
        `Palier PvP atteint : ${reward.label}. Récompense obtenue : ${formatRewardSummary(reward)}.`,
        null,
        tx
      );
    }

    return {
      attackerEloBefore: lockedAttackerElo,
      attackerEloAfter,
      defenderEloAfter: defenderType === 'player' ? defenderEloAfter : null,
      attackerRankRewards: attackerRankRewardResult.rewards.map((reward) => ({
        key: reward.key,
        label: reward.label,
        threshold: reward.threshold,
        credits: reward.credits,
        cores: reward.cores,
        fragments: reward.fragments,
        ascension_essence: reward.ascension_essence
      })),
      attackerWallet: attackerRankRewardResult.wallet
    };
  });
}

/**
 * Donne l'XP PvP aux unités survivantes de l'attaquant (victoire ou défaite).
 * +50 % XP pour les unités avec l'artefact xp_boost équipé.
 */
export async function grantPvpXp(attackerUserUnitIds, attackerWon) {
  const baseAmount = attackerWon ? PVP_XP_WIN : PVP_XP_LOSS;
  const ids = [...new Set(attackerUserUnitIds.map(Number).filter((n) => Number.isFinite(n) && n > 0))];
  if (ids.length === 0) return [];
  const { getUnitIdsWithXpBoost } = await import('./artifactService.js');
  const xpBoostIds = await getUnitIdsWithXpBoost(ids);
  const placeholders = ids.map(() => '?').join(',');
  const levelRows = await query(`SELECT id, level FROM user_units WHERE id IN (${placeholders})`, ids);
  const levelById = new Map(levelRows.map((r) => [r.id, Number(r.level ?? 1)]));
  const rawAmountById = new Map();
  for (const id of ids) {
    const amount = xpBoostIds.has(id) ? Math.floor(baseAmount * 1.5) : baseAmount;
    rawAmountById.set(id, amount);
  }
  const finalAmounts = redistributeXpFromMaxLevelUnits(ids, levelById, rawAmountById);
  const results = [];
  for (const id of ids) {
    const amount = Math.max(0, Math.floor(Number(finalAmounts.get(id) ?? 0)));
    if (amount <= 0) {
      results.push({ userUnitId: id, level: levelById.get(id), xp: 0, levelsGained: 0, skippedMaxLevel: true });
      continue;
    }
    try {
      const r = await addXp(id, amount);
      results.push({ userUnitId: id, ...r });
    } catch (_) {
      results.push({ userUnitId: id, error: true });
    }
  }
  return results;
}

/**
 * Applique la fatigue PvP aux unités attaquantes (+3).
 */
export async function applyPvpFatigue(attackerUserUnitIds) {
  if (attackerUserUnitIds.length === 0) return;
  await applyCampaignFatigue(attackerUserUnitIds);
}
