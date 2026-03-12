/**
 * guildWarService.js
 * Service central pour les Guerres de Guilde.
 *
 * Cycle quotidien (heure de Paris) :
 *   00:00 Paris  matchmaking + résolution des guerres de la veille
 *   00:00 → 12:00 Paris  phase préparation
 *   12:00 → 00:00 Paris  phase attaque
 */
import { query, withTransaction } from '../config/db.js';
import { getParisDateKey, getParisHour, getParisMidnightDate, getParisNoonDate, getNextParisMidnight, getNextParisNoon } from '../utils/parisTime.js';
import { addGuildCurrency } from './guildService.js';
import { computeScaledStats } from '../../../core/combatEngine.js';

// ── Constantes ──────────────────────────────────────────────────────────────

const MAX_DEFENSE_SLOTS = 6;
const MAX_DEFENSE_PRESETS = 3;
const MIN_UNITS_PER_DEFENSE = 1;
const MAX_UNITS_PER_DEFENSE = 4;
const MIN_UNITS_PER_ATTACK = 1;
const MAX_UNITS_PER_ATTACK = 4;
const ELO_DEFAULT = 1000;
const ELO_K_FACTOR = 32;

const REWARD_WIN = 100;
const REWARD_LOSS = 50;
const REWARD_DRAW = 75;

function buildWarError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

/**
 * Les timestamps war sont persistés en UTC dans des colonnes DATETIME (sans timezone).
 * On les parse explicitement en UTC pour éviter les dérives locales / DST.
 */
function parseSqlUtcDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const s = String(value).trim();
  if (!s) return null;
  // "YYYY-MM-DD HH:mm:ss" -> "YYYY-MM-DDTHH:mm:ssZ"
  if (!s.includes('T')) return new Date(`${s.replace(' ', 'T')}Z`);
  if (!/[zZ]|[+\-]\d{2}:?\d{2}$/.test(s)) return new Date(`${s}Z`);
  return new Date(s);
}

// ── Elo de guilde ────────────────────────────────────────────────────────────

export async function getOrCreateGuildElo(guildId) {
  const rows = await query('SELECT * FROM guild_elo WHERE guild_id = ? LIMIT 1', [Number(guildId)]);
  if (rows.length) return rows[0];
  await query(
    'INSERT IGNORE INTO guild_elo (guild_id, elo) VALUES (?, ?)',
    [Number(guildId), ELO_DEFAULT]
  );
  return { guild_id: Number(guildId), elo: ELO_DEFAULT, wins: 0, losses: 0, draws: 0 };
}

function computeGuildEloChange(eloA, eloB, scoreA) {
  const expected = 1 / (1 + 10 ** ((eloB - eloA) / 400));
  const deltaA = Math.round(ELO_K_FACTOR * (scoreA - expected));
  return { deltaA, deltaB: -deltaA };
}

export async function updateGuildEloAfterWar(guildAId, guildBId, winnerGuildId) {
  const [eloA, eloB] = await Promise.all([
    getOrCreateGuildElo(guildAId),
    getOrCreateGuildElo(guildBId)
  ]);

  let scoreA;
  if (winnerGuildId === null) {
    scoreA = 0.5; // draw
  } else if (Number(winnerGuildId) === Number(guildAId)) {
    scoreA = 1;
  } else {
    scoreA = 0;
  }

  const { deltaA, deltaB } = computeGuildEloChange(eloA.elo, eloB.elo, scoreA);
  const newEloA = Math.max(0, eloA.elo + deltaA);
  const newEloB = Math.max(0, eloB.elo + deltaB);

  const isDraw = winnerGuildId === null;
  const aWon = !isDraw && Number(winnerGuildId) === Number(guildAId);

  await query(
    `UPDATE guild_elo
     SET elo = ?, wins = wins + ?, losses = losses + ?, draws = draws + ?
     WHERE guild_id = ?`,
    [newEloA, aWon ? 1 : 0, aWon ? 0 : (isDraw ? 0 : 1), isDraw ? 1 : 0, guildAId]
  );
  await query(
    `UPDATE guild_elo
     SET elo = ?, wins = wins + ?, losses = losses + ?, draws = draws + ?
     WHERE guild_id = ?`,
    [newEloB, aWon ? 0 : (isDraw ? 0 : 1), aWon ? 1 : 0, isDraw ? 1 : 0, guildBId]
  );
}

// ── Guerre courante ──────────────────────────────────────────────────────────

/**
 * Retourne la guerre active (preparation ou attack) pour un utilisateur.
 */
export async function getCurrentWarForUser(userId) {
  const membership = await query(
    'SELECT guild_id FROM guild_members WHERE user_id = ? LIMIT 1',
    [Number(userId)]
  );
  if (!membership.length) return null;
  const guildId = Number(membership[0].guild_id);
  return getCurrentWarForGuild(guildId);
}

export async function getCurrentWarForGuild(guildId) {
  const rows = await query(
    `SELECT w.*,
            ga.name AS guild_a_name, gb.name AS guild_b_name
     FROM guild_wars w
     JOIN guilds ga ON ga.id = w.guild_a_id
     JOIN guilds gb ON gb.id = w.guild_b_id
     WHERE (w.guild_a_id = ? OR w.guild_b_id = ?)
       AND w.status != 'finished'
     ORDER BY w.id DESC
     LIMIT 1`,
    [Number(guildId), Number(guildId)]
  );
  if (!rows.length) return null;
  return normalizeWar(rows[0]);
}

export async function getWarById(warId) {
  const rows = await query(
    `SELECT w.*,
            ga.name AS guild_a_name, gb.name AS guild_b_name
     FROM guild_wars w
     JOIN guilds ga ON ga.id = w.guild_a_id
     JOIN guilds gb ON gb.id = w.guild_b_id
     WHERE w.id = ?`,
    [Number(warId)]
  );
  return rows.length ? normalizeWar(rows[0]) : null;
}

