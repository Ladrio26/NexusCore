import { query, withTransaction } from '../config/db.js';
import { getPowerBonusPercent } from '../../../core/unitPower.js';
import { getBasicUnitRow, getWalletSnapshot, grantSummonedUnitToUser } from './unitGrantService.js';
import {
  createGuildNotification,
  resolveUserGuildId,
  GUILD_NOTIFICATION_TYPES
} from './guildNotificationService.js';

// --- Raretés normalisées (une seule valeur par pool en DB)
const VALID_RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

function validateRarity(rarity) {
  const r = String(rarity || '').toLowerCase();
  if (!VALID_RARITIES.includes(r)) {
    throw new Error(`Rareté invalide: ${rarity}. Valeurs autorisées: ${VALID_RARITIES.join(', ')}`);
  }
  return r;
}

// --- Bannière Standard (credits)
const COST_STANDARD_CREDITS = 100;
const WEIGHTS_STANDARD = { common: 49.9, uncommon: 30, rare: 15, epic: 4, legendary: 1, mythic: 0.1 };
export const STANDARD_PORTAL_WEIGHTS = Object.freeze({ ...WEIGHTS_STANDARD });
const PITY_EPIC_AT = 25;
const PITY_LEGENDARY_AT = 100;
const PITY_MYTHIC_AT = 1000;

// --- Bannière Core (cores)
const COST_CORE = 10;
const WEIGHTS_CORE = { common: 50, uncommon: 40, rare: 10 };

// --- Bannière Résonance (fragments)
const COST_RESONANCE = 100;
const WEIGHTS_RESONANCE = { rare: 90, epic: 10 };
const STARTER_UNIQUE_PULL_COUNT = 5;

/** RNG seedé (Mulberry32) */
function mulberry32(seed) {
  return function next() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(userId, bannerKey, totalPulls) {
  let h = 0;
  const s = `${userId}-${bannerKey}-${totalPulls}`;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h) || 1;
}

async function getOrCreateWallet(userId) {
  let rows = await query(
    'SELECT user_id, credits, cores, fragments, ascension_essence, gold FROM user_wallet WHERE user_id = ?',
    [userId]
  );
  if (rows.length === 0) {
    await query(
      'INSERT INTO user_wallet (user_id, credits, cores, fragments, ascension_essence, gold) VALUES (?, 0, 0, 0, 0, 0)',
      [userId]
    );
    return { user_id: userId, credits: 0, cores: 0, fragments: 0, ascension_essence: 0, gold: 0 };
  }
  return rows[0];
}

async function getOrCreatePity(userId, bannerKey) {
  const key = String(bannerKey || 'standard').toLowerCase();
  let rows = await query(
    'SELECT user_id, banner_key, total_pulls, pity_epic, pity_legendary, pity_mythic FROM gacha_pity WHERE user_id = ? AND banner_key = ?',
    [userId, key]
  );
  if (rows.length === 0) {
    await query(
      'INSERT INTO gacha_pity (user_id, banner_key, total_pulls, pity_epic, pity_legendary, pity_mythic) VALUES (?, ?, 0, 0, 0, 0)',
      [userId, key]
    );
    return { user_id: userId, banner_key: key, total_pulls: 0, pity_epic: 0, pity_legendary: 0, pity_mythic: 0 };
  }
  return rows[0];
}

async function getTotalPullCount(userId) {
  const rows = await query(
    'SELECT COALESCE(SUM(total_pulls), 0) AS total_pulls FROM gacha_pity WHERE user_id = ?',
    [userId]
  );
  return Number(rows[0]?.total_pulls ?? 0);
}

async function getOwnedUnitIds(userId) {
  const rows = await query('SELECT unit_id FROM user_units WHERE user_id = ?', [userId]);
  return new Set(rows.map((row) => Number(row.unit_id)).filter((id) => Number.isInteger(id) && id > 0));
}

/**
 * Liste des codes d'unités qui sont des boss de chapitre (campaign_stages.boss_unit_code).
 * Ces unités ne doivent pas être tirées au Sanctuaire.
 */
export async function getBossUnitCodes() {
  const rows = await query(
    'SELECT DISTINCT boss_unit_code FROM campaign_stages WHERE boss_unit_code IS NOT NULL AND boss_unit_code != ""'
  );
  return rows.map((row) => row.boss_unit_code);
}

/**
 * Retourne les id d'unités de la rareté donnée, en excluant les boss de chapitre.
 */
