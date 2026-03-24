import { query, withTransaction } from '../config/db.js';
import { getSkillDescriptionForTooltip } from '../utils/skillDescription.js';
import { STANDARD_PORTAL_WEIGHTS, getBossUnitCodes, rollRarity, hasGuaranteedMythic } from './gachaService.js';
import { getBasicUnitRow, grantSummonedUnitToUser } from './unitGrantService.js';
import { ensureGuildCurrency, getGuildCurrency, getGuildMembership } from './guildService.js';
import {
  createGuildNotification,
  GUILD_NOTIFICATION_TYPES
} from './guildNotificationService.js';

export const GUILD_PORTAL_SUMMON_COST = 100;
const GUILD_PORTAL_TIME_ZONE = 'Europe/Paris';
const ROTATION_COMPOSITION = Object.freeze({
  mythic: 1,
  legendary: 2,
  epic: 3,
  rare: 4,
  uncommon: 5,
  common: 5
});

function getRunner(executor = null) {
  return executor?.query ?? query;
}

function buildGuildPortalError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function getParisWallClockDate(now = new Date()) {
  return new Date(now.toLocaleString('en-US', { timeZone: GUILD_PORTAL_TIME_ZONE }));
}

function getIsoWeekInfo(date) {
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  target.setDate(target.getDate() + 3 - ((target.getDay() + 6) % 7));
  const weekYear = target.getFullYear();
  const firstThursday = new Date(weekYear, 0, 4);
  firstThursday.setDate(firstThursday.getDate() + 3 - ((firstThursday.getDay() + 6) % 7));
  const diffMs = target.getTime() - firstThursday.getTime();
  const weekNumber = 1 + Math.round(diffMs / 604800000);
  return { weekYear, weekNumber };
}

export function getCurrentGuildPortalWeekInfo(now = new Date()) {
  const parisNow = getParisWallClockDate(now);
  const dayOfWeek = parisNow.getDay() === 0 ? 7 : parisNow.getDay();
  const mondayParis = new Date(parisNow);
  mondayParis.setHours(0, 0, 0, 0);
  mondayParis.setDate(mondayParis.getDate() - dayOfWeek + 1);
  const nextMondayParis = new Date(mondayParis);
  nextMondayParis.setDate(nextMondayParis.getDate() + 7);
  const { weekYear, weekNumber } = getIsoWeekInfo(mondayParis);
  const rotationKey = `${weekYear}-W${String(weekNumber).padStart(2, '0')}`;
  const startsAt = new Date(now.getTime() + (mondayParis.getTime() - parisNow.getTime()));
  const endsAt = new Date(now.getTime() + (nextMondayParis.getTime() - parisNow.getTime()));
  return {
    weekYear,
    weekNumber,
    rotationKey,
    startsAt,
    endsAt,
    timeZone: GUILD_PORTAL_TIME_ZONE
  };
}

async function getRotationByKey(rotationKey, executor = null) {
  const runQuery = getRunner(executor);
  const rows = await runQuery(
    `SELECT id, rotation_key, week_year, week_number, starts_at, ends_at, created_at
     FROM guild_portal_rotations
     WHERE rotation_key = ?
     LIMIT 1`,
    [rotationKey]
  );
  return rows[0] ?? null;
}

async function getRotationById(rotationId, executor = null) {
  const runQuery = getRunner(executor);
  const rows = await runQuery(
    `SELECT id, rotation_key, week_year, week_number, starts_at, ends_at, created_at
     FROM guild_portal_rotations
     WHERE id = ?
     LIMIT 1`,
    [rotationId]
  );
  return rows[0] ?? null;
}

async function getRotationUnits(rotationId, executor = null) {
  const runQuery = getRunner(executor);
  const rows = await runQuery(
    `SELECT grru.id,
            grru.rotation_id,
            grru.unit_id,
            grru.rarity,
            grru.slot_index,
            u.code,
            u.name,
            u.role,
            u.attack_type,
            u.element,
            u.image_url
     FROM guild_portal_rotation_units grru
     JOIN units u ON u.id = grru.unit_id
     WHERE grru.rotation_id = ?
     ORDER BY grru.slot_index ASC`,
    [rotationId]
  );
  return rows.map((row) => ({
    id: Number(row.id),
    rotation_id: Number(row.rotation_id),
    unit_id: Number(row.unit_id),
    rarity: String(row.rarity),
    slot_index: Number(row.slot_index),
    code: row.code,
    name: row.name,
    role: row.role,
    attack_type: row.attack_type,
    element: row.element,
    image_url: row.image_url ?? null
  }));
}