function normalizeWar(row) {
  const now = new Date();
  const startTime = parseSqlUtcDate(row.start_time);
  const attackStart = parseSqlUtcDate(row.attack_phase_start);
  const endTime = parseSqlUtcDate(row.end_time);

  let status = String(row.status);
  if (status !== 'finished') {
    if (endTime && now >= endTime) status = 'finished';
    else if (attackStart && now >= attackStart) status = 'attack';
    else status = 'preparation';
  }

  return {
    id: Number(row.id),
    guild_a_id: Number(row.guild_a_id),
    guild_b_id: Number(row.guild_b_id),
    guild_a_name: row.guild_a_name,
    guild_b_name: row.guild_b_name,
    start_time: startTime ? startTime.toISOString() : row.start_time,
    attack_phase_start: attackStart ? attackStart.toISOString() : row.attack_phase_start,
    end_time: endTime ? endTime.toISOString() : row.end_time,
    guild_a_score: Number(row.guild_a_score ?? 0),
    guild_b_score: Number(row.guild_b_score ?? 0),
    status,
    winner_guild_id: row.winner_guild_id ? Number(row.winner_guild_id) : null,
    created_at: parseSqlUtcDate(row.created_at)?.toISOString?.() ?? row.created_at
  };
}

// ── Défenses ─────────────────────────────────────────────────────────────────

export async function getWarDefenses(warId) {
  const rows = await query(
    `SELECT d.*, u.display_name AS defender_name
     FROM guild_war_defenses d
     LEFT JOIN users u ON u.id = d.defender_user_id
     WHERE d.war_id = ?
     ORDER BY d.guild_id, d.slot_index`,
    [Number(warId)]
  );
  const unitIds = new Set();
  for (const r of rows) {
    const units = typeof r.units_json === 'string' ? JSON.parse(r.units_json || '[]') : (r.units_json ?? []);
    for (const u of units) {
      if (u?.user_unit_id) unitIds.add(Number(u.user_unit_id));
    }
  }
  const unitMetaByUserUnitId = new Map();
  if (unitIds.size > 0) {
    const placeholders = [...unitIds].map(() => '?').join(',');
    const metaRows = await query(
      `SELECT uu.id AS user_unit_id, u.name AS unit_name, uu.level, uu.specialization, uu.power_level,
              u.base_hp, u.base_attack, u.base_defense, u.base_speed, u.mastery
       FROM user_units uu
       JOIN units u ON u.id = uu.unit_id
       WHERE uu.id IN (${placeholders})`,
      [...unitIds]
    );
    for (const m of metaRows) {
      const level = Number(m.level ?? 1);
      const specializationRaw = m.specialization == null ? null : String(m.specialization).trim().toUpperCase();
      const specialization = specializationRaw === 'A' || specializationRaw === 'B' ? specializationRaw : null;
      const powerLevel = Number(m.power_level ?? 1);
      const stats = computeScaledStats(
        {
          base_hp: Number(m.base_hp ?? 0),
          base_attack: Number(m.base_attack ?? 0),
          base_defense: Number(m.base_defense ?? 0),
          base_speed: Number(m.base_speed ?? 0),
          mastery: Number(m.mastery ?? 0)
        },
        { level, specialization, power_level: powerLevel }
      );
      unitMetaByUserUnitId.set(Number(m.user_unit_id), {
        name: m.unit_name ?? '?',
        level,
        specialization,
        power_level: powerLevel,
        stats: {
          maxHp: Number(stats.maxHp ?? 0),
          attack: Number(stats.attack ?? 0),
          defense: Number(stats.defense ?? 0),
          speed: Number(stats.speed ?? 0),
          mastery: Number(stats.mastery ?? 0)
        }
      });
    }
  }
  return rows.map((r) => {
    const rawUnits = typeof r.units_json === 'string' ? JSON.parse(r.units_json || '[]') : (r.units_json ?? []);
    const units_json = rawUnits.map((u) => {
      const meta = u?.user_unit_id ? unitMetaByUserUnitId.get(Number(u.user_unit_id)) : null;
      return {
        ...u,
        name: meta?.name ?? u?.name ?? '?',
        level: meta?.level ?? u?.level ?? 1,
        specialization: meta?.specialization ?? (u?.specialization ?? null),
        power_level: meta?.power_level ?? (u?.power_level ?? 1),
        stats: meta?.stats ?? (u?.stats ?? null)
      };
    });
    return {
      id: Number(r.id),
      war_id: Number(r.war_id),
      guild_id: Number(r.guild_id),
      slot_index: Number(r.slot_index),
      defender_user_id: r.defender_user_id ? Number(r.defender_user_id) : null,
      defender_name: r.defender_name ?? null,
      units_json,
      is_destroyed: Boolean(r.is_destroyed),
      destroyed_at: r.destroyed_at ?? null,
      preset_id: r.preset_id ? Number(r.preset_id) : null
    };
  });
}

/**
 * Placer ou mettre à jour une défense (leader/officer uniquement, phase prep).
 */
