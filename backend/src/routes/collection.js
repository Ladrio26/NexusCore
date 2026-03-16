import { query } from '../config/db.js';
import { getXpRequired } from '../services/xpService.js';
import { computeScaledStats } from '../../../core/combatEngine.js';
import { computeCurrentFatigue } from '../utils/fatigueUtils.js';
import { applyArtifactBonusesToUnit } from '../../../core/artifacts.js';
import { getEquippedArtifactsForUnitIds } from '../services/artifactService.js';

/** Log debug temporaire fatigue (à retirer en prod si besoin). */
function logFatigueRecalculated(id, oldVal, minutesPassed, newVal) {
  console.log('Fatigue recalculated:', { id, old: oldVal, minutesPassed, new: newVal });
}

/** SELECT de base sans colonnes optionnelles (fatigue_last_update, basic_targeting, skill_targeting). */
const BASE_SELECT_MINIMAL = `SELECT uu.id AS user_unit_id,
              uu.level,
              uu.xp,
              uu.specialization,
              uu.power_level,
              uu.power_openings,
              uu.ascension_count,
              uu.fatigue,
              uu.injury_level,
              uu.is_injured,
              u.id AS unit_id,
              u.code,
              u.name,
              u.rarity,
              u.role,
              u.attack_type,
              u.element,
              u.archetype,
              u.base_hp,
              u.base_attack,
              u.base_defense,
              u.base_speed,
              u.mastery,
              u.image_url,
              u.traits,
              u.skill_data,
              u.synergy_tag,
              u.core_type,
              u.specA_bonus_stat,
              u.specB_bonus_stat
       FROM user_units uu
       JOIN units u ON u.id = uu.unit_id
       WHERE uu.user_id = ?`;

export function registerCollectionRoutes(fastify, authenticate) {
  fastify.get('/collection', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      return await handleCollection(request, reply);
    } catch (err) {
      fastify.log.error(err, '[/collection] error');
      return reply.code(500).send({
        error: 'COLLECTION_LOAD_FAILED',
        message: err?.message || 'Erreur chargement collection'
      });
    }
  });
}

