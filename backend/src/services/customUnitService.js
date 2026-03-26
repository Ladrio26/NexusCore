import { query, withTransaction } from '../config/db.js';
import { buildCustomSkillData, buildCustomSkillDataFromConfig, buildStatPreview } from './customUnitSkillFactory.js';
import { computePowerBudget } from './customUnitPowerBudget.js';
import { validateCustomUnitChoices } from './customUnitBuilder.js';
import { validateCustomUnitBudget } from './customUnitBudgetValidator.js';
import { ROLE_BASE_STATS } from '../data/customUnitDefinitions.js';

function stripSkillMeta(skillData) {
  if (!skillData || typeof skillData !== 'object') return skillData;
  const { __summary, __tags, __specializations, __gameplayTags, __powerRating, ...rest } = skillData;
  return rest;
}

/** Colonnes units : JSON des modificateurs comme pour l’admin. */
function serializeSpecsFromSkillData(skillData) {
  const s = skillData?.__specializations;
  if (!s || typeof s !== 'object') {
    return {
      specA_bonus_stat: null,
      specB_bonus_stat: null,
      specA_skill_modifier: null,
      specB_skill_modifier: null,
      specA_passive: null,
      specB_passive: null
    };
  }
  return {
    specA_bonus_stat: s.specA_bonus_stat ?? null,
    specB_bonus_stat: s.specB_bonus_stat ?? null,
    specA_skill_modifier: s.specA_skill_modifier ? JSON.stringify(s.specA_skill_modifier) : null,
    specB_skill_modifier: s.specB_skill_modifier ? JSON.stringify(s.specB_skill_modifier) : null,
    specA_passive: s.specA_passive ? JSON.stringify(s.specA_passive) : null,
    specB_passive: s.specB_passive ? JSON.stringify(s.specB_passive) : null
  };
}

export async function getCustomUnitByUserId(userId) {
  const rows = await query(
    `SELECT cu.id, cu.user_id, cu.name, cu.role, cu.element, cu.attack_type, cu.unit_id, cu.is_locked,
            cu.raid_meta, cu.future_creation_cost, cu.future_evolution_cost, cu.future_evolution_level,
            cu.created_at, cu.updated_at, cu.config_json
     FROM custom_units cu WHERE cu.user_id = ? LIMIT 1`,
    [userId]
  );
  if (rows.length === 0) return null;
  const cu = rows[0];
  const ch = await query(
    'SELECT skill_slot, choice_type, choice_value FROM custom_unit_choices WHERE custom_unit_id = ? ORDER BY id',
    [cu.id]
  );
  const choices = ch.map((r) => ({
    skill_slot: r.skill_slot,
    choice_type: r.choice_type,
    choice_value: r.choice_value
  }));
  const selectedKeys = ch.filter((r) => r.choice_type === 'node').map((r) => r.choice_value);
  let config = null;
  if (cu.config_json != null) {
    try {
      config = typeof cu.config_json === 'string' ? JSON.parse(cu.config_json) : cu.config_json;
    } catch {
      config = null;
    }
  }
  return {
    ...cu,
    choices,
    selectedKeys,
    config,
    has_unit: cu.unit_id != null
  };
}