function serializeRotationRow(row, units = []) {
  return {
    id: Number(row.id),
    rotation_key: row.rotation_key,
    week_year: Number(row.week_year),
    week_number: Number(row.week_number),
    starts_at: row.starts_at ?? null,
    ends_at: row.ends_at ?? null,
    created_at: row.created_at ?? null,
    time_zone: GUILD_PORTAL_TIME_ZONE,
    units
  };
}

async function getRotationCandidateUnitsByRarity(rarity, count, executor = null) {
  const runQuery = getRunner(executor);
  const bossCodes = await getBossUnitCodes();
  if (!bossCodes.length) {
    return runQuery(
      `SELECT id, code, name, rarity, role, attack_type, element, image_url
       FROM units
       WHERE rarity = ? AND COALESCE(is_boss, 0) = 0
       ORDER BY RAND()
       LIMIT ?`,
      [rarity, count]
    );
  }

  const placeholders = bossCodes.map(() => '?').join(', ');
  return runQuery(
    `SELECT id, code, name, rarity, role, attack_type, element, image_url
     FROM units
     WHERE rarity = ? AND COALESCE(is_boss, 0) = 0 AND code NOT IN (${placeholders})
     ORDER BY RAND()
     LIMIT ?`,
    [rarity, ...bossCodes, count]
  );
}

export async function generateGuildPortalRotationForWeek(weekInfo, executor = null) {
  const runQuery = getRunner(executor);
  const rotationInsert = await runQuery(
    `INSERT INTO guild_portal_rotations (rotation_key, week_year, week_number, starts_at, ends_at, created_at)
     VALUES (?, ?, ?, ?, ?, NOW())`,
    [weekInfo.rotationKey, weekInfo.weekYear, weekInfo.weekNumber, weekInfo.startsAt, weekInfo.endsAt]
  );
  const rotationId = Number(rotationInsert.insertId);
  let slotIndex = 0;

  for (const [rarity, count] of Object.entries(ROTATION_COMPOSITION)) {
    const units = await getRotationCandidateUnitsByRarity(rarity, count, executor);
    if (units.length < count) {
      throw buildGuildPortalError(
        'INSUFFICIENT_UNITS_FOR_ROTATION',
        `Impossible de générer la rotation: pas assez d'unités ${rarity} (${units.length}/${count}).`
      );
    }
    for (const unit of units) {
      await runQuery(
        `INSERT INTO guild_portal_rotation_units (rotation_id, unit_id, rarity, slot_index)
         VALUES (?, ?, ?, ?)`,
        [rotationId, Number(unit.id), rarity, slotIndex]
      );
      slotIndex += 1;
    }
  }

  const rotationRow = await getRotationById(rotationId, executor);
  const rotationUnits = await getRotationUnits(rotationId, executor);
  return serializeRotationRow(rotationRow, rotationUnits);
}

export async function ensureCurrentGuildPortalRotation() {
  const weekInfo = getCurrentGuildPortalWeekInfo();
  const existing = await getRotationByKey(weekInfo.rotationKey);
  if (existing) {
    return serializeRotationRow(existing, await getRotationUnits(Number(existing.id)));
  }

  try {
    return await withTransaction(async (tx) => {
      const current = await getRotationByKey(weekInfo.rotationKey, tx);
      if (current) {
        return serializeRotationRow(current, await getRotationUnits(Number(current.id), tx));
      }
      return generateGuildPortalRotationForWeek(weekInfo, tx);
    });
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') {
      const concurrent = await getRotationByKey(weekInfo.rotationKey);
      if (concurrent) {
        return serializeRotationRow(concurrent, await getRotationUnits(Number(concurrent.id)));
      }
    }
    throw error;
  }
}

export async function getCurrentGuildPortalRotation() {
  return ensureCurrentGuildPortalRotation();
}

export function rollGuildPortalRarity() {
  return String(rollRarity(STANDARD_PORTAL_WEIGHTS, Math.random)).toLowerCase();
}

