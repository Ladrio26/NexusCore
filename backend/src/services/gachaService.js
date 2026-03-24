import { randomUUID } from 'node:crypto';
import { query, withTransaction } from '../config/db.js';
import { getPowerBonusPercent } from '../../../core/unitPower.js';
import { getSkillDescriptionForTooltip } from '../utils/skillDescription.js';
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

/** Rareté unité depuis la DB pour pity / récompenses duplicate (ne jamais se fier seulement au tirage RNG). */
function normalizeRarityForPity(raw) {
  const r = String(raw ?? '').toLowerCase().trim();
  if (VALID_RARITIES.includes(r)) return r;
  return 'common';
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

// --- Bannières divines (unités Lumière/Ténèbres)
const COST_DIVINE_CORE = 10;
const COST_DIVINE_STANDARD = 100;
const COST_DIVINE_RESONANCE = 100;
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

/** Devise et montant d'un tirage (une seule clé non nulle dans costPayload). */
function describeCostPayload(costPayload) {
  const keys = ['credits', 'cores', 'fragments', 'divine_cores', 'divine_credits', 'divine_fragments'];
  for (const k of keys) {
    if (costPayload[k] != null) return { currency: k, amount: Number(costPayload[k]) };
  }
  return { currency: 'unknown', amount: 0 };
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
    'SELECT user_id, credits, cores, fragments, ascension_essence, gold, divine_cores, divine_credits, divine_fragments FROM user_wallet WHERE user_id = ?',
    [userId]
  );
  if (rows.length === 0) {
    await query(
      'INSERT INTO user_wallet (user_id, credits, cores, fragments, ascension_essence, gold, divine_cores, divine_credits, divine_fragments) VALUES (?, 0, 0, 0, 0, 0, 0, 0, 0)',
      [userId]
    );
    return { user_id: userId, credits: 0, cores: 0, fragments: 0, ascension_essence: 0, gold: 0, divine_cores: 0, divine_credits: 0, divine_fragments: 0 };
  }
  const row = rows[0];
  return { ...row, divine_cores: row.divine_cores ?? 0, divine_credits: row.divine_credits ?? 0, divine_fragments: row.divine_fragments ?? 0 };
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

const GUARANTEED_MYTHIC_NAMES = ['lzdalpha', 'hixxy', 'klinx'];

function normalizeForGuaranteedMythic(name) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, '');
}

/** Vérifie si l'utilisateur a une mythic garantie (LZDAlpha, Hixxy). Table + display_name en fallback. */
export async function hasGuaranteedMythic(userId) {
  try {
    const tableRows = await query('SELECT used FROM user_guaranteed_next_mythic WHERE user_id = ? LIMIT 1', [userId]);
    if (tableRows.length > 0) {
      return Number(tableRows[0]?.used) === 0;
    }
  } catch (_) {
    // Table peut ne pas exister
  }
  const userRows = await query('SELECT display_name FROM users WHERE id = ? LIMIT 1', [userId]);
  const displayName = userRows[0]?.display_name;
  if (!displayName) return false;
  const normalized = normalizeForGuaranteedMythic(displayName);
  return GUARANTEED_MYTHIC_NAMES.includes(normalized);
}

/**
 * Légendaire garantie au prochain tirage du portail standard (sans toucher au compteur pity_legendary).
 * Piloté par la table user_guaranteed_next_legendary_standard (used = 0).
 */