export async function createCustomUnit(userId, payload) {
  const { name, role, element, selectedKeys, config } = payload;
  const useConfig = config != null && typeof config === 'object';

  if (useConfig) {
    const bv = validateCustomUnitBudget({ ...config, role, element });
    if (!bv.isValid) {
      const err = new Error(bv.errors.join(' '));
      err.code = 'VALIDATION';
      err.details = bv.errors;
      throw err;
    }
  } else {
    const v = validateCustomUnitChoices(role, element, selectedKeys || []);
    if (!v.valid) {
      const err = new Error(v.errors.join(' '));
      err.code = 'VALIDATION';
      err.details = v.errors;
      throw err;
    }
  }

  const existing = await query('SELECT id FROM custom_units WHERE user_id = ? LIMIT 1', [userId]);
  if (existing.length > 0) {
    const err = new Error('Une unité Custom existe déjà pour ce compte.');
    err.code = 'ALREADY_EXISTS';
    throw err;
  }

  const base = ROLE_BASE_STATS[String(role).toLowerCase()];
  if (!base) {
    const err = new Error('Rôle invalide');
    err.code = 'INVALID_ROLE';
    throw err;
  }

  const pb = useConfig
    ? validateCustomUnitBudget({ ...config, role, element })
    : computePowerBudget(selectedKeys);
  const skillData = useConfig
    ? buildCustomSkillDataFromConfig(role, element, config, pb)
    : buildCustomSkillData(role, element, selectedKeys, pb);
  const cleanSkill = stripSkillMeta(skillData);
  const specs = serializeSpecsFromSkillData(skillData);
  const stats = buildStatPreview(role, element, useConfig ? [] : selectedKeys || []);
  const code = `CUSTOM_U${userId}`;
  const rarity = 'epic';

  const jsonStr = JSON.stringify(cleanSkill);

  return withTransaction(async (tx) => {
    const ins = await tx.query(
      `INSERT INTO units (
        code, name, rarity, role, attack_type, element, archetype,
        base_hp, base_attack, base_defense, base_speed, mastery,
        traits, skill_data, image_url, is_boss,
        specA_bonus_stat, specB_bonus_stat,
        specA_skill_modifier, specB_skill_modifier, specA_passive, specB_passive
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)`,
      [
        code,
        String(name || '').trim().slice(0, 128),
        rarity,
        base.role,
        base.attack_type,
        String(element).toLowerCase(),
        base.archetype,
        stats.hp,
        stats.attack,
        stats.defense,
        stats.speed,
        stats.mastery,
        JSON.stringify([]),
        jsonStr,
        null,
        specs.specA_bonus_stat,
        specs.specB_bonus_stat,
        specs.specA_skill_modifier,
        specs.specB_skill_modifier,
        specs.specA_passive,
        specs.specB_passive
      ]
    );
    const unitId = ins.insertId;

    const cfgJson = useConfig ? JSON.stringify(config) : null;
    const cuIns = await tx.query(
      `INSERT INTO custom_units (
        user_id, name, role, element, attack_type, unit_id, is_locked,
        raid_meta, future_creation_cost, future_evolution_cost, future_evolution_level,
        config_json
      ) VALUES (?, ?, ?, ?, ?, ?, 0, NULL, NULL, NULL, 0, ?)`,
      [
        userId,
        String(name || '').trim().slice(0, 128),
        String(role).toLowerCase(),
        String(element).toLowerCase(),
        base.attack_type,
        unitId,
        cfgJson
      ]
    );
    const customUnitId = cuIns.insertId;

    if (!useConfig) {
      for (const k of selectedKeys || []) {
        await tx.query(
          'INSERT INTO custom_unit_choices (custom_unit_id, skill_slot, choice_type, choice_value) VALUES (?, ?, ?, ?)',
          [customUnitId, 0, 'node', k]
        );
      }
    }

    const s1 = cleanSkill.skills?.find((s) => Number(s.priority) === 1) ?? null;
    const s2 =
      cleanSkill.skills?.find((s) => Number(s.priority) === 2) ??
      cleanSkill.skills?.find((s) => String(s.type).toUpperCase() === 'PASSIVE') ??
      null;

    await tx.query(
      `INSERT INTO custom_unit_snapshots (
        custom_unit_id, final_stats_json, final_skill1_json, final_skill2_json, final_preview_json, version
      ) VALUES (?, ?, ?, ?, ?, 1)`,
      [
        customUnitId,
        JSON.stringify(stats),
        JSON.stringify(s1),
        JSON.stringify(s2),
        JSON.stringify({ summary: skillData.__summary, tags: skillData.__tags })
      ]
    );

    await tx.query(
      'INSERT INTO user_units (user_id, unit_id, level, xp) VALUES (?, ?, 1, 0)',
      [userId, unitId]
    );

    return { customUnitId, unitId };
  });
}

