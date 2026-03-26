import { query } from '../config/db.js';
import { MAX_TEAM_PRESETS } from '../constants/teamPresets.js';
import { computeCurrentFatigue } from '../utils/fatigueUtils.js';
import { getRestCenterUserUnitIdSet, REST_CENTER_FATIGUE_RECOVERY_PER_MINUTE, DEFAULT_FATIGUE_RECOVERY_PER_MINUTE } from '../services/restCenterService.js';
import { TARGETING_RULES } from '../../../core/constants/targeting.js';

export function registerTeamRoutes(fastify, authenticate) {
  fastify.get('/team', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user.id;
    const rows = await query(
      `SELECT id, name, mode, frontline_slots, backline_slots FROM teams
       WHERE user_id = ? ORDER BY is_default DESC, id ASC LIMIT 1`,
      [userId]
    );
    if (!rows.length) {
      return reply.code(200).send({ frontlineSlots: [], backlineSlots: [] });
    }
    const row = rows[0];
    const frontlineSlots = Array.isArray(row.frontline_slots)
      ? row.frontline_slots
      : (typeof row.frontline_slots === 'string' ? JSON.parse(row.frontline_slots || '[]') : []);
    const backlineSlots = Array.isArray(row.backline_slots)
      ? row.backline_slots
      : (typeof row.backline_slots === 'string' ? JSON.parse(row.backline_slots || '[]') : []);
    return {
      teamId: row.id,
      name: row.name,
      mode: row.mode,
      frontlineSlots: frontlineSlots.map(Number).filter((n) => Number.isInteger(n) && n > 0),
      backlineSlots: backlineSlots.map(Number).filter((n) => Number.isInteger(n) && n > 0)
    };
  });

  fastify.post('/team/update', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user.id;
    const { teamId, name, mode, frontlineSlots, backlineSlots, isDefault } =
      request.body || {};

    const modeValue = mode || 'ranked';
    const front = Array.isArray(frontlineSlots) ? frontlineSlots : [];
    const back = Array.isArray(backlineSlots) ? backlineSlots : [];

    if (front.length > 5 || back.length > 5) {
      return reply.code(400).send({ error: 'INVALID_TEAM_SIZE', message: 'Max 5 slots par ligne.' });
    }

    // Validation côté serveur : appartenance et contraintes CAC / distance via archetype
    const rows = await query(
      `SELECT uu.id AS user_unit_id, u.archetype
       FROM user_units uu
       JOIN units u ON u.id = uu.unit_id
       WHERE uu.user_id = ?`,
      [userId]
    );
    const map = new Map();
    for (const r of rows) {
      map.set(Number(r.user_unit_id), r.archetype);
    }

    const normalizeIds = (arr) =>
      arr
        .map((v) => Number(v))
        .filter((v) => Number.isInteger(v) && v > 0);

    const frontIds = normalizeIds(front);
    const backIds = normalizeIds(back);

    const totalUnique = new Set([...frontIds, ...backIds]).size;
    if (totalUnique > 6) {
      return reply.code(400).send({
        error: 'INVALID_TEAM_SIZE',
        message: 'Maximum 6 unités dans l\'équipe.'
      });
    }

    const errors = [];

    const checkRow = (ids, rowName, mustBeFrontline) => {
      for (const id of ids) {
        const archetype = map.get(id);
        if (!archetype) {
          errors.push(`Unit ${id} n'appartient pas au joueur.`);
          continue;
        }
        const isFront = archetype === 'CAC_TANK' || archetype === 'CAC_DPS';
        const isBack = archetype.startsWith('DISTANCE');
        if (mustBeFrontline && !isFront) {
          errors.push(
            `Unit ${id} (${archetype}) ne peut pas être en ${rowName} (CAC uniquement).`
          );
        }
        if (!mustBeFrontline && isFront) {
          errors.push(
            `Unit ${id} (${archetype}) ne peut pas être en ${rowName} (distance uniquement).`
          );
        }
      }
    };

    checkRow(frontIds, 'frontline', true);
    checkRow(backIds, 'backline', false);

    if (errors.length) {
      return reply.code(400).send({
        error: 'INVALID_TEAM_COMPOSITION',
        details: errors
      });
    }

    const frontJson = JSON.stringify(frontIds);
    const backJson = JSON.stringify(backIds);

    if (teamId) {
      await query(
        `UPDATE teams
         SET name = IFNULL(?, name),
             mode = ?,
             frontline_slots = ?,
             backline_slots = ?,
             is_default = ?
         WHERE id = ? AND user_id = ?`,
        [name, modeValue, frontJson, backJson, isDefault ? 1 : 0, teamId, userId]
      );
    } else {
      const res = await query(
        `INSERT INTO teams (user_id, name, mode, frontline_slots, backline_slots, is_default)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, name || 'Default', modeValue, frontJson, backJson, isDefault ? 1 : 0]
      );
      return { teamId: res.insertId };
    }

    return { success: true };
  });

  const PRESET_INDEX_MIN = 1;
  const PRESET_INDEX_MAX = MAX_TEAM_PRESETS;

  fastify.get('/team/presets', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user.id;
    const rows = await query(
      `SELECT preset_index, preset_name, front_slots, back_slots, selected_noyau_index FROM user_team_presets
       WHERE user_id = ? ORDER BY preset_index ASC`,
      [userId]
    );
    const normalizedRows = rows.map((row) => {
      const front = row?.front_slots != null
        ? (Array.isArray(row.front_slots) ? row.front_slots : JSON.parse(row.front_slots || '[]'))
        : [];
      const back = row?.back_slots != null
        ? (Array.isArray(row.back_slots) ? row.back_slots : JSON.parse(row.back_slots || '[]'))
        : [];
      const name = row?.preset_name != null && String(row.preset_name).trim() !== ''
        ? String(row.preset_name).trim()
        : null;
      const selectedNoyauIndex = row?.selected_noyau_index != null ? Math.max(0, Number(row.selected_noyau_index)) : 0;
      return {
        preset_index: Number(row.preset_index),
        preset_name: name,
        front_slots: front.map(Number).filter((n) => Number.isInteger(n) && n > 0),
        back_slots: back.map(Number).filter((n) => Number.isInteger(n) && n > 0),
        selected_noyau_index: selectedNoyauIndex
      };
    });

    const allUnitIds = [...new Set(
      normalizedRows.flatMap((row) => [...row.front_slots, ...row.back_slots])
    )];

    let restCenterUnitIds = new Set();
    try {
      restCenterUnitIds = await getRestCenterUserUnitIdSet(userId);
    } catch (e) {
      if (!(e?.message || '').includes('rest_center_slots')) throw e;
    }

    const unitById = new Map();
    if (allUnitIds.length > 0) {
      const placeholders = allUnitIds.map(() => '?').join(',');
      let unitRows;
      try {
        unitRows = await query(
          `SELECT uu.id AS user_unit_id, uu.level, uu.fatigue, uu.fatigue_last_update,
                  UNIX_TIMESTAMP(uu.fatigue_last_update) AS fatigue_last_update_ts,
                  uu.injury_level, uu.is_injured,
                  u.name, u.image_url, u.archetype, u.base_hp
           FROM user_units uu
           JOIN units u ON u.id = uu.unit_id
           WHERE uu.user_id = ? AND uu.id IN (${placeholders})`,
          [userId, ...allUnitIds]
        );
      } catch (err) {
        const msg = (err?.message || '').toString();
        if (msg.includes('fatigue_last_update') || err?.code === 'ER_BAD_FIELD_ERROR') {
          unitRows = await query(
            `SELECT uu.id AS user_unit_id, uu.level, uu.fatigue, uu.injury_level, uu.is_injured,
                    u.name, u.image_url, u.archetype, u.base_hp
             FROM user_units uu
             JOIN units u ON u.id = uu.unit_id
             WHERE uu.user_id = ? AND uu.id IN (${placeholders})`,
            [userId, ...allUnitIds]
          );
        } else {
          throw err;
        }
      }
      for (const row of unitRows) {
        let fatigue;
        if (row.fatigue_last_update_ts != null || row.fatigue_last_update != null) {
          const uid = Number(row.user_unit_id);
          const recoveryRate = restCenterUnitIds.has(uid)
            ? REST_CENTER_FATIGUE_RECOVERY_PER_MINUTE
            : DEFAULT_FATIGUE_RECOVERY_PER_MINUTE;
          fatigue = computeCurrentFatigue(
            {
              fatigue: row.fatigue ?? 0,
              fatigue_last_update: row.fatigue_last_update,
              fatigue_last_update_ts: row.fatigue_last_update_ts
            },
            { fatigueRecoveryPerMinute: recoveryRate }
          ).fatigue;
        } else {
          fatigue = Math.max(0, Number(row.fatigue ?? 0));
        }
        unitById.set(Number(row.user_unit_id), {
          user_unit_id: Number(row.user_unit_id),
          name: String(row.name ?? 'Unité'),
          level: Number(row.level ?? 1),
          image_url: row.image_url ?? null,
          archetype: row.archetype ?? null,
          fatigue: Math.min(100, Math.max(0, fatigue)),
          injury_level: row.injury_level != null ? Math.max(0, Number(row.injury_level)) : 0,
          is_injured: row.is_injured != null ? Number(row.is_injured) : 0,
          base_hp: row.base_hp != null ? Number(row.base_hp) : 0
        });
      }
    }

    const presets = normalizedRows.map((row) => ({
      ...row,
      front_units: row.front_slots
        .map((id) => unitById.get(Number(id)))
        .filter(Boolean),
      back_units: row.back_slots
        .map((id) => unitById.get(Number(id)))
        .filter(Boolean)
    }));

    return { presets };
  });

  fastify.post('/team/presets/save', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user.id;
    const { preset_index: presetIndex, preset_name: presetName, front_slots: frontSlots, back_slots: backSlots, selected_noyau_index: selectedNoyauIndex } = request.body || {};
    const idx = Number(presetIndex);
    if (!Number.isInteger(idx) || idx < PRESET_INDEX_MIN || idx > PRESET_INDEX_MAX) {
      return reply.code(400).send({ error: 'INVALID_PRESET_INDEX' });
    }
    const front = Array.isArray(frontSlots) ? frontSlots.map(Number).filter((n) => Number.isInteger(n) && n > 0) : [];
    const back = Array.isArray(backSlots) ? backSlots.map(Number).filter((n) => Number.isInteger(n) && n > 0) : [];
    if (front.length > 5 || back.length > 5) {
      return reply.code(400).send({ error: 'INVALID_TEAM_SIZE' });
    }
    const totalUnits = [...new Set([...front, ...back])].length;
    if (totalUnits > 6) {
      return reply.code(400).send({ error: 'INVALID_TEAM_SIZE', message: 'Maximum 6 unités.' });
    }
    const name = presetName != null && String(presetName).trim() !== '' ? String(presetName).trim().slice(0, 64) : null;
    const noyauIdx = selectedNoyauIndex != null ? Math.max(0, Math.min(255, Number(selectedNoyauIndex))) : 0;
    const frontJson = JSON.stringify(front);
    const backJson = JSON.stringify(back);
    await query(
      `INSERT INTO user_team_presets (user_id, preset_index, preset_name, front_slots, back_slots, selected_noyau_index)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE preset_name = VALUES(preset_name), front_slots = VALUES(front_slots), back_slots = VALUES(back_slots), selected_noyau_index = VALUES(selected_noyau_index)`,
      [userId, idx, name, frontJson, backJson, noyauIdx]
    );
    return { success: true };
  });

  fastify.patch('/team/presets/:index', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user.id;
    const idx = Number(request.params?.index);
    if (!Number.isInteger(idx) || idx < PRESET_INDEX_MIN || idx > PRESET_INDEX_MAX) {
      return reply.code(400).send({ error: 'INVALID_PRESET_INDEX' });
    }
    const { preset_name: presetName } = request.body || {};
    const name = presetName != null && String(presetName).trim() !== '' ? String(presetName).trim().slice(0, 64) : null;
    await query(
      `INSERT INTO user_team_presets (user_id, preset_index, preset_name, front_slots, back_slots)
       VALUES (?, ?, ?, NULL, NULL)
       ON DUPLICATE KEY UPDATE preset_name = VALUES(preset_name)`,
      [userId, idx, name]
    );
    return { success: true };
  });

  fastify.delete('/team/presets/:index', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user.id;
    const idx = Number(request.params?.index);
    if (!Number.isInteger(idx) || idx < PRESET_INDEX_MIN || idx > PRESET_INDEX_MAX) {
      return reply.code(400).send({ error: 'INVALID_PRESET_INDEX' });
    }
    await query(
      'DELETE FROM user_team_presets WHERE user_id = ? AND preset_index = ?',
      [userId, idx]
    );
    return { success: true };
  });

  fastify.patch('/team/user-units/:id/targeting', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user.id;
    const id = Number(request.params?.id);
    if (!Number.isInteger(id) || id < 1) {
      return reply.code(400).send({ error: 'INVALID_USER_UNIT_ID' });
    }
    const { basic_targeting: basicTargeting, skill_targeting: skillTargeting } = request.body || {};
    const allowed = new Set(TARGETING_RULES);
    const basic = basicTargeting != null ? String(basicTargeting).trim().toUpperCase() : null;
    const skill = skillTargeting != null ? String(skillTargeting).trim().toUpperCase() : null;
    if (basic != null && !allowed.has(basic)) {
      return reply.code(400).send({ error: 'INVALID_BASIC_TARGETING', allowed: TARGETING_RULES });
    }
    if (skill != null && !allowed.has(skill)) {
      return reply.code(400).send({ error: 'INVALID_SKILL_TARGETING', allowed: TARGETING_RULES });
    }
    const updates = [];
    const params = [];
    if (basic != null) {
      updates.push('basic_targeting = ?');
      params.push(basic);
    }
    if (skill != null) {
      updates.push('skill_targeting = ?');
      params.push(skill);
    }
    if (updates.length === 0) {
      return reply.code(400).send({ error: 'MISSING_TARGETING', message: 'basic_targeting ou skill_targeting requis.' });
    }
    params.push(id, userId);
    try {
      const result = await query(
        `UPDATE user_units SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
        params
      );
      if (result?.affectedRows === 0) {
        return reply.code(404).send({ error: 'USER_UNIT_NOT_FOUND' });
      }
      return { success: true };
    } catch (err) {
      const msg = (err?.message || err?.code || '').toString();
      if (err?.code === 'ER_BAD_FIELD_ERROR' || msg.includes('basic_targeting') || msg.includes('skill_targeting')) {
        return reply.code(503).send({
          error: 'TARGETING_MIGRATION_REQUIRED',
          message: 'Exécutez la migration database/patch_targeting_user_units.sql sur la base de données.'
        });
      }
      throw err;
    }
  });
}