export async function placeDefense(actorUserId, warId, slotIndex, defenderUserId, units) {
  const war = await getWarById(warId);
  if (!war) throw buildWarError('WAR_NOT_FOUND', 'Guerre introuvable.');
  if (war.status !== 'preparation') {
    throw buildWarError('WRONG_PHASE', 'Les défenses ne peuvent être placées que pendant la phase de préparation.');
  }

  // Vérifier permissions
  const membership = await query(
    `SELECT gm.guild_id, gm.role
     FROM guild_members gm
     WHERE gm.user_id = ?
     LIMIT 1`,
    [Number(actorUserId)]
  );
  if (!membership.length) throw buildWarError('NOT_IN_GUILD', "Vous n'êtes dans aucune guilde.");
  const { guild_id: guildId, role } = membership[0];
  if (role !== 'leader' && role !== 'officer') {
    throw buildWarError('INSUFFICIENT_PERMISSIONS', 'Seuls le leader et les officers peuvent placer les défenses.');
  }
  if (Number(guildId) !== Number(war.guild_a_id) && Number(guildId) !== Number(war.guild_b_id)) {
    throw buildWarError('NOT_IN_WAR', "Votre guilde ne participe pas à cette guerre.");
  }

  const slot = Number(slotIndex);
  if (!Number.isInteger(slot) || slot < 1 || slot > MAX_DEFENSE_SLOTS) {
    throw buildWarError('INVALID_SLOT', `Le slot doit être entre 1 et ${MAX_DEFENSE_SLOTS}.`);
  }

  // Valider les unités (1-4, appartiennent bien au defenderUser)
  if (!Array.isArray(units) || units.length < MIN_UNITS_PER_DEFENSE || units.length > MAX_UNITS_PER_DEFENSE) {
    throw buildWarError('INVALID_UNITS', `Une défense doit contenir entre ${MIN_UNITS_PER_DEFENSE} et ${MAX_UNITS_PER_DEFENSE} unités.`);
  }

  // Vérifier que defenderUser est dans la même guilde
  const defMembership = await query(
    'SELECT guild_id FROM guild_members WHERE user_id = ? LIMIT 1',
    [Number(defenderUserId)]
  );
  if (!defMembership.length || Number(defMembership[0].guild_id) !== Number(guildId)) {
    throw buildWarError('INVALID_DEFENDER', 'Le défenseur doit être membre de votre guilde.');
  }

  // Vérifier que les unités appartiennent au defenderUser et récupérer archetype
  const unitIds = units.map((u) => Number(u.user_unit_id));
  const placeholders = unitIds.map(() => '?').join(',');
  const ownedRows = await query(
    `SELECT uu.id, u.archetype
     FROM user_units uu
     JOIN units u ON u.id = uu.unit_id
     WHERE uu.id IN (${placeholders}) AND uu.user_id = ?`,
    [...unitIds, Number(defenderUserId)]
  );
  if (ownedRows.length !== unitIds.length) {
    throw buildWarError('UNIT_NOT_OWNED', 'Certaines unités n\'appartiennent pas au défenseur.');
  }

  const archetypeByUnitId = Object.fromEntries(ownedRows.map((r) => [Number(r.id), String(r.archetype || '')]));
  let cacCount = 0;
  let distCount = 0;
  for (const u of units) {
    const id = Number(u.user_unit_id);
    const pos = String(u.position || 'front').toLowerCase();
    const arch = (archetypeByUnitId[id] || '').toUpperCase();
    const isCac = arch === 'CAC_TANK' || arch === 'CAC_DPS';
    const isDist = arch.startsWith('DISTANCE');
    if (pos === 'front') {
      if (!isCac) {
        throw buildWarError('INVALID_POSITION', `Seules les unités CAC peuvent être en front. (Unité ${id} : ${arch})`);
      }
      cacCount += 1;
    } else {
      if (!isDist) {
        throw buildWarError('INVALID_POSITION', `Seules les unités Distance peuvent être en back. (Unité ${id} : ${arch})`);
      }
      distCount += 1;
    }
  }
  if (cacCount > 3 || distCount > 3) {
    throw buildWarError('INVALID_UNITS', 'Maximum 3 unités CAC et 3 unités Distance.');
  }

  // Vérifier qu'aucune unité n'est déjà placée dans une autre défense
  const existingDefenses = await getWarDefenses(warId);
  const usedInOtherSlots = new Set();
  for (const d of existingDefenses) {
    if (d.guild_id !== guildId) continue;
    if (d.slot_index === slot) continue;
    for (const u of d.units_json || []) {
      if (u.user_unit_id) usedInOtherSlots.add(Number(u.user_unit_id));
    }
  }
  const alreadyUsed = unitIds.filter((id) => usedInOtherSlots.has(id));
  if (alreadyUsed.length > 0) {
    throw buildWarError('UNITS_IN_OTHER_DEFENSE', 'Certaines unités sont déjà placées dans une autre défense.');
  }

  await query(
    `INSERT INTO guild_war_defenses (war_id, guild_id, slot_index, defender_user_id, units_json, is_destroyed)
     VALUES (?, ?, ?, ?, ?, 0)
     ON DUPLICATE KEY UPDATE
       defender_user_id = VALUES(defender_user_id),
       units_json = VALUES(units_json),
       is_destroyed = 0,
       destroyed_at = NULL`,
    [warId, guildId, slot, Number(defenderUserId), JSON.stringify(units)]
  );

  return { success: true };
}

/**
 * Placer une défense à partir d'un preset (leader/officer uniquement).
 * presetId = null pour vider le slot.
 */