async function getUnitIdsByRarity(rarity) {
  const r = validateRarity(rarity);
  const bossCodes = await getBossUnitCodes();
  if (bossCodes.length === 0) {
    return query('SELECT id FROM units WHERE rarity = ?', [r]);
  }
  const placeholders = bossCodes.map(() => '?').join(', ');
  return query(
    `SELECT id FROM units WHERE rarity = ? AND code NOT IN (${placeholders})`,
    [r, ...bossCodes]
  );
}

async function pickUnitForRarityOrFallback(targetRarity, bannerKey, rng) {
  const normalizedTarget = validateRarity(targetRarity);
  const bannerRarities = Object.keys(getBannerWeights(bannerKey))
    .map((rarity) => validateRarity(rarity));
  const targetIndex = RARITY_ORDER.indexOf(normalizedTarget);
  const prioritizedRarities = [
    ...bannerRarities
      .filter((rarity) => RARITY_ORDER.indexOf(rarity) <= targetIndex)
      .sort((a, b) => RARITY_ORDER.indexOf(b) - RARITY_ORDER.indexOf(a)),
    ...bannerRarities
      .filter((rarity) => RARITY_ORDER.indexOf(rarity) > targetIndex)
      .sort((a, b) => RARITY_ORDER.indexOf(a) - RARITY_ORDER.indexOf(b))
  ];

  for (const rarity of prioritizedRarities) {
    const unitIds = await getUnitIdsByRarity(rarity);
    if (!unitIds.length) continue;
    return {
      unitId: Number(unitIds[Math.floor(rng() * unitIds.length)].id),
      rarity
    };
  }
  return null;
}

function getBannerWeights(bannerKey) {
  const key = String(bannerKey || 'standard').toLowerCase();
  if (key === 'core') return WEIGHTS_CORE;
  if (key === 'resonance') return WEIGHTS_RESONANCE;
  return WEIGHTS_STANDARD;
}

async function chooseUniqueStarterUnitId(userId, bannerKey, initialRarity, rng) {
  const ownedUnitIds = await getOwnedUnitIds(userId);
  const initialPool = await getUnitIdsByRarity(initialRarity);
  const initialCandidates = initialPool.filter((row) => !ownedUnitIds.has(Number(row.id)));
  if (initialCandidates.length > 0) {
    return {
      unitId: Number(initialCandidates[Math.floor(rng() * initialCandidates.length)].id),
      rarity: initialRarity
    };
  }

  const weights = getBannerWeights(bannerKey);
  const fallbackRarities = Object.keys(weights);
  const rarityPools = await Promise.all(
    fallbackRarities.map(async (rarity) => ({
      rarity,
      units: (await getUnitIdsByRarity(rarity)).filter((row) => !ownedUnitIds.has(Number(row.id)))
    }))
  );
  const availablePools = rarityPools.filter((entry) => entry.units.length > 0);
  if (availablePools.length === 0) {
    return null;
  }

  const totalWeight = availablePools.reduce((sum, entry) => sum + (Number(weights[entry.rarity]) || 0), 0);
  if (totalWeight <= 0) {
    const firstPool = availablePools[0];
    return {
      unitId: Number(firstPool.units[Math.floor(rng() * firstPool.units.length)].id),
      rarity: firstPool.rarity
    };
  }

  let roll = rng() * totalWeight;
  for (const entry of availablePools) {
    roll -= Number(weights[entry.rarity]) || 0;
    if (roll <= 0) {
      return {
        unitId: Number(entry.units[Math.floor(rng() * entry.units.length)].id),
        rarity: entry.rarity
      };
    }
  }

  const lastPool = availablePools[availablePools.length - 1];
  return {
    unitId: Number(lastPool.units[Math.floor(rng() * lastPool.units.length)].id),
    rarity: lastPool.rarity
  };
}

export function rollRarity(weights, rng) {
  const rand = rng() * 100;
  let acc = 0;
  for (const r of Object.keys(weights)) {
    acc += weights[r];
    if (rand < acc) return r;
  }
  return Object.keys(weights).pop();
}

/**
 * Pity bannière standard : le plus rare l’emporte.
 * Si plusieurs paliers sont à seuil (ex. epic 10 et legendary 60), on déclenche le plus rare ;
 * les autres restent à seuil et se déclencheront au prochain pull.
 */
