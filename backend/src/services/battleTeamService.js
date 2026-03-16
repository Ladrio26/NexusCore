import { query } from '../config/db.js';
import { computeScaledStats } from '../../../core/combatEngine.js';
import { computeCurrentFatigue } from '../utils/fatigueUtils.js';
import { applyArtifactBonusesToUnit } from '../../../core/artifacts.js';
import { getEquippedArtifactsForUnitIds } from './artifactService.js';

const FORBIDDEN_KEYS = ['base_hp', 'base_attack', 'base_defense', 'base_speed', 'attack', 'defense', 'speed', 'mastery'];

/** Mapping effect.stat (noyau) vers la propriété unit (après computeScaledStats). */
const NOYAU_STAT_KEYS = ['attack', 'defense', 'speed', 'mastery', 'maxHp'];

/**
 * Retourne la liste des noyaux distincts (par description) des unités de l'équipe.
 * @param {Array} teamUnits - Unités construites (avec skill_data)
 * @returns {Array<{ description: string, effects: Array }>}
 */
export function getNoyauxFromTeam(teamUnits) {
  if (!Array.isArray(teamUnits)) return [];
  const seen = new Set();
  const out = [];
  for (const unit of teamUnits) {
    const noyau = unit.skill_data?.noyau ?? unit.noyau ?? null;
    if (!noyau || typeof noyau !== 'object' || !noyau.description) continue;
    const key = String(noyau.description).trim();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      description: noyau.description,
      effects: Array.isArray(noyau.effects) ? noyau.effects : []
    });
  }
  return out;
}

/**
 * Retourne le noyau sélectionné pour l'équipe (index 0 = Aucun, 1+ = index dans la liste dédupliquée).
 * @param {Array} teamUnits
 * @param {number} selectedNoyauIndex - 0 = aucun, 1 = premier noyau, etc.
 * @returns {{ description: string, effects: Array } | null}
 */
export function getSelectedNoyau(teamUnits, selectedNoyauIndex) {
  const list = getNoyauxFromTeam(teamUnits);
  const idx = Number(selectedNoyauIndex);
  if (!Number.isInteger(idx) || idx < 1 || idx > list.length) return null;
  return list[idx - 1] ?? null;
}

/**
 * Applique les bonus du noyau aux stats des unités (modifie unit en place).
 * À appeler après computeScaledStats, avant initializeAtb. Ne crée pas de buff.
 * @param {Array} teamUnits - Unités avec maxHp, attack, defense, speed, mastery
 * @param {{ description: string, effects: Array } | null} noyau
 */
export function applyNoyauBonus(teamUnits, noyau) {
  if (!noyau || !Array.isArray(noyau.effects)) return;
  for (const unit of teamUnits) {
    for (const effect of noyau.effects) {
      const filter = effect.filter ?? {};
      const el = filter.element;
      const arch = filter.archetype;
      const matchElement = !el || String(unit.element || '').toLowerCase() === String(el).toLowerCase();
      const matchArchetype = !arch || String(unit.archetype || '') === String(arch);
      if (!matchElement || !matchArchetype) continue;

      const stat = effect.stat;
      const percent = Number(effect.percent) || 0;
      if (!NOYAU_STAT_KEYS.includes(stat)) continue;
      const val = unit[stat];
      if (val != null && typeof val === 'number') {
        unit[stat] = Math.round(val * (1 + percent / 100));
      }
    }
  }
}

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

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

function isRarityAtLeast(rarity, minRarity) {
  if (!rarity || !minRarity) return false;
  const r = String(rarity).toLowerCase();
  const m = String(minRarity).toLowerCase();
  const a = RARITY_ORDER.indexOf(r);
  const b = RARITY_ORDER.indexOf(m);
  return a >= 0 && b >= 0 && a >= b;
}

function generateSkillId() {
  return `skill_${Math.random().toString(36).slice(2, 10)}`;
}

function ensureSkillIds(skills) {
  if (!Array.isArray(skills)) return;
  const used = new Set();
  for (let i = 0; i < skills.length; i++) {
    const s = skills[i];
    if (!s || typeof s !== 'object') continue;
    let id = (s.id ?? '').toString().trim();
    if (!id) {
      id = generateSkillId();
      while (used.has(id)) id = generateSkillId();
      s.id = id;
    }
    used.add(id);
  }
}