export async function placeDefenseFromPreset(actorUserId, warId, slotIndex, presetId) {
  const war = await getWarById(warId);
  if (!war) throw buildWarError('WAR_NOT_FOUND', 'Guerre introuvable.');
  if (war.status !== 'preparation') {
    throw buildWarError('WRONG_PHASE', 'Les défenses ne peuvent être placées que pendant la phase de préparation.');
  }

  const membership = await query(
    `SELECT gm.guild_id, gm.role FROM guild_members gm WHERE gm.user_id = ? LIMIT 1`,
    [Number(actorUserId)]
  );
  if (!membership.length) throw buildWarError('NOT_IN_GUILD', "Vous n'êtes dans aucune guilde.");
  const { guild_id: guildId, role } = membership[0];
  if (role !== 'leader' && role !== 'officer') {
    throw buildWarError('INSUFFICIENT_PERMISSIONS', 'Seuls le leader et les officers peuvent placer les défenses.');
  }
  if (Number(guildId) !== Number(war.guild_a_id) && Number(guildId) !== Number(war.guild_b_id)) {
    throw buildWarError('NOT_IN_WAR', "Votre guilde ne participe pas à cette guerre.");
  }

  const slot = Number(slotIndex);
  if (!Number.isInteger(slot) || slot < 1 || slot > MAX_DEFENSE_SLOTS) {
    throw buildWarError('INVALID_SLOT', `Le slot doit être entre 1 et ${MAX_DEFENSE_SLOTS}.`);
  }

  if (!presetId) {
    await query(
      'DELETE FROM guild_war_defenses WHERE war_id = ? AND guild_id = ? AND slot_index = ?',
      [warId, guildId, slot]
    );
    return { success: true };
  }

  const presetRows = await query(
    `SELECT p.id, p.user_id, p.units_json FROM guild_defense_presets p
     WHERE p.id = ? AND p.guild_id = ? LIMIT 1`,
    [Number(presetId), guildId]
  );
  if (!presetRows.length) {
    throw buildWarError('PRESET_NOT_FOUND', 'Ce preset n\'existe pas ou n\'appartient pas à votre guilde.');
  }

  const preset = presetRows[0];
  const units = typeof preset.units_json === 'string' ? JSON.parse(preset.units_json || '[]') : (preset.units_json ?? []);
  if (!Array.isArray(units) || units.length < MIN_UNITS_PER_DEFENSE || units.length > MAX_UNITS_PER_DEFENSE) {
    throw buildWarError('INVALID_UNITS', `Ce preset est invalide (entre ${MIN_UNITS_PER_DEFENSE} et ${MAX_UNITS_PER_DEFENSE} unités).`);
  }

  // Vérifier que le preset n'est pas déjà utilisé dans un autre slot
  const existingRows = await query(
    'SELECT slot_index FROM guild_war_defenses WHERE war_id = ? AND guild_id = ? AND preset_id = ?',
    [warId, guildId, Number(presetId)]
  );
  const usedInSlot = existingRows.find((r) => Number(r.slot_index) !== slot);
  if (usedInSlot) {
    throw buildWarError('PRESET_ALREADY_USED', 'Cette défense est déjà placée dans un autre emplacement.');
  }

  await query(
    `INSERT INTO guild_war_defenses (war_id, guild_id, slot_index, defender_user_id, units_json, is_destroyed, preset_id)
     VALUES (?, ?, ?, ?, ?, 0, ?)
     ON DUPLICATE KEY UPDATE
       defender_user_id = VALUES(defender_user_id),
       units_json = VALUES(units_json),
       is_destroyed = 0,
       destroyed_at = NULL,
       preset_id = VALUES(preset_id)`,
    [warId, guildId, slot, Number(preset.user_id), JSON.stringify(units), Number(presetId)]
  );

  return { success: true };
}

// ── Presets de défense ────────────────────────────────────────────────────────

/** Tous les presets de la guilde (tous les membres) — pour leader/officer */
export async function getGuildDefensePresets(guildId) {
  const rows = await query(
    `SELECT p.id, p.user_id, p.name, p.units_json, p.created_at, u.display_name AS creator_name
     FROM guild_defense_presets p
     JOIN users u ON u.id = p.user_id
     WHERE p.guild_id = ?
     ORDER BY u.display_name ASC, p.name ASC`,
    [Number(guildId)]
  );
  return rows.map((r) => ({
    id: Number(r.id),
    user_id: Number(r.user_id),
    name: r.name,
    units_json: typeof r.units_json === 'string' ? JSON.parse(r.units_json || '[]') : (r.units_json ?? []),
    created_at: r.created_at,
    creator_name: r.creator_name ?? 'Joueur'
  }));
}

export async function getMyDefensePresets(userId) {
  const membership = await query(
    'SELECT guild_id FROM guild_members WHERE user_id = ? LIMIT 1',
    [Number(userId)]
  );
  if (!membership.length) return [];

  const rows = await query(
    'SELECT id, name, units_json, created_at FROM guild_defense_presets WHERE user_id = ? AND guild_id = ? ORDER BY id ASC',
    [Number(userId), Number(membership[0].guild_id)]
  );
  return rows.map((r) => ({
    id: Number(r.id),
    name: r.name,
    units_json: typeof r.units_json === 'string' ? JSON.parse(r.units_json || '[]') : (r.units_json ?? []),
    created_at: r.created_at
  }));
}

export async function saveDefensePreset(userId, name, units) {
  const membership = await query(
    'SELECT guild_id FROM guild_members WHERE user_id = ? LIMIT 1',
    [Number(userId)]
  );
  if (!membership.length) throw buildWarError('NOT_IN_GUILD', "Vous n'êtes dans aucune guilde.");
  const guildId = Number(membership[0].guild_id);

  if (!Array.isArray(units) || units.length < MIN_UNITS_PER_DEFENSE || units.length > MAX_UNITS_PER_DEFENSE) {
    throw buildWarError('INVALID_UNITS', `Un preset de défense doit contenir entre ${MIN_UNITS_PER_DEFENSE} et ${MAX_UNITS_PER_DEFENSE} unités.`);
  }

  // Vérifier appartenance des unités et contraintes CAC/Distance
  const unitIds = units.map((u) => Number(u.user_unit_id));
  const placeholders = unitIds.map(() => '?').join(',');
  const ownedRows = await query(
    `SELECT uu.id, u.archetype
     FROM user_units uu JOIN units u ON u.id = uu.unit_id
     WHERE uu.id IN (${placeholders}) AND uu.user_id = ?`,
    [...unitIds, Number(userId)]
  );
  if (ownedRows.length !== unitIds.length) {
    throw buildWarError('UNIT_NOT_OWNED', "Certaines unités ne vous appartiennent pas.");
  }
  const archByUnitId = Object.fromEntries(ownedRows.map((r) => [Number(r.id), String(r.archetype || '')]));
  let cacCount = 0, distCount = 0;
  for (const u of units) {
    const id = Number(u.user_unit_id);
    const pos = String(u.position || 'front').toLowerCase();
    const arch = (archByUnitId[id] || '').toUpperCase();
    const isCac = arch === 'CAC_TANK' || arch === 'CAC_DPS';
    const isDist = arch.startsWith('DISTANCE');
    if (pos === 'front') {
      if (!isCac) throw buildWarError('INVALID_POSITION', 'Seules les unités CAC peuvent être en front.');
      cacCount += 1;
    } else {
      if (!isDist) throw buildWarError('INVALID_POSITION', 'Seules les unités Distance peuvent être en back.');
      distCount += 1;
    }
  }
  if (cacCount > 3 || distCount > 3) {
    throw buildWarError('INVALID_UNITS', 'Maximum 3 unités CAC et 3 unités Distance.');
  }

  // Compter les presets existants
  const countRows = await query(
    'SELECT COUNT(*) AS cnt FROM guild_defense_presets WHERE user_id = ?',
    [Number(userId)]
  );
  const count = Number(countRows[0]?.cnt ?? 0);
  if (count >= MAX_DEFENSE_PRESETS) {
    throw buildWarError('MAX_PRESETS', `Vous ne pouvez avoir que ${MAX_DEFENSE_PRESETS} presets de défense.`);
  }

  const result = await query(
    'INSERT INTO guild_defense_presets (user_id, guild_id, name, units_json) VALUES (?, ?, ?, ?)',
    [Number(userId), guildId, String(name || 'Défense').substring(0, 50), JSON.stringify(units)]
  );
  return { id: Number(result.insertId), name, units_json: units };
}