function resolveRarityStandard(pity, rng) {
  if ((pity.pity_mythic ?? 0) >= PITY_MYTHIC_AT - 1) return 'mythic';
  if ((pity.pity_legendary ?? 0) >= PITY_LEGENDARY_AT - 1) return 'legendary';
  if ((pity.pity_epic ?? 0) >= PITY_EPIC_AT - 1) return 'epic';
  return rollRarity(WEIGHTS_STANDARD, rng);
}

/**
 * Met à jour les compteurs pity après un tirage standard.
 * Si on a déclenché un palier rare (legendary/mythic), on ne réinitialise pas les paliers
 * plus communs : ils restent à seuil et se déclencheront au prochain pull.
 */
function getNextPityCounters(pity, rarity) {
  const pe = pity.pity_epic ?? 0;
  const pl = pity.pity_legendary ?? 0;
  const pm = pity.pity_mythic ?? 0;
  if (rarity === 'mythic') {
    return { newPityEpic: 0, newPityLegendary: 0, newPityMythic: 0 };
  }
  if (rarity === 'legendary') {
    return { newPityEpic: 0, newPityLegendary: 0, newPityMythic: pm + 1 };
  }
  if (rarity === 'epic') {
    return { newPityEpic: 0, newPityLegendary: pl + 1, newPityMythic: pm + 1 };
  }
  return { newPityEpic: pe + 1, newPityLegendary: pl + 1, newPityMythic: pm + 1 };
}

function buildPullResult(userId, type, cost, unitRow, rarity, pullMeta, wallet, pity) {
  const w = wallet || {};
  const duplicateRewards = pullMeta?.duplicateRewards ?? { credits: 0, fragments: 0 };
  const out = {
    success: true,
    type,
    cost: {},
    unit: unitRow,
    rarity,
    isNewUnit: !!pullMeta?.isNewUnit,
    fragmentsGained: duplicateRewards.fragments ?? 0,
    creditsGained: duplicateRewards.credits ?? 0,
    duplicateRewards,
    power: {
      level: pullMeta?.powerLevel ?? 1,
      previousLevel: pullMeta?.previousPowerLevel ?? 1,
      openings: pullMeta?.powerOpenings ?? 1,
      bonusPercent: getPowerBonusPercent(pullMeta?.powerLevel ?? 1),
      leveledUp: !!pullMeta?.powerLevelUp,
      isMax: !!pullMeta?.powerProgress?.isMax,
      nextLevel: pullMeta?.powerProgress?.nextLevel ?? null,
      progressInCurrentTier: pullMeta?.powerProgress?.progressInCurrentTier ?? 1,
      requiredInCurrentTier: pullMeta?.powerProgress?.requiredInCurrentTier ?? 0,
      nextThreshold: pullMeta?.powerProgress?.nextThreshold ?? null
    },
    wallet: {
      credits: w.credits ?? 0,
      cores: w.cores ?? 0,
      fragments: w.fragments ?? 0,
      ascension_essence: w.ascension_essence ?? 0
    }
  };
  if (type === 'standard') out.cost.credits = cost;
  else if (type === 'core') out.cost.cores = cost;
  else if (type === 'resonance') out.cost.fragments = cost;
  if (type === 'standard' && pity) {
    out.pity = {
      total_pulls: pity.total_pulls ?? 0,
      pity_epic: pity.pity_epic ?? 0,
      pity_legendary: pity.pity_legendary ?? 0,
      pity_mythic: pity.pity_mythic ?? 0
    };
  }
  return out;
}