async function handleCollection(request, reply) {
  const baseUserId = request.user.id;
  const q = (request.query || {});
  const requestedIdRaw = q.userId ?? q.user_id ?? null;
  let userId = baseUserId;
  let hasExplicitRequestedUser = false;
  if (requestedIdRaw != null) {
    const parsed = Number(requestedIdRaw);
    if (Number.isFinite(parsed) && parsed > 0) {
      userId = parsed;
      hasExplicitRequestedUser = true;
    }
  }
  let ownerDisplayName = null;
  if (hasExplicitRequestedUser) {
    const userRows = await query('SELECT display_name FROM users WHERE id = ?', [userId]);
    ownerDisplayName = userRows[0]?.display_name ?? null;
  }

  /** Avec fatigue_last_update pour décrément -1/min */
  const baseSelectWithFatigue = `SELECT uu.id AS user_unit_id,
              uu.level,
              uu.xp,
              uu.specialization,
              uu.power_level,
              uu.power_openings,
              uu.ascension_count,
              uu.fatigue,
              uu.fatigue_last_update,
              UNIX_TIMESTAMP(uu.fatigue_last_update) AS fatigue_last_update_ts,
              uu.injury_level,
              uu.is_injured,
              uu.basic_targeting,
              uu.skill_targeting,
              u.id AS unit_id,
              u.code,
              u.name,
              u.rarity,
              u.role,
              u.attack_type,
              u.element,
              u.archetype,
              u.base_hp,
              u.base_attack,
              u.base_defense,
              u.base_speed,
              u.mastery,
              u.image_url,
              u.traits,
              u.skill_data,
              u.synergy_tag,
              u.core_type,
              u.specA_bonus_stat,
              u.specB_bonus_stat
       FROM user_units uu
       JOIN units u ON u.id = uu.unit_id
       WHERE uu.user_id = ?`;

  /** Avec fatigue_last_update SANS basic_targeting/skill_targeting (fallback si colonnes targeting absentes) */
  const baseSelectFatigueOnly = `SELECT uu.id AS user_unit_id,
              uu.level,
              uu.xp,
              uu.specialization,
              uu.power_level,
              uu.power_openings,
              uu.ascension_count,
              uu.fatigue,
              uu.fatigue_last_update,
              UNIX_TIMESTAMP(uu.fatigue_last_update) AS fatigue_last_update_ts,
              uu.injury_level,
              uu.is_injured,
              u.id AS unit_id,
              u.code,
              u.name,
              u.rarity,
              u.role,
              u.attack_type,
              u.element,
              u.archetype,
              u.base_hp,
              u.base_attack,
              u.base_defense,
              u.base_speed,
              u.mastery,
              u.image_url,
              u.traits,
              u.skill_data,
              u.synergy_tag,
              u.core_type,
              u.specA_bonus_stat,
              u.specB_bonus_stat
       FROM user_units uu
       JOIN units u ON u.id = uu.unit_id
       WHERE uu.user_id = ?`;

  /** Sans fatigue_last_update (fallback si colonne fatigue_last_update absente) */
  const baseSelectWithoutFatigue = `SELECT uu.id AS user_unit_id,
              uu.level,
              uu.xp,
              uu.specialization,
              uu.power_level,
              uu.power_openings,
              uu.ascension_count,
              uu.fatigue,
              uu.injury_level,
              uu.is_injured,
              uu.basic_targeting,
              uu.skill_targeting,
              u.id AS unit_id,
              u.code,
              u.name,
              u.rarity,
              u.role,
              u.attack_type,
              u.element,
              u.archetype,
              u.base_hp,
              u.base_attack,
              u.base_defense,
              u.base_speed,
              u.mastery,
              u.image_url,
              u.traits,
              u.skill_data,
              u.synergy_tag,
              u.core_type,
              u.specA_bonus_stat,
              u.specB_bonus_stat
       FROM user_units uu
       JOIN units u ON u.id = uu.unit_id
       WHERE uu.user_id = ?`;

  let rows;
  let hasFatigueLastUpdate = false;
  let hasTargeting = true;

  try {
    rows = await query(baseSelectWithFatigue, [userId]);
    hasFatigueLastUpdate = true;
  } catch (err) {
    const isBadField = err?.code === 'ER_BAD_FIELD_ERROR';
    const msg = (err?.message || '').toString();
    if (!isBadField) throw err;
    try {
      /* Fallback : fatigue sans targeting (si basic_targeting/skill_targeting absents) */
      rows = await query(baseSelectFatigueOnly, [userId]);
      hasFatigueLastUpdate = true;
      hasTargeting = false;
    } catch (e2) {
      if (e2?.code !== 'ER_BAD_FIELD_ERROR' && !(e2?.message || '').includes('basic_targeting')) throw e2;
      try {
        rows = await query(baseSelectWithoutFatigue, [userId]);
        if (msg.includes('fatigue_last_update')) hasFatigueLastUpdate = false;
      } catch (e3) {
        hasTargeting = false;
        hasFatigueLastUpdate = false;
        rows = await query(BASE_SELECT_MINIMAL, [userId]);
      }
    }
  }

  if (!Array.isArray(rows)) rows = [];

  const parseJson = (v) => {
      if (v == null) return null;
      if (typeof v === 'object') return v;
      if (typeof v !== 'string') return v;
      try { return JSON.parse(v); } catch { return null; }
    };

    const toSafeNumber = (v) => (typeof v === 'bigint' ? Number(v) : v);

    const unitIds = rows.map((row) => Number(row.user_unit_id)).filter((id) => Number.isInteger(id) && id > 0);
    const equippedArtifactsByUnit = await getEquippedArtifactsForUnitIds(userId, unitIds);
    const units = [];
    for (const r of rows) {
      const userUnit = { level: r.level ?? 1, specialization: r.specialization ?? null, power_level: r.power_level ?? 1 };
      const stats = computeScaledStats(r, userUnit);
      let fatigue;
      let minutesPassed = 0;
      if (hasFatigueLastUpdate) {
        const computed = computeCurrentFatigue({
          fatigue: r.fatigue ?? 0,
          fatigue_last_update: r.fatigue_last_update,
          fatigue_last_update_ts: r.fatigue_last_update_ts
        });
        fatigue = computed.fatigue;
        minutesPassed = computed.minutesPassed;
        if (minutesPassed > 0) {
          await query(
            'UPDATE user_units SET fatigue=?, fatigue_last_update=NOW() WHERE id=?',
            [fatigue, r.user_unit_id]
          );
          logFatigueRecalculated(r.user_unit_id, r.fatigue, minutesPassed, fatigue);
        } else if (r.fatigue_last_update == null) {
          /* Anciennes unités : initialiser fatigue_last_update pour que le décrement -1/min fonctionne */
          await query('UPDATE user_units SET fatigue_last_update=NOW() WHERE id=?', [r.user_unit_id]);
        }
      } else {
        fatigue = toSafeNumber(r.fatigue ?? 0);
      }
      const equippedArtifacts = equippedArtifactsByUnit.get(Number(r.user_unit_id)) || [];
      const unitPayload = {
        user_unit_id: toSafeNumber(r.user_unit_id),
        unit_id: toSafeNumber(r.unit_id),
        level: toSafeNumber(r.level),
        xp: toSafeNumber(r.xp),
        specialization: r.specialization,
        power_level: toSafeNumber(r.power_level ?? 1),
        power_openings: toSafeNumber(r.power_openings ?? 1),
        ascension_count: toSafeNumber(r.ascension_count),
        fatigue,
        injury_level: toSafeNumber(r.injury_level),
        is_injured: toSafeNumber(r.is_injured),
        code: r.code,
        name: r.name,
        rarity: r.rarity,
        role: r.role,
        attack_type: r.attack_type,
        element: r.element,
        archetype: r.archetype,
        image_url: r.image_url ?? null,
        base_hp: toSafeNumber(r.base_hp),
        base_attack: toSafeNumber(r.base_attack),
        base_defense: toSafeNumber(r.base_defense),
        base_speed: toSafeNumber(r.base_speed),
        mastery: toSafeNumber(r.mastery),
        traits: parseJson(r.traits),
        skill_data: parseJson(r.skill_data),
        synergy_tag: r.synergy_tag,
        core_type: r.core_type,
        specA_bonus_stat: r.specA_bonus_stat,
        specB_bonus_stat: r.specB_bonus_stat,
        xpRequired: getXpRequired(r.level ?? 1),
        maxHp: stats.maxHp,
        attack: stats.attack,
        defense: stats.defense,
        speed: stats.speed,
        mastery: stats.mastery ?? 0,
        equipped_artifacts: equippedArtifacts,
        basic_targeting: hasTargeting && r.basic_targeting != null ? String(r.basic_targeting).trim() || 'NO_FOCUS' : 'NO_FOCUS',
        skill_targeting: hasTargeting && r.skill_targeting != null ? String(r.skill_targeting).trim() || 'NO_FOCUS' : 'NO_FOCUS'
      };
      applyArtifactBonusesToUnit(unitPayload, equippedArtifacts);
      units.push(unitPayload);
    }

  let viewerOwnedUnitIds = [];
  if (hasExplicitRequestedUser) {
    const ownedRows = await query(
      'SELECT DISTINCT unit_id FROM user_units WHERE user_id = ?',
      [baseUserId]
    );
    viewerOwnedUnitIds = ownedRows.map((r) => Number(r.unit_id));
  }

  return {
    units,
    owner_display_name: ownerDisplayName,
    viewer_owned_unit_ids: viewerOwnedUnitIds
  };
}