export async function updateCustomUnit(userId, payload) {
  const { name, role, element, selectedKeys, config } = payload;
  const useConfig = config != null && typeof config === 'object';
  const row = await getCustomUnitByUserId(userId);
  if (!row) {
    const err = new Error('Aucune unité Custom.');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (row.is_locked) {
    const err = new Error('Configuration verrouillée.');
    err.code = 'LOCKED';
    throw err;
  }

  if (useConfig) {
    const bv = validateCustomUnitBudget({ ...config, role, element });
    if (!bv.isValid) {
      const err = new Error(bv.errors.join(' '));
      err.code = 'VALIDATION';
      err.details = bv.errors;
      throw err;
    }
  } else {
    const v = validateCustomUnitChoices(role, element, selectedKeys || []);
    if (!v.valid) {
      const err = new Error(v.errors.join(' '));
      err.code = 'VALIDATION';
      err.details = v.errors;
      throw err;
    }
  }

  const base = ROLE_BASE_STATS[String(role).toLowerCase()];
  const pb = useConfig
    ? validateCustomUnitBudget({ ...config, role, element })
    : computePowerBudget(selectedKeys);
  const skillData = useConfig
    ? buildCustomSkillDataFromConfig(role, element, config, pb)
    : buildCustomSkillData(role, element, selectedKeys, pb);
  const cleanSkill = stripSkillMeta(skillData);
  const specs = serializeSpecsFromSkillData(skillData);
  const stats = buildStatPreview(role, element, useConfig ? [] : selectedKeys || []);
  const code = `CUSTOM_U${userId}`;

  return withTransaction(async (tx) => {
    await tx.query(
      `UPDATE units SET name = ?, role = ?, attack_type = ?, element = ?, archetype = ?,
        base_hp = ?, base_attack = ?, base_defense = ?, base_speed = ?, mastery = ?, skill_data = ?,
        is_boss = 1,
        specA_bonus_stat = ?, specB_bonus_stat = ?,
        specA_skill_modifier = ?, specB_skill_modifier = ?, specA_passive = ?, specB_passive = ?
       WHERE id = ?`,
      [
        String(name || '').trim().slice(0, 128),
        base.role,
        base.attack_type,
        String(element).toLowerCase(),
        base.archetype,
        stats.hp,
        stats.attack,
        stats.defense,
        stats.speed,
        stats.mastery,
        JSON.stringify(cleanSkill),
        specs.specA_bonus_stat,
        specs.specB_bonus_stat,
        specs.specA_skill_modifier,
        specs.specB_skill_modifier,
        specs.specA_passive,
        specs.specB_passive,
        row.unit_id
      ]
    );

    if (useConfig) {
      await tx.query(
        'UPDATE custom_units SET name = ?, role = ?, element = ?, attack_type = ?, config_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [
          String(name || '').trim().slice(0, 128),
          String(role).toLowerCase(),
          String(element).toLowerCase(),
          base.attack_type,
          JSON.stringify(config),
          row.id
        ]
      );
    } else {
      await tx.query(
        'UPDATE custom_units SET name = ?, role = ?, element = ?, attack_type = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [
          String(name || '').trim().slice(0, 128),
          String(role).toLowerCase(),
          String(element).toLowerCase(),
          base.attack_type,
          row.id
        ]
      );
    }

    await tx.query('DELETE FROM custom_unit_choices WHERE custom_unit_id = ?', [row.id]);
    if (!useConfig) {
      for (const k of selectedKeys || []) {
        await tx.query(
          'INSERT INTO custom_unit_choices (custom_unit_id, skill_slot, choice_type, choice_value) VALUES (?, ?, ?, ?)',
          [row.id, 0, 'node', k]
        );
      }
    }

    const s1 = cleanSkill.skills?.find((s) => Number(s.priority) === 1) ?? null;
    const s2 =
      cleanSkill.skills?.find((s) => Number(s.priority) === 2) ??
      cleanSkill.skills?.find((s) => String(s.type).toUpperCase() === 'PASSIVE') ??
      null;

    await tx.query(
      `INSERT INTO custom_unit_snapshots (
        custom_unit_id, final_stats_json, final_skill1_json, final_skill2_json, final_preview_json, version
      ) VALUES (?, ?, ?, ?, ?, 1)`,
      [
        row.id,
        JSON.stringify(stats),
        JSON.stringify(s1),
        JSON.stringify(s2),
        JSON.stringify({ summary: skillData.__summary, tags: skillData.__tags })
      ]
    );

    return { ok: true, unitId: row.unit_id };
  });
}