export async function hasGuaranteedNextLegendaryStandard(userId) {
  try {
    const tableRows = await query(
      'SELECT used FROM user_guaranteed_next_legendary_standard WHERE user_id = ? LIMIT 1',
      [userId]
    );
    if (tableRows.length > 0) {
      return Number(tableRows[0]?.used) === 0;
    }
  } catch (_) {
    // Table peut ne pas exister
  }
  return false;
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

/** Éléments pour portails classiques (feu, eau, plante) vs divins (lumière, ténèbres). */
const ELEMENT_FILTER_CLASSIC = ['fire', 'water', 'plant'];
const ELEMENT_FILTER_DIVINE = ['light', 'dark'];

/**
 * Retourne les id d'unités de la rareté donnée, en excluant les boss de chapitre.
 * @param {string} rarity - Rareté
 * @param {string[]} [elementFilter] - Si fourni, filtre par élément (ex: ['fire','water','plant'] ou ['light','dark'])
 */
async function getUnitIdsByRarity(rarity, elementFilter) {
  const r = validateRarity(rarity);
  const bossCodes = await getBossUnitCodes();
  let sql = 'SELECT id FROM units WHERE rarity = ? AND COALESCE(is_boss, 0) = 0';
  const params = [r];
  if (Array.isArray(elementFilter) && elementFilter.length > 0) {
    const placeholders = elementFilter.map(() => '?').join(', ');
    sql += ` AND LOWER(element) IN (${placeholders})`;
    params.push(...elementFilter.map((e) => String(e).toLowerCase()));
  }
  if (bossCodes.length > 0) {
    const bossPlaceholders = bossCodes.map(() => '?').join(', ');
    sql += ` AND code NOT IN (${bossPlaceholders})`;
    params.push(...bossCodes);
  }
  return query(sql, params);
}

function getElementFilterForBanner(bannerKey) {
  const key = String(bannerKey || 'standard').toLowerCase();
  if (key === 'divine_core' || key === 'divine_standard' || key === 'divine_resonance') return ELEMENT_FILTER_DIVINE;
  return ELEMENT_FILTER_CLASSIC;
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
  const elementFilter = getElementFilterForBanner(bannerKey);

  for (const rarity of prioritizedRarities) {
    const unitIds = await getUnitIdsByRarity(rarity, elementFilter);
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
  if (key === 'core' || key === 'divine_core') return WEIGHTS_CORE;
  if (key === 'resonance' || key === 'divine_resonance') return WEIGHTS_RESONANCE;
  return WEIGHTS_STANDARD;
}

async function chooseUniqueStarterUnitId(userId, bannerKey, initialRarity, rng) {
  const ownedUnitIds = await getOwnedUnitIds(userId);
  const elementFilter = getElementFilterForBanner(bannerKey);
  const initialPool = await getUnitIdsByRarity(initialRarity, elementFilter);
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
      units: (await getUnitIdsByRarity(rarity, elementFilter)).filter((row) => !ownedUnitIds.has(Number(row.id)))
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
 * Met à jour les compteurs pity après un tirage standard / divin standard.
 * `rarity` doit être la rareté réelle de l’unité obtenue (table `units`), pas seulement le résultat RNG,
 * pour éviter un décalage affichage / pity.
 *
 * Comportement :
 * - mythic : tout remet à 0 (palier mythique atteint).
 * - legendary : epic & legendary à 0 ; mythic +1 (on avance vers le palier mythique).
 * - epic : epic à 0 ; legendary & mythic +1.
 * - common / uncommon / rare : les trois +1.
 */
function getNextPityCounters(pity, rarity) {
  const r = normalizeRarityForPity(rarity);
  const pe = pity.pity_epic ?? 0;
  const pl = pity.pity_legendary ?? 0;
  const pm = pity.pity_mythic ?? 0;
  if (r === 'mythic') {
    return { newPityEpic: 0, newPityLegendary: 0, newPityMythic: 0 };
  }
  if (r === 'legendary') {
    return { newPityEpic: 0, newPityLegendary: 0, newPityMythic: pm + 1 };
  }
  if (r === 'epic') {
    return { newPityEpic: 0, newPityLegendary: pl + 1, newPityMythic: pm + 1 };
  }
  return { newPityEpic: pe + 1, newPityLegendary: pl + 1, newPityMythic: pm + 1 };
}

function buildPullResult(userId, type, cost, unitRow, rarity, pullMeta, wallet, pity) {
  const w = wallet || {};
  const duplicateRewards = pullMeta?.duplicateRewards ?? { credits: 0, fragments: 0 };
  const unit = unitRow ? { ...unitRow, skill_description: getSkillDescriptionForTooltip(unitRow) } : null;
  const out = {
    success: true,
    type,
    cost: {},
    unit,
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
      ascension_essence: w.ascension_essence ?? 0,
      divine_cores: w.divine_cores ?? 0,
      divine_credits: w.divine_credits ?? 0,
      divine_fragments: w.divine_fragments ?? 0
    }
  };
  if (type === 'standard') out.cost.credits = cost;
  else if (type === 'core') out.cost.cores = cost;
  else if (type === 'resonance') out.cost.fragments = cost;
  else if (type === 'divine_core') out.cost.divine_cores = cost;
  else if (type === 'divine_standard') out.cost.divine_credits = cost;
  else if (type === 'divine_resonance') out.cost.divine_fragments = cost;
  if ((type === 'standard' || type === 'divine_standard') && pity) {
    out.pity = {
      total_pulls: pity.total_pulls ?? 0,
      pity_epic: pity.pity_epic ?? 0,
      pity_legendary: pity.pity_legendary ?? 0,
      pity_mythic: pity.pity_mythic ?? 0
    };
  }
  return out;
}

/**
 * @param {object} [opts]
 * @param {string|null} [opts.batchId] UUID pour grouper un x10
 * @param {number|null} [opts.batchIndex]
 * @param {number|null} [opts.batchSize]
 */
async function executePull(userId, type, costPayload, getRarity, bannerKey, opts = {}) {
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
  if (costPayload.divine_cores != null && (wallet.divine_cores ?? 0) < costPayload.divine_cores) {
    return { success: false, error: 'INSUFFICIENT_DIVINE_CORES', required: costPayload.divine_cores };
  }
  if (costPayload.divine_credits != null && (wallet.divine_credits ?? 0) < costPayload.divine_credits) {
    return { success: false, error: 'INSUFFICIENT_DIVINE_CREDITS', required: costPayload.divine_credits };
  }
  if (costPayload.divine_fragments != null && (wallet.divine_fragments ?? 0) < costPayload.divine_fragments) {
    return { success: false, error: 'INSUFFICIENT_DIVINE_FRAGMENTS', required: costPayload.divine_fragments };
  }

  const pity = await getOrCreatePity(userId, bannerKey);
  const totalPullCount = await getTotalPullCount(userId);
  const totalPulls = (pity.total_pulls ?? 0) + 1;
  const seed = hashSeed(userId, bannerKey, totalPulls);
  const rng = mulberry32(seed);

  // Garantie mythique à la prochaine invocation (LZDAlpha, Hixxy) — invisible, pity inchangé côté affichage
  let forceMythic = false;
  let forceLegendaryStandard = false;
  if (bannerKey === 'standard') {
    forceMythic = await hasGuaranteedMythic(userId);
    if (!forceMythic) {
      forceLegendaryStandard = await hasGuaranteedNextLegendaryStandard(userId);
    }
  }
  let rarity = forceMythic ? 'mythic' : forceLegendaryStandard ? 'legendary' : getRarity(pity, rng);

  let unitId;
  if (!forceMythic && !forceLegendaryStandard && totalPullCount < STARTER_UNIQUE_PULL_COUNT) {
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
    if (forceMythic) {
      await tx.query(
        'INSERT INTO user_guaranteed_next_mythic (user_id, used) VALUES (?, 1) ON DUPLICATE KEY UPDATE used = 1',
        [userId]
      );
    }
    if (forceLegendaryStandard) {
      await tx.query(
        'INSERT INTO user_guaranteed_next_legendary_standard (user_id, used) VALUES (?, 1) ON DUPLICATE KEY UPDATE used = 1',
        [userId]
      );
    }
    if (costPayload.credits != null) {
      await tx.query('UPDATE user_wallet SET credits = credits - ? WHERE user_id = ?', [costPayload.credits, userId]);
    }
    if (costPayload.cores != null) {
      await tx.query('UPDATE user_wallet SET cores = cores - ? WHERE user_id = ?', [costPayload.cores, userId]);
    }
    if (costPayload.fragments != null) {
      await tx.query('UPDATE user_wallet SET fragments = fragments - ? WHERE user_id = ?', [costPayload.fragments, userId]);
    }
    if (costPayload.divine_cores != null) {
      await tx.query('UPDATE user_wallet SET divine_cores = divine_cores - ? WHERE user_id = ?', [costPayload.divine_cores, userId]);
    }
    if (costPayload.divine_credits != null) {
      await tx.query('UPDATE user_wallet SET divine_credits = divine_credits - ? WHERE user_id = ?', [costPayload.divine_credits, userId]);
    }
    if (costPayload.divine_fragments != null) {
      await tx.query('UPDATE user_wallet SET divine_fragments = divine_fragments - ? WHERE user_id = ?', [costPayload.divine_fragments, userId]);
    }

    const unitRarityRows = await tx.query('SELECT rarity FROM units WHERE id = ? LIMIT 1', [unitId]);
    const dbRarity = normalizeRarityForPity(unitRarityRows?.[0]?.rarity ?? rarity);

    const pityUpdate = bannerKey === 'standard' || bannerKey === 'divine_standard'
      ? getNextPityCounters(pity, dbRarity)
      : { newPityEpic: pity.pity_epic ?? 0, newPityLegendary: pity.pity_legendary ?? 0, newPityMythic: pity.pity_mythic ?? 0 };
    const { newPityEpic, newPityLegendary, newPityMythic } = pityUpdate;

    if (bannerKey === 'standard' || bannerKey === 'divine_standard') {
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
    grantMeta = await grantSummonedUnitToUser(userId, unitId, dbRarity, tx);

    const costDesc = describeCostPayload(costPayload);
    const dup = grantMeta?.duplicateRewards ?? { credits: 0, fragments: 0 };
    await tx.query(
      `INSERT INTO gacha_sanctuary_pull_log (
        user_id, pull_type, banner_key, cost_currency, cost_amount,
        unit_id, unit_rarity, is_new_unit, duplicate_credits, duplicate_fragments,
        batch_id, batch_index, batch_size
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        String(type),
        String(bannerKey),
        costDesc.currency,
        costDesc.amount,
        unitId,
        dbRarity,
        grantMeta?.isNewUnit ? 1 : 0,
        Number(dup.credits ?? 0),
        Number(dup.fragments ?? 0),
        opts.batchId ?? null,
        opts.batchIndex != null ? Number(opts.batchIndex) : null,
        opts.batchSize != null ? Number(opts.batchSize) : null
      ]
    );
  });

  const unitRow = await getBasicUnitRow(unitId);
  if (unitRow && unitRow.rarity != null) {
    validateRarity(unitRow.rarity);
  }
  const newWallet = await getWalletSnapshot(userId);
  const newPity = await getOrCreatePity(userId, bannerKey);
  const cost = costPayload.credits ?? costPayload.cores ?? costPayload.fragments ?? costPayload.divine_credits ?? costPayload.divine_cores ?? costPayload.divine_fragments ?? 0;

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
 * Bannière Standard : 100 credits, pity Épique 25 / Légendaire 100 / Mythic 1000. Unités Feu/Eau/Plante.
 */
export async function pullStandard(userId, opts = {}) {
  return executePull(userId, 'standard', { credits: COST_STANDARD_CREDITS }, resolveRarityStandard, 'standard', opts);
}

/**
 * Bannière Core : 10 cores, pas de pity. Unités Feu/Eau/Plante.
 */
export async function pullCore(userId, opts = {}) {
  const getRarity = (_, rng) => rollRarity(WEIGHTS_CORE, rng);
  return executePull(userId, 'core', { cores: COST_CORE }, getRarity, 'core', opts);
}

/**
 * Bannière Résonance : 100 fragments, pas de pity. Unités Feu/Eau/Plante.
 */
export async function pullResonance(userId, opts = {}) {
  const getRarity = (_, rng) => rollRarity(WEIGHTS_RESONANCE, rng);
  return executePull(userId, 'resonance', { fragments: COST_RESONANCE }, getRarity, 'resonance', opts);
}

/**
 * Bannière Divine Core : 10 cores divins, pas de pity. Unités Lumière/Ténèbres.
 */
export async function pullDivineCore(userId, opts = {}) {
  const getRarity = (_, rng) => rollRarity(WEIGHTS_CORE, rng);
  return executePull(userId, 'divine_core', { divine_cores: COST_DIVINE_CORE }, getRarity, 'divine_core', opts);
}

/**
 * Bannière Divine Standard : 100 crédits divins, pity comme Standard. Unités Lumière/Ténèbres.
 */
function resolveRarityDivineStandard(pity, rng) {
  if ((pity.pity_mythic ?? 0) >= PITY_MYTHIC_AT - 1) return 'mythic';
  if ((pity.pity_legendary ?? 0) >= PITY_LEGENDARY_AT - 1) return 'legendary';
  if ((pity.pity_epic ?? 0) >= PITY_EPIC_AT - 1) return 'epic';
  return rollRarity(WEIGHTS_STANDARD, rng);
}

export async function pullDivineStandard(userId, opts = {}) {
  return executePull(
    userId,
    'divine_standard',
    { divine_credits: COST_DIVINE_STANDARD },
    resolveRarityDivineStandard,
    'divine_standard',
    opts
  );
}

/**
 * Bannière Divine Résonance : 100 fragments divins, pas de pity. Unités Lumière/Ténèbres.
 */
export async function pullDivineResonance(userId, opts = {}) {
  const getRarity = (_, rng) => rollRarity(WEIGHTS_RESONANCE, rng);
  return executePull(
    userId,
    'divine_resonance',
    { divine_fragments: COST_DIVINE_RESONANCE },
    getRarity,
    'divine_resonance',
    opts
  );
}

function getPullCostByType(type) {
  const key = String(type || '').toLowerCase();
  if (key === 'core') return { key: 'cores', value: COST_CORE };
  if (key === 'resonance') return { key: 'fragments', value: COST_RESONANCE };
  if (key === 'divine_core') return { key: 'divine_cores', value: COST_DIVINE_CORE };
  if (key === 'divine_standard') return { key: 'divine_credits', value: COST_DIVINE_STANDARD };
  if (key === 'divine_resonance') return { key: 'divine_fragments', value: COST_DIVINE_RESONANCE };
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
    if (normalizedType === 'divine_core') return pullDivineCore(userId);
    if (normalizedType === 'divine_standard') return pullDivineStandard(userId);
    if (normalizedType === 'divine_resonance') return pullDivineResonance(userId);
    return pullStandard(userId);
  }

  const wallet = await getOrCreateWallet(userId);
  const { key, value } = getPullCostByType(normalizedType);
  const totalCost = value * normalizedCount;
  const currentAmount = Number(wallet[key] ?? 0);
  if (currentAmount < totalCost) {
    if (key === 'credits') return { success: false, error: 'INSUFFICIENT_CREDITS', required: totalCost };
    if (key === 'divine_credits') return { success: false, error: 'INSUFFICIENT_DIVINE_CREDITS', required: totalCost };
    if (key === 'divine_cores') return { success: false, error: 'INSUFFICIENT_DIVINE_CORES', required: totalCost };
    if (key === 'divine_fragments') return { success: false, error: 'INSUFFICIENT_DIVINE_FRAGMENTS', required: totalCost };
    if (key === 'cores') return { success: false, error: 'INSUFFICIENT_CORES', required: totalCost };
    return { success: false, error: 'INSUFFICIENT_FRAGMENTS', required: totalCost };
  }

  const batchId = randomUUID();
  const batchOpts = { batchId, batchSize: normalizedCount };
  const pulls = [];
  for (let i = 0; i < normalizedCount; i++) {
    const opts = { ...batchOpts, batchIndex: i };
    let result;
    if (normalizedType === 'core') result = await pullCore(userId, opts);
    else if (normalizedType === 'resonance') result = await pullResonance(userId, opts);
    else if (normalizedType === 'divine_core') result = await pullDivineCore(userId, opts);
    else if (normalizedType === 'divine_standard') result = await pullDivineStandard(userId, opts);
    else if (normalizedType === 'divine_resonance') result = await pullDivineResonance(userId, opts);
    else result = await pullStandard(userId, opts);
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
    pity: (normalizedType === 'standard' || normalizedType === 'divine_standard') ? (pulls[pulls.length - 1]?.pity ?? null) : null
  };
}

export async function getWallet(userId) {
  const w = await getOrCreateWallet(userId);
  return {
    credits: w.credits ?? 0,
    cores: w.cores ?? 0,
    fragments: w.fragments ?? 0,
    ascension_essence: w.ascension_essence ?? 0,
    gold: w.gold ?? 0,
    divine_cores: w.divine_cores ?? 0,
    divine_credits: w.divine_credits ?? 0,
    divine_fragments: w.divine_fragments ?? 0
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