/**
 * Applique le modificateur de spé sur la compétence ciblée dans skill_data.
 * Nouveau format : specModifier = { targetSkillId, modify: { effects?, cd_actions?, trigger?, cooldown? } }.
 * Legacy : specModifier = { effects: [...] } → appliqué à la première ACTIVE.
 * Exporté pour réutilisation (ex: génération équipes PNJ PvP).
 */
export function applySpecModifier(skillData, specModifier) {
  if (!skillData || typeof skillData !== 'object' || !specModifier || typeof specModifier !== 'object') {
    return skillData;
  }
  const out = JSON.parse(JSON.stringify(skillData));
  let skills = Array.isArray(out.skills) ? out.skills : null;
  if (!skills || skills.length === 0) return out;
  ensureSkillIds(skills);

  const targetSkillId = (specModifier.targetSkillId ?? '').toString().trim();
  const modify = specModifier.modify && typeof specModifier.modify === 'object' ? specModifier.modify : null;

  let target;
  if (targetSkillId) {
    target = skills.find((s) => s && s.id === targetSkillId);
  }
  if (!target && !modify && Array.isArray(specModifier.effects) && specModifier.effects.length > 0) {
    target = skills.find((s) => s && String(s.type ?? '').toUpperCase() === 'ACTIVE');
  }
  if (!target && !targetSkillId && modify && (Array.isArray(modify.effects) && modify.effects.length > 0 || modify.cd_actions != null || modify.trigger != null || modify.cooldown != null)) {
    target = skills.find((s) => s && String(s.type ?? '').toUpperCase() === 'ACTIVE');
  }
  if (!target) return out;

  const patch = modify || (Array.isArray(specModifier.effects) ? { effects: specModifier.effects } : null);
  if (!patch) return out;

  if (Array.isArray(patch.effects)) target.effects = patch.effects;
  if (typeof patch.cd_actions === 'number' && patch.cd_actions >= 0) target.cd_actions = patch.cd_actions;
  if (typeof patch.trigger === 'string') target.trigger = patch.trigger.trim();
  if (typeof patch.cooldown === 'number' && patch.cooldown >= 0) target.cooldown = patch.cooldown;

  return out;
}

/**
 * Vérifie qu'aucun slot ne contient de stats (client ne doit pas envoyer de stats).
 * @param {Array} team
 * @returns {{ ok: boolean, error?: string }}
 */
export function assertNoClientStats(team) {
  if (!Array.isArray(team)) return { ok: false, error: 'INVALID_TEAMS' };
  for (let i = 0; i < team.length; i++) {
    const slot = team[i];
    if (slot && typeof slot === 'object') {
      for (const key of FORBIDDEN_KEYS) {
        if (Object.prototype.hasOwnProperty.call(slot, key)) {
          return { ok: false, error: 'CLIENT_STATS_FORBIDDEN', message: `Champ interdit: ${key}. Les stats sont calculées côté serveur.` };
        }
      }
    }
  }
  return { ok: true };
}

/**
 * Valide le format des équipes : uniquement { user_unit_id, position }.
 */
export function validateTeamSlots(team) {
  if (!Array.isArray(team)) return { ok: false, error: 'INVALID_TEAMS' };
  for (let i = 0; i < team.length; i++) {
    const s = team[i];
    const id = s?.user_unit_id;
    if (id == null || (typeof id !== 'number' && typeof id !== 'string')) {
      return { ok: false, error: 'INVALID_SLOT', message: `Slot ${i}: user_unit_id requis` };
    }
    const pos = s?.position;
    if (pos !== 'front' && pos !== 'back') {
      return { ok: false, error: 'INVALID_SLOT', message: `Slot ${i}: position doit être "front" ou "back"` };
    }
  }
  return { ok: true };
}

/**
 * Charge les user_units + units depuis la DB pour les ids donnés, pour un user.
 * Construit les objets unité complets et applique le scaling.
 * @param {number} userId
 * @param {Array<{ user_unit_id: number, position: string }>} slots
 * @returns {Promise<Array>} unités prêtes pour simulateBattle
 */