export async function updateDefensePreset(userId, presetId, name, units) {
  const rows = await query(
    'SELECT id FROM guild_defense_presets WHERE id = ? AND user_id = ? LIMIT 1',
    [Number(presetId), Number(userId)]
  );
  if (!rows.length) throw buildWarError('PRESET_NOT_FOUND', 'Preset introuvable.');

  if (units !== undefined) {
    if (!Array.isArray(units) || units.length < MIN_UNITS_PER_DEFENSE || units.length > MAX_UNITS_PER_DEFENSE) {
      throw buildWarError('INVALID_UNITS', `Un preset de défense doit contenir entre ${MIN_UNITS_PER_DEFENSE} et ${MAX_UNITS_PER_DEFENSE} unités.`);
    }
    const unitIds = units.map((u) => Number(u.user_unit_id));
    const placeholders = unitIds.map(() => '?').join(',');
    const ownedRows = await query(
      `SELECT uu.id, u.archetype
       FROM user_units uu JOIN units u ON u.id = uu.unit_id
       WHERE uu.id IN (${placeholders}) AND uu.user_id = ?`,
      [...unitIds, Number(userId)]
    );
    if (ownedRows.length !== unitIds.length) {
      throw buildWarError('UNIT_NOT_OWNED', "Certaines unités ne vous appartiennent pas.");
    }
    const archByUnitId = Object.fromEntries(ownedRows.map((r) => [Number(r.id), String(r.archetype || '')]));
    let cacCount = 0, distCount = 0;
    for (const u of units) {
      const id = Number(u.user_unit_id);
      const pos = String(u.position || 'front').toLowerCase();
      const arch = (archByUnitId[id] || '').toUpperCase();
      const isCac = arch === 'CAC_TANK' || arch === 'CAC_DPS';
      const isDist = arch.startsWith('DISTANCE');
      if (pos === 'front') {
        if (!isCac) throw buildWarError('INVALID_POSITION', 'Seules les unités CAC peuvent être en front.');
        cacCount += 1;
      } else {
        if (!isDist) throw buildWarError('INVALID_POSITION', 'Seules les unités Distance peuvent être en back.');
        distCount += 1;
      }
    }
    if (cacCount > 3 || distCount > 3) {
      throw buildWarError('INVALID_UNITS', 'Maximum 3 unités CAC et 3 unités Distance.');
    }
  }

  const updates = [];
  const params = [];
  if (name !== undefined) { updates.push('name = ?'); params.push(String(name).substring(0, 50)); }
  if (units !== undefined) { updates.push('units_json = ?'); params.push(JSON.stringify(units)); }
  if (!updates.length) return;
  params.push(Number(presetId));
  await query(`UPDATE guild_defense_presets SET ${updates.join(', ')} WHERE id = ?`, params);
}

export async function deleteDefensePreset(userId, presetId) {
  await query(
    'DELETE FROM guild_defense_presets WHERE id = ? AND user_id = ?',
    [Number(presetId), Number(userId)]
  );
}

// ── Unités utilisées ──────────────────────────────────────────────────────────

export async function getUsedUnitIds(warId, userId) {
  const rows = await query(
    'SELECT user_unit_id FROM guild_war_used_units WHERE war_id = ? AND user_id = ?',
    [Number(warId), Number(userId)]
  );
  return rows.map((r) => Number(r.user_unit_id));
}

export async function markUnitsUsed(warId, userId, userUnitIds) {
  if (!userUnitIds.length) return;
  const values = userUnitIds.map(() => '(?, ?, ?)').join(',');
  const params = userUnitIds.flatMap((id) => [Number(warId), Number(userId), Number(id)]);
  await query(
    `INSERT IGNORE INTO guild_war_used_units (war_id, user_id, user_unit_id) VALUES ${values}`,
    params
  );
}

// ── Attaque ────────────────────────────────────────────────────────────────────

/**
 * Prépare les données pour un combat de guerre de guilde.
 * Retourne les slots attaquant et défenseur pour que la route construise le combat.
 */