async function executePull(userId, type, costPayload, getRarity, bannerKey) {
  const wallet = await getOrCreateWallet(userId);
  if (costPayload.credits != null && (wallet.credits ?? 0) < costPayload.credits) {
    return { success: false, error: 'INSUFFICIENT_CREDITS', required: costPayload.credits };
  }
  if (costPayload.cores != null && (wallet.cores ?? 0) < costPayload.cores) {
    return { success: false, error: 'INSUFFICIENT_CORES', required: costPayload.cores };
  }
  if (costPayload.fragments != null && (wallet.fragments ?? 0) < costPayload.fragments) {
    return { success: false, error: 'INSUFFICIENT_FRAGMENTS', required: costPayload.fragments };
  }

  const pity = await getOrCreatePity(userId, bannerKey);
  const totalPullCount = await getTotalPullCount(userId);
  const totalPulls = (pity.total_pulls ?? 0) + 1;
  const seed = hashSeed(userId, bannerKey, totalPulls);
  const rng = mulberry32(seed);
  let rarity = getRarity(pity, rng);

  let unitId;
  if (totalPullCount < STARTER_UNIQUE_PULL_COUNT) {
    const uniqueStarterPick = await chooseUniqueStarterUnitId(userId, bannerKey, rarity, rng);
    if (uniqueStarterPick) {
      unitId = uniqueStarterPick.unitId;
      rarity = uniqueStarterPick.rarity;
    }
  }

  if (unitId == null) {
    const pickedUnit = await pickUnitForRarityOrFallback(rarity, bannerKey, rng);
    if (!pickedUnit) {
      return { success: false, error: 'NO_UNIT_FOR_RARITY', rarity };
    }
    unitId = pickedUnit.unitId;
    rarity = pickedUnit.rarity;
  }

  let grantMeta = null;
  await withTransaction(async (tx) => {
    if (costPayload.credits != null) {
      await tx.query('UPDATE user_wallet SET credits = credits - ? WHERE user_id = ?', [costPayload.credits, userId]);
    }
    if (costPayload.cores != null) {
      await tx.query('UPDATE user_wallet SET cores = cores - ? WHERE user_id = ?', [costPayload.cores, userId]);
    }
    if (costPayload.fragments != null) {
      await tx.query('UPDATE user_wallet SET fragments = fragments - ? WHERE user_id = ?', [costPayload.fragments, userId]);
    }
    const pityUpdate = bannerKey === 'standard'
      ? getNextPityCounters(pity, rarity)
      : { newPityEpic: pity.pity_epic ?? 0, newPityLegendary: pity.pity_legendary ?? 0, newPityMythic: pity.pity_mythic ?? 0 };
    const { newPityEpic, newPityLegendary, newPityMythic } = pityUpdate;

    if (bannerKey === 'standard') {
      await tx.query(
        `INSERT INTO gacha_pity (user_id, banner_key, total_pulls, pity_epic, pity_legendary, pity_mythic)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           total_pulls = total_pulls + 1,
           pity_epic = VALUES(pity_epic),
           pity_legendary = VALUES(pity_legendary),
           pity_mythic = VALUES(pity_mythic)`,
        [userId, bannerKey, totalPulls, newPityEpic, newPityLegendary, newPityMythic]
      );
    } else {
      await tx.query(
        `INSERT INTO gacha_pity (user_id, banner_key, total_pulls, pity_epic, pity_legendary, pity_mythic)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE total_pulls = total_pulls + 1`,
        [userId, bannerKey, totalPulls, pity.pity_epic ?? 0, pity.pity_legendary ?? 0, pity.pity_mythic ?? 0]
      );
    }
    grantMeta = await grantSummonedUnitToUser(userId, unitId, rarity, tx);
  });

  const unitRow = await getBasicUnitRow(unitId);
  if (unitRow && unitRow.rarity != null) {
    validateRarity(unitRow.rarity);
  }
  const newWallet = await getWalletSnapshot(userId);
  const newPity = await getOrCreatePity(userId, bannerKey);
  const cost = costPayload.credits ?? costPayload.cores ?? costPayload.fragments ?? 0;

  const responseRarity = (unitRow && unitRow.rarity != null)
    ? String(unitRow.rarity).toLowerCase()
    : rarity;

  // Notification guilde pour mythic / legendary (silencieuse, non-bloquante)
  if (responseRarity === 'mythic' || responseRarity === 'legendary') {
    void resolveUserGuildId(userId).then((guildId) => {
      if (!guildId || !unitRow) return;
      const notifType = responseRarity === 'mythic'
        ? GUILD_NOTIFICATION_TYPES.SUMMON_MYTHIC
        : GUILD_NOTIFICATION_TYPES.SUMMON_LEGENDARY;
      return createGuildNotification(guildId, userId, notifType, {
        unit_name: unitRow.name ?? 'Unité inconnue',
        rarity: responseRarity
      });
    }).catch(() => {});
  }

  return buildPullResult(userId, type, cost, unitRow, responseRarity, {
    ...(grantMeta || {})
  }, newWallet, newPity);
}

/**
 * Bannière Standard : 100 credits, pity Épique 25 / Légendaire 100 / Mythic 1000.
 */
export async function pullStandard(userId) {
  return executePull(userId, 'standard', { credits: COST_STANDARD_CREDITS }, resolveRarityStandard, 'standard');
}