export async function buildTeamFromDb(userId, slots) {
  const ids = slots.map((s) => Number(s.user_unit_id)).filter((n) => Number.isInteger(n) && n > 0);
  if (ids.length === 0) return [];

  const placeholders = ids.map(() => '?').join(',');
  const selectWithFatigueUpdate = `SELECT uu.id AS user_unit_id, uu.level, uu.xp, uu.specialization, uu.power_level, uu.power_openings, uu.fatigue, uu.fatigue_last_update, UNIX_TIMESTAMP(uu.fatigue_last_update) AS fatigue_last_update_ts, uu.injury_level, uu.is_injured,
    uu.basic_targeting, uu.skill_targeting,
    u.id AS unit_id, u.code, u.name, u.rarity, u.role, u.attack_type, u.element, u.archetype, u.image_url,
    u.base_hp, u.base_attack, u.base_defense, u.base_speed, u.mastery, u.traits, u.skill_data,
    u.specA_bonus_stat, u.specB_bonus_stat, u.specA_skill_modifier, u.specB_skill_modifier, u.specA_passive, u.specB_passive
    FROM user_units uu JOIN units u ON u.id = uu.unit_id WHERE uu.id IN (${placeholders}) AND uu.user_id = ?`;
  const selectWithoutFatigueUpdate = `SELECT uu.id AS user_unit_id, uu.level, uu.xp, uu.specialization, uu.power_level, uu.power_openings, uu.fatigue, uu.injury_level, uu.is_injured,
    uu.basic_targeting, uu.skill_targeting,
    u.id AS unit_id, u.code, u.name, u.rarity, u.role, u.attack_type, u.element, u.archetype, u.image_url,
    u.base_hp, u.base_attack, u.base_defense, u.base_speed, u.mastery, u.traits, u.skill_data,
    u.specA_bonus_stat, u.specB_bonus_stat, u.specA_skill_modifier, u.specB_skill_modifier, u.specA_passive, u.specB_passive
    FROM user_units uu JOIN units u ON u.id = uu.unit_id WHERE uu.id IN (${placeholders}) AND uu.user_id = ?`;
  const selectWithoutTargeting = `SELECT uu.id AS user_unit_id, uu.level, uu.xp, uu.specialization, uu.power_level, uu.power_openings, uu.fatigue, uu.injury_level, uu.is_injured,
    u.id AS unit_id, u.code, u.name, u.rarity, u.role, u.attack_type, u.element, u.archetype, u.image_url,
    u.base_hp, u.base_attack, u.base_defense, u.base_speed, u.mastery, u.traits, u.skill_data,
    u.specA_bonus_stat, u.specB_bonus_stat, u.specA_skill_modifier, u.specB_skill_modifier, u.specA_passive, u.specB_passive
    FROM user_units uu JOIN units u ON u.id = uu.unit_id WHERE uu.id IN (${placeholders}) AND uu.user_id = ?`;
  const params = [...ids, userId];
  let rows;
  let hasFatigueLastUpdate = false;
  let hasTargeting = true;
  try {
    rows = await query(selectWithFatigueUpdate, params);
    hasFatigueLastUpdate = true;
  } catch (err) {
    const msg = (err?.message || '').toString();
    if (msg.includes('fatigue_last_update') || err?.code === 'ER_BAD_FIELD_ERROR') {
      try {
        rows = await query(selectWithoutFatigueUpdate, params);
      } catch (e2) {
        if (e2?.code === 'ER_BAD_FIELD_ERROR' || (e2?.message || '').includes('basic_targeting') || (e2?.message || '').includes('skill_targeting')) {
          hasTargeting = false;
          rows = await query(selectWithoutTargeting, params);
        } else {
          throw e2;
        }
      }
      if (msg.includes('fatigue_last_update')) hasFatigueLastUpdate = false;
    } else {
      throw err;
    }
  }

  const byId = new Map(rows.map((r) => [Number(r.user_unit_id), r]));
  const equippedArtifactsByUnit = await getEquippedArtifactsForUnitIds(userId, Array.from(byId.keys()));

  /** Log debug temporaire fatigue (à retirer en prod si besoin). */
  function logFatigueRecalculated(id, oldVal, minutesPassed, newVal) {
    console.log('Fatigue recalculated:', { id, old: oldVal, minutesPassed, new: newVal });
  }

  const result = [];
  for (const slot of slots) {
    const userUnitId = Number(slot.user_unit_id);
    const row = byId.get(userUnitId);
    if (!row) continue;

    let fatigue;
    if (hasFatigueLastUpdate) {
      const computed = computeCurrentFatigue({
        fatigue: row.fatigue ?? 0,
        fatigue_last_update: row.fatigue_last_update,
        fatigue_last_update_ts: row.fatigue_last_update_ts
      });
      fatigue = computed.fatigue;
      if (computed.minutesPassed > 0) {
        await query(
          'UPDATE user_units SET fatigue=?, fatigue_last_update=NOW() WHERE id=?',
          [fatigue, row.user_unit_id]
        );
        logFatigueRecalculated(row.user_unit_id, row.fatigue, computed.minutesPassed, fatigue);
      } else if (row.fatigue_last_update == null) {
        /* Anciennes unités : initialiser fatigue_last_update pour que le décrement -1/min fonctionne */
        await query('UPDATE user_units SET fatigue_last_update=NOW() WHERE id=?', [row.user_unit_id]);
      }
    } else {
      fatigue = row.fatigue ?? 0;
    }
    const unit = {
      id: row.user_unit_id,
      user_unit_id: row.user_unit_id,
      position: slot.position === 'front' ? 'front' : 'back',
      rangeType: row.attack_type === 'melee' ? 'melee' : 'ranged',
      name: row.name,
      code: row.code,
      rarity: row.rarity,
      element: row.element,
      archetype: row.archetype,
      image_url: row.image_url ?? null,
      role: row.role,
      base_hp: row.base_hp,
      base_attack: row.base_attack,
      base_defense: row.base_defense,
      base_speed: row.base_speed,
      mastery: row.mastery ?? 0,
      level: row.level ?? 1,
      specialization: row.specialization ?? null,
      power_level: row.power_level ?? 1,
      power_openings: row.power_openings ?? 1,
      fatigue,
      injury_level: row.injury_level ?? 0,
      is_injured: row.is_injured ?? 0,
      traits: parseJson(row.traits),
      skill_data: parseJson(row.skill_data),
      skillData: parseJson(row.skill_data),
      specA_bonus_stat: row.specA_bonus_stat ?? null,
      specB_bonus_stat: row.specB_bonus_stat ?? null,
      specA_skill_modifier: parseJson(row.specA_skill_modifier) ?? null,
      specB_skill_modifier: parseJson(row.specB_skill_modifier) ?? null,
      specA_passive: row.specA_passive ?? null,
      specB_passive: row.specB_passive ?? null,
      basic_targeting: hasTargeting && row.basic_targeting != null ? String(row.basic_targeting).trim() || 'NO_FOCUS' : 'NO_FOCUS',
      skill_targeting: hasTargeting && row.skill_targeting != null ? String(row.skill_targeting).trim() || 'NO_FOCUS' : 'NO_FOCUS'
    };

    const spec = unit.specialization != null && String(unit.specialization).trim() !== '' ? String(unit.specialization).toUpperCase() : null;
    if (spec === 'A' && unit.specA_skill_modifier && typeof unit.specA_skill_modifier === 'object') {
      unit.skill_data = applySpecModifier(unit.skill_data, unit.specA_skill_modifier);
      unit.skillData = unit.skill_data;
    } else if (spec === 'B' && unit.specB_skill_modifier && typeof unit.specB_skill_modifier === 'object') {
      unit.skill_data = applySpecModifier(unit.skill_data, unit.specB_skill_modifier);
      unit.skillData = unit.skill_data;
    }
    if (isRarityAtLeast(unit.rarity, 'Rare') && spec) {
      unit.specPassive = spec === 'A' ? unit.specA_passive : unit.specB_passive;
    }

    const userUnit = { level: unit.level, specialization: unit.specialization, power_level: unit.power_level };
    const stats = computeScaledStats(unit, userUnit);
    unit.maxHp = stats.maxHp;
    unit.attack = stats.attack;
    unit.defense = stats.defense;
    unit.speed = stats.speed;
    unit.mastery = stats.mastery;
    unit.equipped_artifacts = equippedArtifactsByUnit.get(Number(unit.user_unit_id)) || [];
    applyArtifactBonusesToUnit(unit, unit.equipped_artifacts);

    result.push(unit);
  }

  return result;
}