export async function prepareWarAttack(attackerUserId, warId, targetSlotIndex, attackerUnits) {
  const war = await getWarById(warId);
  if (!war) throw buildWarError('WAR_NOT_FOUND', 'Guerre introuvable.');
  if (war.status !== 'attack') {
    throw buildWarError('WRONG_PHASE', "Les attaques ne sont permises que pendant la phase d'attaque.");
  }

  // Vérifier que l'attaquant est dans la bonne guilde
  const membership = await query(
    'SELECT guild_id FROM guild_members WHERE user_id = ? LIMIT 1',
    [Number(attackerUserId)]
  );
  if (!membership.length) throw buildWarError('NOT_IN_GUILD', "Vous n'êtes dans aucune guilde.");
  const attackerGuildId = Number(membership[0].guild_id);

  if (attackerGuildId !== war.guild_a_id && attackerGuildId !== war.guild_b_id) {
    throw buildWarError('NOT_IN_WAR', "Votre guilde ne participe pas à cette guerre.");
  }

  // La cible doit être la guilde adverse
  const targetGuildId = attackerGuildId === war.guild_a_id ? war.guild_b_id : war.guild_a_id;

  const slot = Number(targetSlotIndex);
  if (!Number.isInteger(slot) || slot < 1 || slot > MAX_DEFENSE_SLOTS) {
    throw buildWarError('INVALID_SLOT', `Slot invalide.`);
  }

  // Vérifier l'état du slot cible
  const defRows = await query(
    'SELECT * FROM guild_war_defenses WHERE war_id = ? AND guild_id = ? AND slot_index = ? LIMIT 1',
    [warId, targetGuildId, slot]
  );

  if (!defRows.length) throw buildWarError('DEFENSE_EMPTY', "Ce slot de défense est vide.");
  const defense = defRows[0];
  if (defense.is_destroyed) throw buildWarError('ALREADY_DESTROYED', "Cette défense est déjà détruite.");

  // Vérifier que les unités attaquantes sont entre 1 et 4
  if (!Array.isArray(attackerUnits) || attackerUnits.length < MIN_UNITS_PER_ATTACK || attackerUnits.length > MAX_UNITS_PER_ATTACK) {
    throw buildWarError('INVALID_UNITS', `Vous devez sélectionner entre ${MIN_UNITS_PER_ATTACK} et ${MAX_UNITS_PER_ATTACK} unités pour attaquer.`);
  }

  const attackerUnitIds = attackerUnits.map((u) => Number(u.user_unit_id));
  const usedIds = await getUsedUnitIds(warId, attackerUserId);
  const alreadyUsed = attackerUnitIds.filter((id) => usedIds.includes(id));
  if (alreadyUsed.length > 0) {
    throw buildWarError('UNITS_ALREADY_USED', `Certaines unités ont déjà été utilisées dans cette guerre.`);
  }

  // Vérifier appartenance et contraintes CAC/Distance des unités attaquantes
  const placeholders = attackerUnitIds.map(() => '?').join(',');
  const ownedRows = await query(
    `SELECT uu.id, u.archetype
     FROM user_units uu
     JOIN units u ON u.id = uu.unit_id
     WHERE uu.id IN (${placeholders}) AND uu.user_id = ?`,
    [...attackerUnitIds, Number(attackerUserId)]
  );
  if (ownedRows.length !== attackerUnitIds.length) {
    throw buildWarError('UNIT_NOT_OWNED', "Certaines unités ne vous appartiennent pas.");
  }

  const archByUnitId = Object.fromEntries(ownedRows.map((r) => [Number(r.id), String(r.archetype || '')]));
  let attCacCount = 0;
  let attDistCount = 0;
  for (const u of attackerUnits) {
    const id = Number(u.user_unit_id);
    const pos = String(u.position || 'front').toLowerCase();
    const arch = (archByUnitId[id] || '').toUpperCase();
    const isCac = arch === 'CAC_TANK' || arch === 'CAC_DPS';
    const isDist = arch.startsWith('DISTANCE');
    if (pos === 'front') {
      if (!isCac) throw buildWarError('INVALID_POSITION', 'Seules les unités CAC peuvent être en front.');
      attCacCount += 1;
    } else {
      if (!isDist) throw buildWarError('INVALID_POSITION', 'Seules les unités Distance peuvent être en back.');
      attDistCount += 1;
    }
  }
  if (attCacCount > 3 || attDistCount > 3) {
    throw buildWarError('INVALID_UNITS', 'Maximum 3 unités CAC et 3 unités Distance.');
  }

  const defenderUnits = typeof defense.units_json === 'string'
    ? JSON.parse(defense.units_json || '[]')
    : (defense.units_json ?? []);
  const defenderUserId = defense.defender_user_id ? Number(defense.defender_user_id) : null;

  return {
    war,
    attackerGuildId,
    targetGuildId,
    targetSlotIndex: slot,
    defenseId: Number(defense.id),
    defenderUserId,
    attackerSlots: attackerUnits,
    defenderSlots: defenderUnits
  };
}

/**
 * Finalise une attaque de guerre (appelé depuis battle.js après résolution).
 */
