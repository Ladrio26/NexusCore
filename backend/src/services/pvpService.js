/**
 * Service PvP : Elo, défense, historique, notifications, XP, fatigue.
 * Réutilise le moteur de combat (simulateBattle) et les services existants.
 */
import { query, getPool } from '../config/db.js';
import { withTransaction } from '../config/db.js';
import { addXp } from './xpService.js';
import { applyCampaignFatigue } from './campaignService.js';

const ELO_MIN = 0;
const ELO_MATCHMAKING_RANGE = 100;

/**
 * Calcule les deltas Elo PvP selon l'écart entre attaquant et défenseur.
 * Écart 0-10 : +10 / -10. Puis par tranche de 10 : favori +10-bucket / -10-bucket, underdog +10+bucket / -10+bucket.
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
  let defenderDelta;
  if (attackerWon) {
    if (attackerIsFavorite) {
      attackerDelta = 10 - bucket;
      defenderDelta = -(10 + bucket);
    } else {
      attackerDelta = 10 + bucket;
      defenderDelta = -(10 - bucket);
    }
  } else {
    if (attackerIsFavorite) {
      attackerDelta = -(10 + bucket);
      defenderDelta = 10 + bucket;
    } else {
      attackerDelta = -(10 - bucket);
      defenderDelta = 10 - bucket;
    }
  }
  return { attackerDelta, defenderDelta };
}
const XP_NORMAL_TRASH = 1600;
const PVP_XP_WIN = Math.floor(XP_NORMAL_TRASH / 2);
const PVP_XP_LOSS = Math.floor(XP_NORMAL_TRASH / 4);
const PVP_FATIGUE_ATTACKER = 3;
const PVP_RANK_REWARDS = Object.freeze([
  { key: 'SILVER_3', label: 'Argent 3', threshold: 300, credits: 50, cores: 1, fragments: 0, ascension_essence: 0 },
  { key: 'GOLD_3', label: 'Or 3', threshold: 600, credits: 100, cores: 3, fragments: 10, ascension_essence: 0 },
  { key: 'PLATINUM_3', label: 'Platine 3', threshold: 900, credits: 150, cores: 6, fragments: 30, ascension_essence: 0 },
  { key: 'DIAMOND_3', label: 'Diamant 3', threshold: 1200, credits: 200, cores: 10, fragments: 50, ascension_essence: 0 },
  { key: 'MASTER', label: 'Master', threshold: 1500, credits: 300, cores: 20, fragments: 100, ascension_essence: 0 },
  { key: 'GRAND_MASTER', label: 'Grand Master', threshold: 1600, credits: 400, cores: 30, fragments: 150, ascension_essence: 0 },
  { key: 'CHALLENGER', label: 'Challenger', threshold: 1700, credits: 500, cores: 40, fragments: 200, ascension_essence: 1 }
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

    await runQuery(
      `UPDATE user_wallet
       SET credits = credits + ?, cores = cores + ?, fragments = fragments + ?, ascension_essence = ascension_essence + ?
       WHERE user_id = ?`,
      [reward.credits, reward.cores, reward.fragments, reward.ascension_essence, userId]
    );
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
 * Définit la défense PvP du joueur (preset_id = preset_index 1-10).
 */
export async function setDefense(userId, presetId) {
  const presetIndex = Number(presetId);
  if (!Number.isInteger(presetIndex) || presetIndex < 1 || presetIndex > 10) {
    throw new Error('INVALID_PRESET_ID');
  }
  await query(
    'REPLACE INTO pvp_defenses (user_id, preset_id) VALUES (?, ?)',
    [userId, presetIndex]
  );
  return { success: true };
}

/**
 * Récupère la défense PvP du joueur (preset_id et slots).
 */
export async function getDefense(userId) {
  const rows = await query(
    'SELECT preset_id FROM pvp_defenses WHERE user_id = ?',
    [userId]
  );
  if (!rows.length) return null;
  return { preset_id: rows[0].preset_id };
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
export async function findOpponent(attackerId, excludeDefenderId = null) {
  const elo = await getPlayerElo(attackerId);
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
     WHERE ${excludeClause}
     AND u.pvp_elo BETWEEN ? AND ?
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
 */
export async function createNotification(userId, type, message, executor = null) {
  const runQuery = executor?.query ?? query;
  await runQuery(
    'INSERT INTO notifications (user_id, type, message) VALUES (?, ?, ?)',
    [userId, type, message]
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

    if (!isDraw) {
      const { attackerDelta, defenderDelta } = computePvpEloDeltas(
        lockedAttackerElo,
        lockedDefenderElo,
        attackerWon
      );
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
      await createNotification(
        defenderId,
        'pvp_attack',
        `Votre défense PvP a été attaquée par ${attackerName}.`,
        tx
      );
      for (const reward of defenderRankRewardResult.rewards) {
        await createNotification(
          defenderId,
          'pvp_rank_reward',
          `Palier PvP atteint : ${reward.label}. Récompense obtenue : ${formatRewardSummary(reward)}.`,
          tx
        );
      }
    }

    for (const reward of attackerRankRewardResult.rewards) {
      await createNotification(
        attackerId,
        'pvp_rank_reward',
        `Palier PvP atteint : ${reward.label}. Récompense obtenue : ${formatRewardSummary(reward)}.`,
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
 */
export async function grantPvpXp(attackerUserUnitIds, attackerWon) {
  const amount = attackerWon ? PVP_XP_WIN : PVP_XP_LOSS;
  const results = [];
  for (const id of attackerUserUnitIds) {
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