export async function getGuildPortalState(userId) {
  const membership = await getGuildMembership(userId);
  if (!membership) {
    throw buildGuildPortalError('NOT_IN_GUILD', "Vous devez être dans une guilde pour accéder au portail.");
  }
  const guildCurrency = await getGuildCurrency(userId);
  const rotation = await getCurrentGuildPortalRotation();
  const ownedRows = await query(
    'SELECT DISTINCT unit_id FROM user_units WHERE user_id = ?',
    [Number(userId)]
  );
  const ownedUnitIds = ownedRows.map((r) => Number(r.unit_id));
  return {
    guild: membership.guild,
    role: membership.role,
    guild_coins: guildCurrency.guild_coins,
    summon_cost: GUILD_PORTAL_SUMMON_COST,
    no_pity: true,
    rotation,
    ownedUnitIds
  };
}

export async function summonFromGuildPortal(userId) {
  const membership = await getGuildMembership(userId);
  if (!membership) {
    throw buildGuildPortalError('NOT_IN_GUILD', "Vous devez être dans une guilde pour accéder au portail.");
  }

  await ensureGuildCurrency(userId);
  const rotation = await ensureCurrentGuildPortalRotation();
  const rotationUnits = Array.isArray(rotation.units) ? rotation.units : [];
  const forceMythic = await hasGuaranteedMythic(userId);
  const rarity = forceMythic ? 'mythic' : rollGuildPortalRarity();
  const rarityPool = rotationUnits.filter((unit) => String(unit.rarity).toLowerCase() === rarity);
  if (rarityPool.length === 0) {
    throw buildGuildPortalError('GUILD_PORTAL_ROTATION_INVALID', 'Aucune unité disponible pour cette rareté dans la rotation active.');
  }

  const pickedUnit = rarityPool[Math.floor(Math.random() * rarityPool.length)];
  let grantMeta = null;

  await withTransaction(async (tx) => {
    if (forceMythic) {
      await tx.query(
        'INSERT INTO user_guaranteed_next_mythic (user_id, used) VALUES (?, 1) ON DUPLICATE KEY UPDATE used = 1',
        [userId]
      );
    }
    const membershipInTx = await getGuildMembership(userId, tx);
    if (!membershipInTx) {
      throw buildGuildPortalError('NOT_IN_GUILD', "Vous devez être dans une guilde pour invoquer.");
    }

    await ensureGuildCurrency(userId, tx);
    const currencyRows = await tx.query(
      'SELECT guild_coins FROM guild_currencies WHERE user_id = ? LIMIT 1',
      [userId]
    );
    const currentCoins = Number(currencyRows[0]?.guild_coins ?? 0);
    if (currentCoins < GUILD_PORTAL_SUMMON_COST) {
      throw buildGuildPortalError('INSUFFICIENT_GUILD_COINS', 'Solde de monnaie de guilde insuffisant.');
    }

    await tx.query(
      'UPDATE guild_currencies SET guild_coins = guild_coins - ?, updated_at = NOW() WHERE user_id = ?',
      [GUILD_PORTAL_SUMMON_COST, userId]
    );
    grantMeta = await grantSummonedUnitToUser(userId, Number(pickedUnit.unit_id), rarity, tx);
    await tx.query(
      `INSERT INTO guild_portal_summons (user_id, guild_id, rotation_id, unit_id, rarity, cost, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [userId, membershipInTx.guild_id, rotation.id, Number(pickedUnit.unit_id), rarity, GUILD_PORTAL_SUMMON_COST]
    );
  });

  const unitRow = await getBasicUnitRow(Number(pickedUnit.unit_id));
  const unit = unitRow ? { ...unitRow, skill_description: getSkillDescriptionForTooltip(unitRow) } : null;
  const guildCurrency = await getGuildCurrency(userId);

  // Notification guilde pour mythic / legendary (silencieuse, non-bloquante)
  if (rarity === 'mythic' || rarity === 'legendary') {
    const notifType = rarity === 'mythic'
      ? GUILD_NOTIFICATION_TYPES.SUMMON_MYTHIC
      : GUILD_NOTIFICATION_TYPES.SUMMON_LEGENDARY;
    void createGuildNotification(membership.guild_id, userId, notifType, {
      unit_name: unitRow?.name ?? unit?.name ?? 'Unité inconnue',
      rarity
    });
  }

  return {
    success: true,
    message: 'Invocation de guilde réussie.',
    rarity,
    unit,
    isNewUnit: !!grantMeta?.isNewUnit,
    duplicateRewards: grantMeta?.duplicateRewards ?? { credits: 0, fragments: 0 },
    guild_coins: guildCurrency.guild_coins,
    summon_cost: GUILD_PORTAL_SUMMON_COST,
    rotation_id: rotation.id,
    no_pity: true
  };
}