export async function finalizeWarAttack(warId, attackerUserId, attackerGuildId, targetSlotIndex, targetGuildId, attackerUnitIds, attackerWon) {
  await withTransaction(async (tx) => {
    // Marquer les unités comme utilisées
    if (attackerUnitIds.length > 0) {
      const values = attackerUnitIds.map(() => '(?, ?, ?)').join(',');
      const params = attackerUnitIds.flatMap((id) => [Number(warId), Number(attackerUserId), Number(id)]);
      await tx.query(
        `INSERT IGNORE INTO guild_war_used_units (war_id, user_id, user_unit_id) VALUES ${values}`,
        params
      );
    }

    // Si victoire : détruire la défense + ajouter 1 point
    if (attackerWon) {
      await tx.query(
        `UPDATE guild_war_defenses
         SET is_destroyed = 1, destroyed_at = NOW()
         WHERE war_id = ? AND guild_id = ? AND slot_index = ?`,
        [warId, targetGuildId, targetSlotIndex]
      );

      // Incrémenter le score
      const war = await getWarById(warId);
      if (war) {
        const scoreField = attackerGuildId === war.guild_a_id ? 'guild_a_score' : 'guild_b_score';
        await tx.query(
          `UPDATE guild_wars SET ${scoreField} = ${scoreField} + 1 WHERE id = ?`,
          [warId]
        );
      }

      // Notification
      await tx.query(
        `INSERT INTO guild_war_notifications (war_id, guild_id, type, data)
         VALUES (?, ?, 'defense_destroyed', ?)`,
        [warId, targetGuildId, JSON.stringify({ slot_index: targetSlotIndex })]
      );
    }

    // Log
    const usernameRows = await tx.query('SELECT display_name FROM users WHERE id = ? LIMIT 1', [attackerUserId]);
    const username = usernameRows[0]?.display_name ?? 'Joueur';
    await tx.query(
      `INSERT INTO guild_war_logs (war_id, attacker_user_id, attacker_username, attacker_guild_id, target_slot_index, target_guild_id, result)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [warId, attackerUserId, username, attackerGuildId, targetSlotIndex, targetGuildId, attackerWon ? 'win' : 'loss']
    );
  });
}

// ── Logs ──────────────────────────────────────────────────────────────────────

export async function getWarLogs(warId) {
  const rows = await query(
    `SELECT l.*, u.display_name AS username
     FROM guild_war_logs l
     LEFT JOIN users u ON u.id = l.attacker_user_id
     WHERE l.war_id = ?
     ORDER BY l.created_at DESC, l.id DESC
     LIMIT 100`,
    [Number(warId)]
  );
  return rows.map((r) => ({
    id: Number(r.id),
    attacker_username: r.attacker_username ?? r.username ?? 'Joueur',
    attacker_guild_id: Number(r.attacker_guild_id),
    target_slot_index: Number(r.target_slot_index),
    target_guild_id: Number(r.target_guild_id),
    result: r.result,
    created_at: r.created_at
  }));
}

export async function getWarNotifications(warId, guildId) {
  const rows = await query(
    `SELECT id, type, data, created_at
     FROM guild_war_notifications
     WHERE war_id = ? AND guild_id = ?
     ORDER BY created_at DESC
     LIMIT 50`,
    [Number(warId), Number(guildId)]
  );
  return rows.map((r) => ({
    id: Number(r.id),
    type: r.type,
    data: typeof r.data === 'string' ? JSON.parse(r.data || '{}') : (r.data ?? {}),
    created_at: r.created_at
  }));
}

// ── Matchmaking ─────────────────────────────────────────────────────────────

/**
 * Lance le matchmaking quotidien : apparie les guildes par Elo.
 * Crée les guerres pour la journée suivante.
 */
export async function runDailyMatchmaking() {
  // Récupérer toutes les guildes qui ont au moins 1 membre
  const guilds = await query(
    `SELECT g.id, COALESCE(e.elo, ?) AS elo,
            (SELECT id FROM guild_wars
             WHERE (guild_a_id = g.id OR guild_b_id = g.id)
               AND status != 'finished'
             LIMIT 1) AS active_war_id,
            (SELECT IF(guild_a_id = g.id, guild_b_id, guild_a_id)
             FROM guild_wars
             WHERE (guild_a_id = g.id OR guild_b_id = g.id)
             ORDER BY id DESC LIMIT 1) AS last_opponent_id
     FROM guilds g
     LEFT JOIN guild_elo e ON e.guild_id = g.id
     WHERE EXISTS (SELECT 1 FROM guild_members gm WHERE gm.guild_id = g.id)`,
    [ELO_DEFAULT]
  );

  // Ignorer les guildes déjà en guerre
  const available = guilds.filter((g) => !g.active_war_id);

  if (available.length < 2) return { matched: 0 };

  // Trier par Elo
  available.sort((a, b) => a.elo - b.elo);

  const used = new Set();
  const pairs = [];

  for (let i = 0; i < available.length; i++) {
    if (used.has(available[i].id)) continue;
    for (let j = i + 1; j < available.length; j++) {
      if (used.has(available[j].id)) continue;

      // Éviter même adversaire que hier (sauf si pas d'autre choix)
      const lastOpp = available[i].last_opponent_id;
      if (lastOpp && Number(lastOpp) === Number(available[j].id) && available.length - used.size > 2) {
        continue;
      }

      pairs.push([available[i].id, available[j].id]);
      used.add(available[i].id);
      used.add(available[j].id);
      break;
    }
  }

  // Créer les guerres (heure de Paris : minuit, midi, minuit suivant)
  const now = new Date();
  const startTime = getParisMidnightDate(now);
  const attackStart = getParisNoonDate(now);
  const endTime = getParisMidnightDate(new Date(now.getTime() + 24 * 60 * 60 * 1000));

  const toMysql = (d) => d.toISOString().slice(0, 19).replace('T', ' ');

  for (const [gA, gB] of pairs) {
    // S'assurer que guild_elo existe pour les deux guildes
    await getOrCreateGuildElo(gA);
    await getOrCreateGuildElo(gB);

    await query(
      `INSERT INTO guild_wars (guild_a_id, guild_b_id, start_time, attack_phase_start, end_time, status)
       VALUES (?, ?, ?, ?, ?, 'preparation')`,
      [gA, gB, toMysql(startTime), toMysql(attackStart), toMysql(endTime)]
    );
  }

  return { matched: pairs.length };
}

// ── Résolution des guerres ───────────────────────────────────────────────────

/**
 * Résout toutes les guerres dont end_time <= NOW() et status != 'finished'.
 */
export async function resolveFinishedWars() {
  const wars = await query(
    `SELECT * FROM guild_wars
     WHERE status != 'finished' AND end_time <= UTC_TIMESTAMP()`,
    []
  );

  let resolved = 0;
  for (const warRow of wars) {
    await resolveWar(warRow);
    resolved++;
  }
  return { resolved };
}

async function resolveWar(warRow) {
  const war = normalizeWar(warRow);
  const { id: warId, guild_a_id: gA, guild_b_id: gB } = war;

  // Compter les slots vides comme score automatique
  const defenses = await getWarDefenses(warId);
  const gADefenses = defenses.filter((d) => d.guild_id === gA);
  const gBDefenses = defenses.filter((d) => d.guild_id === gB);

  // Slots vides = point automatique pour l'adversaire
  let scoreA = war.guild_a_score;
  let scoreB = war.guild_b_score;

  for (let slot = 1; slot <= MAX_DEFENSE_SLOTS; slot++) {
    const gASlot = gADefenses.find((d) => d.slot_index === slot);
    const gBSlot = gBDefenses.find((d) => d.slot_index === slot);

    // Si slot vide côté A → point pour B (sauf si déjà compté)
    if (!gASlot || gASlot.is_destroyed) {
      // Ne pas recalculer si déjà détruit (score déjà incrémenté en temps réel)
      if (!gASlot) scoreB = Math.min(MAX_DEFENSE_SLOTS, scoreB + 1);
    }
    if (!gBSlot || gBSlot.is_destroyed) {
      if (!gBSlot) scoreA = Math.min(MAX_DEFENSE_SLOTS, scoreA + 1);
    }
  }

  // Déterminer le vainqueur
  let winnerGuildId = null;
  let status = 'finished';

  // Vérifier si aucune attaque des deux côtés (annulation)
  const logsCount = await query(
    'SELECT COUNT(*) AS cnt FROM guild_war_logs WHERE war_id = ?',
    [warId]
  );
  const totalAttacks = Number(logsCount[0]?.cnt ?? 0);
  const cancelled = totalAttacks === 0;

  if (!cancelled) {
    if (scoreA > scoreB) winnerGuildId = gA;
    else if (scoreB > scoreA) winnerGuildId = gB;
    // else draw: winnerGuildId = null
  }

  await withTransaction(async (tx) => {
    await tx.query(
      `UPDATE guild_wars
       SET status = 'finished', guild_a_score = ?, guild_b_score = ?, winner_guild_id = ?
       WHERE id = ?`,
      [scoreA, scoreB, winnerGuildId, warId]
    );

    if (cancelled) return;

    // Distribuer les récompenses à tous les membres
    const membersA = await tx.query(
      'SELECT user_id FROM guild_members WHERE guild_id = ?',
      [gA]
    );
    const membersB = await tx.query(
      'SELECT user_id FROM guild_members WHERE guild_id = ?',
      [gB]
    );

    const rewardA = winnerGuildId === null ? REWARD_DRAW : (winnerGuildId === gA ? REWARD_WIN : REWARD_LOSS);
    const rewardB = winnerGuildId === null ? REWARD_DRAW : (winnerGuildId === gB ? REWARD_WIN : REWARD_LOSS);

    for (const m of membersA) {
      await addGuildCurrency(Number(m.user_id), rewardA, tx);
    }
    for (const m of membersB) {
      await addGuildCurrency(Number(m.user_id), rewardB, tx);
    }
  });

  // Mise à jour Elo (hors transaction pour ne pas bloquer)
  if (!cancelled) {
    await updateGuildEloAfterWar(gA, gB, winnerGuildId);
  }
}

// ── Transition vers la phase d'attaque ─────────────────────────────────────

/**
 * Met à jour le status des guerres qui doivent passer en phase d'attaque.
 */
export async function transitionToAttackPhase() {
  const result = await query(
    `UPDATE guild_wars
     SET status = 'attack'
     WHERE status = 'preparation' AND attack_phase_start <= UTC_TIMESTAMP()`,
    []
  );
  return { updated: result.affectedRows ?? 0 };
}

// ── Vue complète pour un utilisateur ─────────────────────────────────────────

export async function getFullWarStatus(userId) {
  const war = await getCurrentWarForUser(userId);
  if (!war) return null;

  const [defenses, logs] = await Promise.all([
    getWarDefenses(war.id),
    getWarLogs(war.id)
  ]);

  const membership = await query(
    'SELECT guild_id FROM guild_members WHERE user_id = ? LIMIT 1',
    [Number(userId)]
  );
  const myGuildId = membership.length ? Number(membership[0].guild_id) : null;

  const usedUnits = myGuildId ? await getUsedUnitIds(war.id, userId) : [];

  return {
    war,
    my_guild_id: myGuildId,
    defenses,
    logs,
    used_unit_ids: usedUnits
  };
}

// ── Historique des guerres ───────────────────────────────────────────────────

/**
 * Retourne l'historique des guerres terminées de la guilde de l'utilisateur.
 * @param {number} userId
 * @returns {Promise<Array<{ id, end_time, opponent_name, result: 'win'|'loss'|'draw', reward }>>}
 */
export async function getGuildWarHistory(userId) {
  const membership = await query(
    'SELECT guild_id FROM guild_members WHERE user_id = ? LIMIT 1',
    [Number(userId)]
  );
  if (!membership.length) {
    const err = buildWarError('NOT_IN_GUILD', 'Vous devez appartenir à une guilde.');
    throw err;
  }
  const guildId = Number(membership[0].guild_id);

  const rows = await query(
    `SELECT w.id, w.end_time, w.guild_a_id, w.guild_b_id, w.winner_guild_id,
            ga.name AS guild_a_name, gb.name AS guild_b_name
     FROM guild_wars w
     JOIN guilds ga ON ga.id = w.guild_a_id
     JOIN guilds gb ON gb.id = w.guild_b_id
     WHERE w.status = 'finished'
       AND (w.guild_a_id = ? OR w.guild_b_id = ?)
     ORDER BY w.end_time DESC
     LIMIT 50`,
    [guildId, guildId]
  );

  const history = rows.map((r) => {
    const isGuildA = Number(r.guild_a_id) === guildId;
    const opponentName = isGuildA ? r.guild_b_name : r.guild_a_name;
    let result;
    let reward;
    if (r.winner_guild_id === null) {
      result = 'draw';
      reward = REWARD_DRAW;
    } else if (Number(r.winner_guild_id) === guildId) {
      result = 'win';
      reward = REWARD_WIN;
    } else {
      result = 'loss';
      reward = REWARD_LOSS;
    }
    return {
      id: Number(r.id),
      end_time: parseSqlUtcDate(r.end_time)?.toISOString?.() ?? r.end_time,
      opponent_name: opponentName,
      result,
      reward
    };
  });

  return history;
}

// ── Prochaine guerre ─────────────────────────────────────────────────────────

export async function getNextWarSchedule() {
  const now = new Date();
  const currentHour = getParisHour(now);
  const nextParisMidnight = getNextParisMidnight(now);
  const nextParisNoon = getNextParisNoon(now);

  let phase, nextPhaseTime;
  if (currentHour >= 0 && currentHour < 12) {
    phase = 'preparation';
    const todayNoon = getParisNoonDate(now);
    nextPhaseTime = now >= todayNoon ? nextParisNoon : todayNoon;
  } else {
    phase = 'attack';
    nextPhaseTime = nextParisMidnight;
  }

  return {
    current_phase: phase,
    next_phase_at: nextPhaseTime.toISOString(),
    next_war_at: nextParisMidnight.toISOString(),
    time_zone: 'Europe/Paris'
  };
}