/**
 * Bannière Core : 10 cores, pas de pity.
 */
export async function pullCore(userId) {
  const getRarity = (_, rng) => rollRarity(WEIGHTS_CORE, rng);
  return executePull(userId, 'core', { cores: COST_CORE }, getRarity, 'core');
}

/**
 * Bannière Résonance : 100 fragments, pas de pity.
 */
export async function pullResonance(userId) {
  const getRarity = (_, rng) => rollRarity(WEIGHTS_RESONANCE, rng);
  return executePull(userId, 'resonance', { fragments: COST_RESONANCE }, getRarity, 'resonance');
}

function getPullCostByType(type) {
  if (type === 'core') return { key: 'cores', value: COST_CORE };
  if (type === 'resonance') return { key: 'fragments', value: COST_RESONANCE };
  return { key: 'credits', value: COST_STANDARD_CREDITS };
}

function getHighestRarityFromPulls(pulls) {
  const weights = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5, mythic: 6 };
  return [...pulls].sort((a, b) => (weights[String(b?.rarity || '').toLowerCase()] ?? 0) - (weights[String(a?.rarity || '').toLowerCase()] ?? 0))[0] ?? null;
}

export async function pullMultiple(userId, type, count = 1) {
  const normalizedType = String(type || 'standard').toLowerCase();
  const normalizedCount = Number(count) === 10 ? 10 : 1;
  if (normalizedCount === 1) {
    if (normalizedType === 'core') return pullCore(userId);
    if (normalizedType === 'resonance') return pullResonance(userId);
    return pullStandard(userId);
  }

  const wallet = await getOrCreateWallet(userId);
  const { key, value } = getPullCostByType(normalizedType);
  const totalCost = value * normalizedCount;
  const currentAmount = Number(wallet[key] ?? 0);
  if (currentAmount < totalCost) {
    if (key === 'credits') return { success: false, error: 'INSUFFICIENT_CREDITS', required: totalCost };
    if (key === 'cores') return { success: false, error: 'INSUFFICIENT_CORES', required: totalCost };
    return { success: false, error: 'INSUFFICIENT_FRAGMENTS', required: totalCost };
  }

  const pulls = [];
  for (let i = 0; i < normalizedCount; i++) {
    let result;
    if (normalizedType === 'core') result = await pullCore(userId);
    else if (normalizedType === 'resonance') result = await pullResonance(userId);
    else result = await pullStandard(userId);
    if (!result?.success) return result;
    pulls.push(result);
  }

  const featured = getHighestRarityFromPulls(pulls);
  return {
    success: true,
    multi: true,
    count: normalizedCount,
    type: normalizedType,
    pulls,
    featured_rarity: featured?.rarity ?? null,
    featured_unit: featured?.unit ?? null,
    wallet: pulls[pulls.length - 1]?.wallet ?? null,
    pity: normalizedType === 'standard' ? (pulls[pulls.length - 1]?.pity ?? null) : null
  };
}

export async function getWallet(userId) {
  const w = await getOrCreateWallet(userId);
  return {
    credits: w.credits ?? 0,
    cores: w.cores ?? 0,
    fragments: w.fragments ?? 0,
    ascension_essence: w.ascension_essence ?? 0,
    gold: w.gold ?? 0
  };
}

export async function getFragments(userId) {
  const rows = await query(
    `SELECT uf.unit_id, uf.fragments, u.code, u.name, u.rarity
     FROM user_fragments uf
     JOIN units u ON u.id = uf.unit_id
     WHERE uf.user_id = ? AND uf.fragments > 0`,
    [userId]
  );
  return { fragments: rows };
}

export async function getPity(userId, bannerKey) {
  const key = String(bannerKey || 'standard').toLowerCase();
  const p = await getOrCreatePity(userId, key);
  return {
    banner_key: key,
    total_pulls: p.total_pulls ?? 0,
    pity_epic: p.pity_epic ?? 0,
    pity_legendary: p.pity_legendary ?? 0,
    pity_mythic: p.pity_mythic ?? 0
  };
}

/** Compatibilité ancienne route /gacha/pull : délègue à pullStandard. */
export async function pullUnit(userId, bannerKey) {
  const key = String(bannerKey || 'standard').toLowerCase();
  if (key === 'core') return pullCore(userId);
  if (key === 'resonance') return pullResonance(userId);
  return pullStandard(userId);
}
