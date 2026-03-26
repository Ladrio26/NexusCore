import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { query, getPool } from '../config/db.js';

const MAX_UNIT_IMAGE_SIZE = 10 * 1024 * 1024; // 10 Mo
const ALLOWED_IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/jpg']);
const UPLOADS_UNITS_DIR = path.join(process.cwd(), 'uploads', 'units');
const PERSONNAGES_DIR = path.join(process.cwd(), '..', 'personnages');
const ALLOWED_NOYAU_STATS = new Set(['maxHp', 'attack', 'defense', 'speed', 'mastery']);
import {
  SUPPORTED_EFFECTS,
  VALID_TARGETS,
  BUFF_TYPES,
  DEBUFF_TYPES,
  STEALABLE_STATS,
  SUPPORTED_TRIGGERS,
  BUFF_FIXED_VALUES,
  BUFF_FIXED_LABELS,
  PASSIVE_KINDS_PERMANENT
} from '../config/supportedEffects.js';
import { ARTIFACT_STAT_KEYS, ARTIFACT_STAT_LABELS_FR } from '../../../core/artifacts.js';

/** Normalise le flag boss depuis le payload admin (booléen, 0/1, chaîne). */
export function normalizeIsBoss(payload) {
  const v = payload?.is_boss;
  if (v === true || v === 1 || v === '1') return true;
  if (v === false || v === 0 || v === '0' || v == null || v === '') return false;
  if (typeof v === 'string' && v.trim().toLowerCase() === 'true') return true;
  return Boolean(v);
}

function validateUnit(payload) {
  const errors = [];
  const u = payload || {};

  if (typeof u.name !== 'string' || !u.name.trim()) {
    errors.push('name requis et non vide');
  }
  const rarityEnum = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
  if (!rarityEnum.includes(u.rarity)) {
    errors.push(`rarity doit être l'un de: ${rarityEnum.join(', ')}`);
  }
  const roleEnum = ['support', 'tank', 'assassin', 'ranged'];
  if (!roleEnum.includes(u.role)) {
    errors.push(`role doit être l'un de: ${roleEnum.join(', ')}`);
  }
  const attackTypeEnum = ['melee', 'ranged'];
  if (!attackTypeEnum.includes(u.attack_type)) {
    errors.push(`attack_type doit être l'un de: ${attackTypeEnum.join(', ')}`);
  }
  const elementEnum = ['water', 'fire', 'plant', 'light', 'dark'];
  if (!elementEnum.includes(u.element)) {
    errors.push(`element doit être l'un de: ${elementEnum.join(', ')}`);
  }
  const archetypeEnum = ['CAC_TANK', 'CAC_DPS', 'DISTANCE'];
  if (!archetypeEnum.includes(u.archetype)) {
    errors.push(`archetype doit être l'un de: ${archetypeEnum.join(', ')}`);
  }

  if (u.is_boss != null && u.is_boss !== '') {
    const ok =
      typeof u.is_boss === 'boolean' ||
      u.is_boss === 0 ||
      u.is_boss === 1 ||
      u.is_boss === '0' ||
      u.is_boss === '1' ||
      (typeof u.is_boss === 'string' && ['true', 'false'].includes(String(u.is_boss).trim().toLowerCase()));
    if (!ok) {
      errors.push('is_boss doit être un booléen (ou 0/1)');
    }
  }

  const stats = ['base_hp', 'base_attack', 'base_defense', 'base_speed', 'mastery'];
  for (const s of stats) {
    const v = u[s];
    if (v == null || typeof v !== 'number' || v < 0) {
      errors.push(`${s} doit être un nombre >= 0`);
    }
  }

  if (u.noyau != null) {
    if (typeof u.noyau !== 'object') {
      errors.push('noyau doit être un objet');
    } else {
      const description = String(u.noyau.description ?? '').trim();
      const effects = Array.isArray(u.noyau.effects) ? u.noyau.effects : [];
      if (!description) {
        errors.push('noyau.description requis');
      }
      if (effects.length !== 1) {
        errors.push('noyau.effects doit contenir exactement un bonus');
      } else {
        const effect = effects[0] || {};
        if (!ALLOWED_NOYAU_STATS.has(String(effect.stat ?? ''))) {
          errors.push(`noyau.effects[0].stat doit être l'un de: ${Array.from(ALLOWED_NOYAU_STATS).join(', ')}`);
        }
        const percent = Number(effect.percent);
        if (!Number.isFinite(percent) || percent <= 0) {
          errors.push('noyau.effects[0].percent doit être > 0');
        }
      }
    }
  }

  function validateEffects(effects, prefix) {
    if (!Array.isArray(effects) || effects.length === 0) {
      errors.push(`${prefix}: effects doit être un tableau non vide`);
      return;
    }
    for (let i = 0; i < effects.length; i++) {
      const eff = effects[i];
      const type = (eff?.type ?? '').toString().toUpperCase().trim();
      const schema = SUPPORTED_EFFECTS[type];
      if (!schema) {
        errors.push(`${prefix}.effet[${i}]: type "${type}" non supporté`);
        continue;
      }
      const knownForType = new Set([
        'type',
        ...(schema.requiredOneOf || []),
        ...(schema.required || []),
        ...(schema.optional || [])
      ]);
      for (const key of Object.keys(eff)) {
        const k = key.toLowerCase();
        if (!knownForType.has(key) && !knownForType.has(k)) {
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('Champ effet non reconnu:', key, `(${prefix}.effet[${i}])`);
          }
        }
      }
      if (schema.requiredOneOf && !schema.requiredOneOf.some((k) => eff[k] != null)) {
        errors.push(`${prefix}.effet[${i}]: au moins un de [${schema.requiredOneOf.join(', ')}] requis`);
      }
      for (const req of schema.required || []) {
        if (eff[req] == null) {
          errors.push(`${prefix}.effet[${i}]: "${req}" requis`);
        }
      }
      if (eff.target != null && !VALID_TARGETS.includes((eff.target ?? '').toString().toUpperCase())) {
        errors.push(`${prefix}.effet[${i}]: target invalide`);
      }
      if (type === 'APPLY_BUFF') {
        if (eff.buffType != null && !BUFF_TYPES.includes((eff.buffType ?? '').toString().toUpperCase())) {
          errors.push(`${prefix}.effet[${i}]: buffType invalide`);
        }
        const buffTypeUpper = (eff.buffType ?? '').toString().toUpperCase();
        const buffHasScale = eff.scaleFromEffectIndex != null && eff.scaleFromEffectIndex !== '';
        const validateBuffScale = () => {
          const sidx = Number(eff.scaleFromEffectIndex);
          if (!Number.isInteger(sidx) || sidx < 0) {
            errors.push(`${prefix}.effet[${i}]: scaleFromEffectIndex doit être un entier >= 0 (effet précédent)`);
          } else if (sidx >= i) {
            errors.push(`${prefix}.effet[${i}]: scaleFromEffectIndex doit être strictement inférieur à l'index de cet effet (ici < ${i})`);
          }
          const vpr = Number(eff.valuePerRemoved);
          if (!Number.isFinite(vpr) || vpr < 0) {
            errors.push(`${prefix}.effet[${i}]: valuePerRemoved requis (nombre >= 0 ; flat PV/bouclier/regen, stacks DOT, tours ANTI_BUFF)`);
          }
        };
        if (buffTypeUpper === 'SHIELD') {
          const hasAmt = eff.value != null || eff.percentMaxHp != null || eff.percentMaxHpCaster != null;
          if (!hasAmt && !buffHasScale) {
            errors.push(`${prefix}.effet[${i}]: SHIELD — value (ou % PV) ou chaînage scaleFromEffectIndex + valuePerRemoved`);
          }
          if (buffHasScale) validateBuffScale();
        } else if (buffTypeUpper === 'REGEN') {
          const hasAmt = eff.value != null || eff.percentMaxHp != null || eff.percentMaxHpCaster != null;
          if (!hasAmt && !buffHasScale) {
            errors.push(`${prefix}.effet[${i}]: REGEN — value (ou % PV) ou chaînage scaleFromEffectIndex + valuePerRemoved`);
          }
          if (buffHasScale) validateBuffScale();
        } else if (buffTypeUpper === 'DOT' || buffTypeUpper === 'ANTI_BUFF') {
          if (buffHasScale) validateBuffScale();
        } else if (BUFF_FIXED_VALUES[buffTypeUpper] != null) {
          if (eff.value != null || eff.percentMaxHp != null || eff.percentMaxHpCaster != null) {
            errors.push(`${prefix}.effet[${i}]: value/percentMaxHp/percentMaxHpCaster non autorisés pour ce buff (valeur fixe)`);
          }
          if (buffHasScale) {
            errors.push(`${prefix}.effet[${i}]: chaînage scale non supporté pour ce buffType (utiliser SHIELD/REGEN/DOT/ANTI_BUFF)`);
          }
        }
      }
      if (type === 'APPLY_DEBUFF' && eff.debuffType != null && !DEBUFF_TYPES.includes((eff.debuffType ?? '').toString().toUpperCase())) {
        errors.push(`${prefix}.effet[${i}]: debuffType invalide`);
      }
      if (type === 'STEAL_STAT') {
        const stat = String(eff.stat ?? '').trim().toLowerCase();
        if (!STEALABLE_STATS.includes(stat)) {
          errors.push(`${prefix}.effet[${i}]: stat invalide. Valeurs: ${STEALABLE_STATS.join(', ')}`);
        }
        const percent = Number(eff.percent);
        if (!Number.isFinite(percent) || percent <= 0) {
          errors.push(`${prefix}.effet[${i}]: percent doit être > 0`);
        }
      }
      if (type === 'CD_UP' || type === 'CD_DOWN') {
        const v = Number(eff.value);
        if (!Number.isFinite(v) || v < 1 || Math.floor(v) !== v) {
          errors.push(`${prefix}.effet[${i}]: value doit être un entier >= 1 (tours de CD)`);
        }
      }
      if (eff.chance != null && eff.chance !== '') {
        const c = Number(eff.chance);
        if (!Number.isFinite(c) || c < 0) {
          errors.push(`${prefix}.effet[${i}]: chance invalide (nombre >= 0, ex. 0.25 ou 25 pour 25%)`);
        }
      }
      if (type === 'ATB_UP' || type === 'REDUCE_ATB') {
        const hasScale = eff.scaleFromEffectIndex != null && eff.scaleFromEffectIndex !== '';
        const pctRaw = eff.percent ?? eff.value;
        const hasBase = pctRaw != null && pctRaw !== '' && Number.isFinite(Number(pctRaw));
        if (!hasScale && !hasBase) {
          errors.push(`${prefix}.effet[${i}]: ${type} — renseigner au moins "percent" (fixe, peut être 0) ou scaleFromEffectIndex + percentPerRemoved`);
        }
        if (hasScale) {
          const sidx = Number(eff.scaleFromEffectIndex);
          if (!Number.isInteger(sidx) || sidx < 0) {
            errors.push(`${prefix}.effet[${i}]: scaleFromEffectIndex doit être un entier >= 0 (effet précédent)`);
          }
          if (sidx >= i) {
            errors.push(`${prefix}.effet[${i}]: scaleFromEffectIndex doit être strictement inférieur à l'index de cet effet (ici < ${i})`);
          }
          const ppr = Number(eff.percentPerRemoved);
          if (!Number.isFinite(ppr) || ppr < 0) {
            errors.push(`${prefix}.effet[${i}]: percentPerRemoved requis (nombre >= 0, ex. 0.05 ou 5 pour 5% barre ATB par unité de métrique)`);
          }
        }
      }
      if (type === 'HEAL') {
        const hasScale = eff.scaleFromEffectIndex != null && eff.scaleFromEffectIndex !== '';
        const hasBase = eff.value != null || eff.percentMaxHp != null || eff.percentMaxHpCaster != null;
        if (!hasBase && !hasScale) {
          errors.push(`${prefix}.effet[${i}]: HEAL — value / percentMaxHp / percentMaxHpCaster ou chaînage scaleFromEffectIndex`);
        }
        if (hasScale) {
          const sidx = Number(eff.scaleFromEffectIndex);
          if (!Number.isInteger(sidx) || sidx < 0) {
            errors.push(`${prefix}.effet[${i}]: scaleFromEffectIndex invalide`);
          } else if (sidx >= i) {
            errors.push(`${prefix}.effet[${i}]: scaleFromEffectIndex doit être < ${i}`);
          }
          const vpr = Number(eff.valuePerRemoved);
          if (!Number.isFinite(vpr) || vpr < 0) {
            errors.push(`${prefix}.effet[${i}]: valuePerRemoved requis (>= 0, PV soignés par unité retirée)`);
          }
        }
      }
      if (type === 'DAMAGE') {
        const hasScale = eff.scaleFromEffectIndex != null && eff.scaleFromEffectIndex !== '';
        const hasBase = eff.mult != null || eff.percentMaxHp != null || eff.percentMaxHpCaster != null;
        if (!hasBase && !hasScale) {
          errors.push(`${prefix}.effet[${i}]: DAMAGE — mult / percentMaxHp / percentMaxHpCaster ou chaînage scaleFromEffectIndex`);
        }
        if (hasScale) {
          const sidx = Number(eff.scaleFromEffectIndex);
          if (!Number.isInteger(sidx) || sidx < 0) {
            errors.push(`${prefix}.effet[${i}]: scaleFromEffectIndex invalide`);
          } else if (sidx >= i) {
            errors.push(`${prefix}.effet[${i}]: scaleFromEffectIndex doit être < ${i}`);
          }
          const vpr = Number(eff.valuePerRemoved);
          if (!Number.isFinite(vpr) || vpr < 0) {
            errors.push(`${prefix}.effet[${i}]: valuePerRemoved requis (>= 0, dégâts plats bonus par unité de métrique)`);
          }
        }
      }
    }
  }

  let skills = u.skills;
  if (!Array.isArray(skills)) {
    if (u.skill || Array.isArray(u.passives)) {
      skills = normalizeSkillsPayload({ skill: u.skill, passives: u.passives, description: u.skill?.description });
    } else {
      errors.push('skills doit être un tableau');
    }
  }
  if (Array.isArray(skills)) {
    for (let i = 0; i < skills.length; i++) {
      const s = skills[i];
      if (!s || typeof s !== 'object') {
        errors.push(`skills[${i}]: objet requis`);
        continue;
      }
      const stype = (s.type ?? '').toString().toUpperCase().trim();
      if (stype !== 'ACTIVE' && stype !== 'PASSIVE') {
        errors.push(`skills[${i}]: type doit être ACTIVE ou PASSIVE`);
      }
      if (stype === 'ACTIVE') {
        const cd = s.cd_actions;
        if (cd != null && (typeof cd !== 'number' || cd < 0)) {
          errors.push(`skills[${i}]: cd_actions doit être >= 0`);
        }
      }
      let skipEffectsValidation = false;
      if (stype === 'PASSIVE') {
        const pKind = (s.passiveKind ?? '').toString().toUpperCase().trim();
        const legacyPermanent = s.permanentDebuffImmunity === true || s.immuneToAllDebuffs === true;
        const permanentPassive =
          (pKind && PASSIVE_KINDS_PERMANENT.includes(pKind)) || legacyPermanent;
        if (permanentPassive) {
          if (pKind && !PASSIVE_KINDS_PERMANENT.includes(pKind) && !legacyPermanent) {
            errors.push(`skills[${i}]: passiveKind permanent inconnu. Valeurs: ${PASSIVE_KINDS_PERMANENT.join(', ')}`);
          }
          if (pKind === 'STEEL') {
            const v = Number(s.value);
            if (!Number.isFinite(v) || v < 0) {
              errors.push(`skills[${i}]: passiveKind STEEL requiert value >= 0 (pourcentage de réduction, ex. 15 ou 0.15)`);
            }
          }
          if (pKind === 'MULTI_HIT_SHIELD') {
            const v = Number(s.value);
            if (!Number.isFinite(v) || v < 1 || Math.floor(v) !== v) {
              errors.push(`skills[${i}]: passiveKind MULTI_HIT_SHIELD requiert value entier >= 1 (nombre de coups absorbés)`);
            }
          }
          skipEffectsValidation = !Array.isArray(s.effects) || s.effects.length === 0;
        } else {
          const trigger = (s.trigger ?? '').toString().toUpperCase().trim();
          if (!trigger) {
            errors.push(`skills[${i}]: trigger requis pour PASSIVE (ou passiveKind permanent dans ${PASSIVE_KINDS_PERMANENT.join(', ')})`);
          } else if (!SUPPORTED_TRIGGERS.includes(trigger)) {
            errors.push(`skills[${i}]: trigger invalide. Valeurs: ${SUPPORTED_TRIGGERS.join(', ')}`);
          }
        }
        if (s.cooldown != null && (typeof s.cooldown !== 'number' || s.cooldown < 0)) {
          errors.push(`skills[${i}]: cooldown doit être >= 0`);
        }
      }
      if (!skipEffectsValidation) {
        validateEffects(s.effects, `skills[${i}]`);
      }
    }
    const skillIds = new Set((skills || []).map((s) => (s?.id ?? '').toString().trim()).filter(Boolean));
    for (const specKey of ['specA_skill_modifier', 'specB_skill_modifier']) {
      const spec = u[specKey];
      if (!spec || typeof spec !== 'object') continue;
      const targetId = (spec.targetSkillId ?? '').toString().trim();
      const modify = spec.modify && typeof spec.modify === 'object' ? spec.modify : null;
      const hasContent = modify && (
        (Array.isArray(modify.effects) && modify.effects.length > 0) ||
        typeof modify.cd_actions === 'number' ||
        typeof modify.cooldown === 'number' ||
        (typeof modify.trigger === 'string' && modify.trigger.trim())
      );
      if (hasContent && targetId && !skillIds.has(targetId)) {
        errors.push(`${specKey}: targetSkillId "${targetId}" ne correspond à aucune compétence`);
      }
      if (modify && Array.isArray(modify.effects) && modify.effects.length > 0) {
        validateEffects(modify.effects, `${specKey}.modify`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

function generateSkillId() {
  return `skill_${Math.random().toString(36).slice(2, 10)}`;
}

/** S'assure que chaque skill a un id unique. */
function ensureSkillIds(skills) {
  if (!Array.isArray(skills)) return skills;
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
  return skills;
}

/** Convertit l'ancien format (skill + passives) en skills[]. */
function normalizeSkillsPayload(skillData) {
  if (!skillData || typeof skillData !== 'object') return [];
  if (Array.isArray(skillData.skills) && skillData.skills.length > 0) return skillData.skills;
  const out = [];
  const skill = skillData.skill ?? skillData;
  if (skill && typeof skill === 'object' && (Array.isArray(skill.effects) || skill.cd_actions != null)) {
    out.push({
      id: generateSkillId(),
      type: 'ACTIVE',
      cd_actions: Math.max(0, Number(skill.cd_actions ?? 0)),
      description: skillData.description?.skill ?? '',
      effects: Array.isArray(skill.effects) ? skill.effects : []
    });
  }
  const rawPassives = Array.isArray(skillData.passives) ? skillData.passives : (Array.isArray(skill?.passives) ? skill.passives : []);
  for (const p of rawPassives) {
    if (!p || typeof p !== 'object') continue;
    const pKind = (p.passiveKind ?? '').toString().toUpperCase().trim();
    if (pKind === 'DEBUFF_IMMUNITY' || p.permanentDebuffImmunity === true || p.immuneToAllDebuffs === true) {
      out.push({
        id: generateSkillId(),
        type: 'PASSIVE',
        passiveKind: 'DEBUFF_IMMUNITY',
        effects: Array.isArray(p.effects) ? p.effects : (p.effect ? [p.effect] : [])
      });
      continue;
    }
    if (pKind === 'STEEL' || pKind === 'MULTI_HIT_SHIELD') {
      const val = p.value != null ? Number(p.value) : NaN;
      out.push({
        id: generateSkillId(),
        type: 'PASSIVE',
        passiveKind: pKind,
        value: Number.isFinite(val) ? val : 0,
        effects: []
      });
      continue;
    }
    const trigger = (p.trigger ?? p.type ?? '').toString().toUpperCase().trim();
    if (!trigger || !SUPPORTED_TRIGGERS.includes(trigger)) continue;
    out.push({
      id: generateSkillId(),
      type: 'PASSIVE',
      trigger,
      cooldown: typeof p.cooldown === 'number' ? p.cooldown : (p.cd_actions ?? 0),
      effects: Array.isArray(p.effects) ? p.effects : (p.effect ? [p.effect] : [])
    });
  }
  return out;
}

/** Migration legacy : type SHIELD → APPLY_BUFF avec buffType SHIELD. */
function normalizeEffectLegacy(e) {
  if (!e || typeof e !== 'object') return e;
  const type = (e.type ?? '').toString().toUpperCase().trim();
  if (type === 'SHIELD') {
    return {
      type: 'APPLY_BUFF',
      buffType: 'SHIELD',
      value: e.value,
      percentMaxHp: e.percentMaxHp,
      percentMaxHpCaster: e.percentMaxHpCaster,
      target: e.target,
      remainingActions: e.remainingActions ?? e.duration ?? 1
    };
  }
  return e;
}

/** Applique la migration legacy sur skill_data (pour réponses API). */
function normalizeSkillDataLegacy(skillData) {
  if (!skillData || !Array.isArray(skillData.skills)) return skillData;
  const out = { ...skillData, skills: skillData.skills.map((s) => ({ ...s, effects: Array.isArray(s.effects) ? s.effects.map(normalizeEffectLegacy) : (s.effects || []) })) };
  return out;
}

/** Buffs standard : supprime value/percentMaxHp/percentMaxHpCaster (valeur fixe côté moteur). Cleanup legacy. */
function normalizeApplyBuffStandard(e) {
  if (!e || (e.type ?? '').toString().toUpperCase() !== 'APPLY_BUFF') return e;
  const buffType = (e.buffType ?? '').toString().toUpperCase();
  if (buffType === 'SHIELD') return e;
  if (BUFF_FIXED_VALUES[buffType] == null) return e;
  const { value, percentMaxHp, percentMaxHpCaster, ...rest } = e;
  if (value != null || percentMaxHp != null || percentMaxHpCaster != null) {
    if (typeof console !== 'undefined' && console.warn) console.warn('APPLY_BUFF legacy: value/percent ignorés pour', buffType, ', valeur fixe utilisée');
  }
  return rest;
}

function buildSkillData(payload) {
  const u = payload || {};
  const description = u.description || {};
  let skills = Array.isArray(u.skills) ? u.skills.map((s) => (s && typeof s === 'object' ? { ...s } : s)) : null;
  if (!skills || skills.length === 0) {
    skills = normalizeSkillsPayload({ skill: u.skill, passives: u.passives, description: u.skill?.description });
  }
  if (!skills || skills.length === 0) {
    skills = [{ id: generateSkillId(), type: 'ACTIVE', cd_actions: 0, effects: [] }];
  }
  for (const s of skills) {
    if (Array.isArray(s.effects)) {
      s.effects = s.effects.map(normalizeEffectLegacy).map(normalizeApplyBuffStandard);
    }
  }
  ensureSkillIds(skills);
  const noyau = u.noyau && typeof u.noyau === 'object'
    ? {
        description: String(u.noyau.description ?? '').trim(),
        effects: Array.isArray(u.noyau.effects)
          ? u.noyau.effects
            .map((effect) => ({
              stat: String(effect?.stat ?? '').trim(),
              percent: Number(effect?.percent ?? 0)
            }))
            .filter((effect) => ALLOWED_NOYAU_STATS.has(effect.stat) && Number.isFinite(effect.percent) && effect.percent > 0)
          : []
      }
    : null;
  const out = {
    skills,
    description: {
      skill: description.skill ?? '',
      specA: description.specA ?? '',
      specB: description.specB ?? ''
    }
  };
  if (noyau && noyau.description && noyau.effects.length > 0) {
    out.noyau = noyau;
  }
  return out;
}

export function registerAdminRoutes(fastify, authenticate, requireAdminUser) {
  const preAdmin = [authenticate, requireAdminUser];

  const parseJson = (v) => {
    if (v == null) return null;
    if (typeof v === 'object') return v;
    if (typeof v !== 'string') return v;
    try {
      return JSON.parse(v);
    } catch {
      return null;
    }
  };

  async function getAdminUserById(id) {
    const rows = await query(
      `SELECT u.id, u.email, u.display_name, u.elo, u.pvp_elo, u.avatar_url, u.last_login_at, u.last_opponent_id,
              COALESCE(w.credits, 0) AS credits,
              COALESCE(w.cores, 0) AS cores,
              COALESCE(w.fragments, 0) AS fragments,
              COALESCE(w.ascension_essence, 0) AS ascension_essence,
              COALESCE(w.gold, 0) AS gold,
              COALESCE(gc.guild_coins, 0) AS guild_coins
       FROM users u
       LEFT JOIN user_wallet w ON w.user_id = u.id
       LEFT JOIN guild_currencies gc ON gc.user_id = u.id
       WHERE u.id = ?`,
      [id]
    );
    const r = rows[0];
    if (!r) return null;
    return {
      id: r.id,
      email: r.email ?? '',
      display_name: r.display_name ?? '',
      elo: Number(r.elo ?? 0),
      pvp_elo: Number(r.pvp_elo ?? 0),
      avatar_url: r.avatar_url ?? null,
      last_login_at: r.last_login_at ?? null,
      last_opponent_id: r.last_opponent_id != null ? Number(r.last_opponent_id) : null,
      wallet: {
        credits: Number(r.credits ?? 0),
        cores: Number(r.cores ?? 0),
        fragments: Number(r.fragments ?? 0),
        ascension_essence: Number(r.ascension_essence ?? 0),
        gold: Number(r.gold ?? 0)
      },
      guild_coins: Number(r.guild_coins ?? 0)
    };
  }

  async function getAdminArtifactsByUserId(userId) {
    const userRows = await query('SELECT id, display_name FROM users WHERE id = ?', [userId]);
    if (!userRows.length) return null;

    await getPool().execute(
      `INSERT INTO user_wallet (user_id, credits, cores, fragments, ascension_essence, gold)
       VALUES (?, 0, 0, 0, 0, 0)
       ON DUPLICATE KEY UPDATE user_id = VALUES(user_id)`,
      [userId]
    );

    const [walletRows, unitRows, artifactRows] = await Promise.all([
      query('SELECT gold FROM user_wallet WHERE user_id = ? LIMIT 1', [userId]),
      query(
        `SELECT uu.id AS user_unit_id, uu.level, u.name
         FROM user_units uu
         JOIN units u ON u.id = uu.unit_id
         WHERE uu.user_id = ?
         ORDER BY u.name ASC, uu.id ASC`,
        [userId]
      ),
      query(
        `SELECT ua.id, ua.user_id, ua.stat_key, ua.level, ua.equipped_user_unit_id, ua.created_at,
                u.name AS equipped_unit_name
         FROM user_artifacts ua
         LEFT JOIN user_units uu ON uu.id = ua.equipped_user_unit_id
         LEFT JOIN units u ON u.id = uu.unit_id
         WHERE ua.user_id = ?
         ORDER BY ua.level DESC, ua.stat_key ASC, ua.id ASC`,
        [userId]
      )
    ]);

    return {
      player: {
        id: Number(userRows[0].id),
        display_name: userRows[0].display_name || `User ${userId}`
      },
      wallet: {
        gold: Number(walletRows[0]?.gold ?? 0)
      },
      units: unitRows.map((row) => ({
        user_unit_id: Number(row.user_unit_id),
        name: row.name,
        level: Number(row.level ?? 1)
      })),
      stat_keys: ARTIFACT_STAT_KEYS.map((key) => ({
        key,
        label: ARTIFACT_STAT_LABELS_FR[key] || key
      })),
      artifacts: artifactRows.map((row) => ({
        id: Number(row.id),
        stat_key: String(row.stat_key),
        stat_label: ARTIFACT_STAT_LABELS_FR[String(row.stat_key)] || String(row.stat_key),
        level: Number(row.level ?? 0),
        equipped_user_unit_id: row.equipped_user_unit_id != null ? Number(row.equipped_user_unit_id) : null,
        equipped_unit_name: row.equipped_unit_name ?? null,
        created_at: row.created_at ?? null
      }))
    };
  }

  async function validateArtifactEquipTarget(runQuery, userId, artifactId, statKey, equippedUserUnitId) {
    if (equippedUserUnitId == null) return;
    const unitRows = await runQuery(
      'SELECT id FROM user_units WHERE id = ? AND user_id = ? LIMIT 1',
      [equippedUserUnitId, userId]
    );
    if (!unitRows.length) {
      throw new Error('USER_UNIT_NOT_FOUND');
    }
    const equippedRows = await runQuery(
      `SELECT id, stat_key
       FROM user_artifacts
       WHERE user_id = ? AND equipped_user_unit_id = ? AND id != ?`,
      [userId, equippedUserUnitId, artifactId]
    );
    if (equippedRows.length >= 2) {
      throw new Error('ARTIFACT_SLOTS_FULL');
    }
    if (equippedRows.some((row) => String(row.stat_key) === String(statKey))) {
      throw new Error('DUPLICATE_ARTIFACT_STAT');
    }
  }

  function normalizePersistedImagePath(value) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed || trimmed.includes('..')) return null;
    if (trimmed.startsWith('/personnages/') && /\.(png|jpe?g|webp|gif)$/i.test(trimmed)) {
      return trimmed;
    }
    if (trimmed.startsWith('/uploads/units/') && /\.(webp|png|jpe?g)$/i.test(trimmed)) {
      return trimmed;
    }
    return null;
  }

  fastify.get(
    '/admin/units',
    { preHandler: preAdmin },
    async (_request, reply) => {
      try {
        const rows = await query(
          `SELECT id, code, name, rarity, role, attack_type, element, archetype,
                  base_hp, base_attack, base_defense, base_speed, mastery, image_url,
                  traits, skill_data, specA_bonus_stat, specB_bonus_stat,
                  specA_skill_modifier, specB_skill_modifier, specA_passive, specB_passive,
                  is_boss
           FROM units
           ORDER BY rarity, name`
        );
        return {
          units: rows.map((r) => ({
            id: r.id,
            code: r.code,
            name: r.name,
            image_url: r.image_url ?? null,
            is_boss: Number(r.is_boss) === 1,
            rarity: r.rarity,
            role: r.role,
            attack_type: r.attack_type,
            element: r.element,
            archetype: r.archetype,
            base_hp: r.base_hp,
            base_attack: r.base_attack,
            base_defense: r.base_defense,
            base_speed: r.base_speed,
            mastery: r.mastery ?? 0,
            traits: parseJson(r.traits),
            skill_data: normalizeSkillDataLegacy(parseJson(r.skill_data)),
            specA_bonus_stat: r.specA_bonus_stat,
            specB_bonus_stat: r.specB_bonus_stat,
            specA_skill_modifier: parseJson(r.specA_skill_modifier),
            specB_skill_modifier: parseJson(r.specB_skill_modifier),
            specA_passive: parseJson(r.specA_passive),
            specB_passive: parseJson(r.specB_passive)
          }))
        };
      } catch (err) {
        fastify.log?.error?.(err, 'Admin list units');
        return reply.code(500).send({ error: 'List failed', message: err.message });
      }
    }
  );

  fastify.get(
    '/admin/effects-schema',
    { preHandler: preAdmin },
    async (_request, reply) => {
      return {
        SUPPORTED_EFFECTS,
        VALID_TARGETS,
        BUFF_TYPES,
        DEBUFF_TYPES,
        STEALABLE_STATS,
        SUPPORTED_TRIGGERS,
        PASSIVE_KINDS_PERMANENT,
        BUFF_FIXED_VALUES,
        BUFF_FIXED_LABELS,
        rarities: ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'],
        roles: ['support', 'tank', 'assassin', 'ranged'],
        elements: ['water', 'fire', 'plant', 'light', 'dark'],
        attack_types: ['melee', 'ranged'],
        archetypes: ['CAC_TANK', 'CAC_DPS', 'DISTANCE'],
        traits: ['GUARDIANS', 'DRUIDS', 'ARCANISTS', 'EXECUTIONERS', 'BERSERKERS', 'TACTICIANS']
      };
    }
  );

  fastify.get(
    '/admin/unit-image-assets',
    { preHandler: preAdmin },
    async (_request, reply) => {
      try {
        const entries = await fs.promises.readdir(PERSONNAGES_DIR, { withFileTypes: true });
        const assets = entries
          .filter((entry) => entry.isFile() && /\.(png|jpe?g|webp|gif)$/i.test(entry.name))
          .map((entry) => ({
            filename: entry.name,
            path: `/personnages/${entry.name}`
          }))
          .sort((a, b) => a.filename.localeCompare(b.filename, 'fr', { sensitivity: 'base' }));
        return { assets };
      } catch (err) {
        fastify.log?.error?.(err, 'Admin list unit-image-assets');
        return reply.code(500).send({ error: 'List failed', message: err.message });
      }
    }
  );

  fastify.post(
    '/admin/validate-unit',
    { preHandler: preAdmin },
    async (request, reply) => {
      const result = validateUnit(request.body || {});
      return result.valid ? { valid: true } : { valid: false, errors: result.errors };
    }
  );

  fastify.post(
    '/admin/create-unit',
    { preHandler: preAdmin },
    async (request, reply) => {
      const payload = request.body || {};
      const result = validateUnit(payload);
      if (!result.valid) {
        return reply.code(400).send({ error: 'Validation failed', errors: result.errors });
      }
      const code = (payload.code || payload.name?.replace(/\s+/g, '_').toUpperCase() || 'CUSTOM_UNIT').slice(0, 64);
      const skillData = buildSkillData(payload);
      const traits = Array.isArray(payload.traits) ? payload.traits : [];
      const isBoss = normalizeIsBoss(payload) ? 1 : 0;
      const sql = `INSERT INTO units (
        code, name, rarity, role, attack_type, element, archetype,
        base_hp, base_attack, base_defense, base_speed, mastery,
        traits, skill_data, image_url,
        specA_bonus_stat, specB_bonus_stat,
        specA_skill_modifier, specB_skill_modifier,
        specA_passive, specB_passive,
        is_boss
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      const params = [
        code,
        payload.name.trim(),
        payload.rarity,
        payload.role,
        payload.attack_type,
        payload.element,
        payload.archetype,
        Number(payload.base_hp),
        Number(payload.base_attack),
        Number(payload.base_defense),
        Number(payload.base_speed),
        Number(payload.mastery ?? 0),
        JSON.stringify(traits),
        JSON.stringify(skillData),
        normalizePersistedImagePath(payload.image_url),
        payload.specA_bonus_stat ?? null,
        payload.specB_bonus_stat ?? null,
        payload.specA_skill_modifier ? JSON.stringify(payload.specA_skill_modifier) : null,
        payload.specB_skill_modifier ? JSON.stringify(payload.specB_skill_modifier) : null,
        payload.specA_passive ? JSON.stringify(payload.specA_passive) : null,
        payload.specB_passive ? JSON.stringify(payload.specB_passive) : null,
        isBoss
      ];
      try {
        const [insertResult] = await getPool().execute(sql, params);
        const id = insertResult?.insertId;
        return { ok: true, id, code };
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          return reply.code(400).send({ error: 'Unit code already exists', errors: ['code déjà utilisé'] });
        }
        fastify.log?.error?.(err, 'Admin create-unit');
        return reply.code(500).send({ error: 'Create failed', message: err.message });
      }
    }
  );

  fastify.put(
    '/admin/units/:id',
    { preHandler: preAdmin },
    async (request, reply) => {
      const id = Number(request.params?.id);
      if (!Number.isInteger(id) || id < 1) {
        return reply.code(400).send({ error: 'Invalid unit id' });
      }
      const payload = request.body || {};
      const result = validateUnit(payload);
      if (!result.valid) {
        return reply.code(400).send({ error: 'Validation failed', errors: result.errors });
      }
      const code = (payload.code || payload.name?.replace(/\s+/g, '_').toUpperCase() || 'CUSTOM_UNIT').slice(0, 64);
      const skillData = buildSkillData(payload);
      const traits = Array.isArray(payload.traits) ? payload.traits : [];
      const isBoss = normalizeIsBoss(payload) ? 1 : 0;
      const sql = `UPDATE units SET
        code = ?, name = ?, rarity = ?, role = ?, attack_type = ?, element = ?, archetype = ?,
        base_hp = ?, base_attack = ?, base_defense = ?, base_speed = ?, mastery = ?,
        traits = ?, skill_data = ?, image_url = ?,
        specA_bonus_stat = ?, specB_bonus_stat = ?,
        specA_skill_modifier = ?, specB_skill_modifier = ?,
        specA_passive = ?, specB_passive = ?,
        is_boss = ?
        WHERE id = ?`;
      const params = [
        code,
        payload.name.trim(),
        payload.rarity,
        payload.role,
        payload.attack_type,
        payload.element,
        payload.archetype,
        Number(payload.base_hp),
        Number(payload.base_attack),
        Number(payload.base_defense),
        Number(payload.base_speed),
        Number(payload.mastery ?? 0),
        JSON.stringify(traits),
        JSON.stringify(skillData),
        normalizePersistedImagePath(payload.image_url),
        payload.specA_bonus_stat ?? null,
        payload.specB_bonus_stat ?? null,
        payload.specA_skill_modifier ? JSON.stringify(payload.specA_skill_modifier) : null,
        payload.specB_skill_modifier ? JSON.stringify(payload.specB_skill_modifier) : null,
        payload.specA_passive ? JSON.stringify(payload.specA_passive ?? null) : null,
        payload.specB_passive ? JSON.stringify(payload.specB_passive ?? null) : null,
        isBoss,
        id
      ];
      try {
        const [resultUpdate] = await getPool().execute(sql, params);
        if (resultUpdate?.affectedRows === 0) {
          return reply.code(404).send({ error: 'Unit not found' });
        }
        return { ok: true, id, code };
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          return reply.code(400).send({ error: 'Unit code already exists', errors: ['code déjà utilisé'] });
        }
        fastify.log?.error?.(err, 'Admin update unit');
        return reply.code(500).send({ error: 'Update failed', message: err.message });
      }
    }
  );

  fastify.delete(
    '/admin/units/:id',
    { preHandler: preAdmin },
    async (request, reply) => {
      const id = Number(request.params?.id);
      if (!Number.isInteger(id) || id < 1) {
        return reply.code(400).send({ error: 'Invalid unit id' });
      }
      try {
        await getPool().execute('DELETE FROM user_units WHERE unit_id = ?', [id]);
        const [result] = await getPool().execute('DELETE FROM units WHERE id = ?', [id]);
        if (result?.affectedRows === 0) {
          return reply.code(404).send({ error: 'Unit not found' });
        }
        return { ok: true, deleted: id };
      } catch (err) {
        fastify.log?.error?.(err, 'Admin delete unit');
        return reply.code(500).send({ error: 'Delete failed', message: err.message });
      }
    }
  );

  // POST /admin/units/:id/image — upload image (multipart OU JSON base64)
  fastify.post(
    '/admin/units/:id/image',
    { preHandler: preAdmin },
    async (request, reply) => {
      const id = Number(request.params?.id);
      if (!Number.isInteger(id) || id < 1) {
        return reply.code(400).send({ error: 'Invalid unit id' });
      }
      const contentType = (request.headers['content-type'] || '').toLowerCase();
      let buffer;

      if (contentType.includes('application/json')) {
        const body = request.body || {};
        let b64 = body.image_base64 || body.imageBase64;
        if (!b64 && typeof body.image === 'string' && body.image.startsWith('data:')) {
          b64 = body.image.replace(/^data:image\/\w+;base64,/, '');
        }
        if (!b64 || typeof b64 !== 'string') {
          return reply.code(400).send({ error: 'NO_IMAGE', message: 'Envoi JSON : image_base64 ou image (data URL) requis.' });
        }
        buffer = Buffer.from(b64, 'base64');
        if (buffer.length > MAX_UNIT_IMAGE_SIZE) {
          return reply.code(400).send({ error: 'FILE_TOO_LARGE', message: 'Taille max. 10 Mo.' });
        }
      } else if (contentType.includes('multipart/form-data')) {
        const filePromise = request.file();
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('TIMEOUT')), 15000);
        });
        let data;
        try {
          data = await Promise.race([filePromise, timeoutPromise]);
        } catch (err) {
          if (err?.message === 'TIMEOUT') {
            return reply.code(408).send({ error: 'TIMEOUT', message: 'Délai dépassé lors de la réception du fichier.' });
          }
          throw err;
        }
        if (!data) {
          return reply.code(400).send({ error: 'NO_FILE', message: 'Aucun fichier envoyé.' });
        }
        const mime = (data.mimetype || '').toLowerCase();
        if (!ALLOWED_IMAGE_MIMES.has(mime)) {
          return reply.code(400).send({ error: 'INVALID_TYPE', message: 'Format accepté : PNG ou JPEG uniquement.' });
        }
        if (typeof data.toBuffer === 'function') {
          buffer = await data.toBuffer();
          if (buffer.length > MAX_UNIT_IMAGE_SIZE) {
            return reply.code(400).send({ error: 'FILE_TOO_LARGE', message: 'Taille max. 10 Mo.' });
          }
        } else {
          let size = 0;
          const chunks = [];
          for await (const chunk of data.file) {
            size += chunk.length;
            if (size > MAX_UNIT_IMAGE_SIZE) {
              return reply.code(400).send({ error: 'FILE_TOO_LARGE', message: 'Taille max. 10 Mo.' });
            }
            chunks.push(chunk);
          }
          buffer = Buffer.concat(chunks);
        }
      } else {
        return reply.code(415).send({
          error: 'NOT_MULTIPART',
          message: 'Content-Type : multipart/form-data ou application/json (image_base64) requis.'
        });
      }

      const [row] = await query('SELECT id, image_url FROM units WHERE id = ?', [id]);
      if (!row) {
        return reply.code(404).send({ error: 'Unit not found' });
      }
      await fs.promises.mkdir(UPLOADS_UNITS_DIR, { recursive: true });
      const filename = `${id}.webp`;
      const filepath = path.join(UPLOADS_UNITS_DIR, filename);
      try {
        await sharp(buffer)
          .rotate()
          .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 85 })
          .toFile(filepath);
      } catch (err) {
        return reply.code(400).send({ error: 'IMAGE_PROCESSING_FAILED', message: err?.message || 'Image invalide ou illisible.' });
      }
      const imageUrl = `/uploads/units/${filename}`;
      const oldUrl = row?.image_url;
      if (oldUrl && oldUrl.startsWith('/uploads/units/') && path.basename(oldUrl) !== filename) {
        const oldPath = path.join(UPLOADS_UNITS_DIR, path.basename(oldUrl));
        try {
          await fs.promises.unlink(oldPath);
        } catch (_) {}
      }
      await query('UPDATE units SET image_url = ? WHERE id = ?', [imageUrl, id]);
      return { image_url: imageUrl };
    }
  );

  // DELETE /admin/units/:id/image — supprimer l'image de l'unité
  fastify.delete(
    '/admin/units/:id/image',
    { preHandler: preAdmin },
    async (request, reply) => {
      const id = Number(request.params?.id);
      if (!Number.isInteger(id) || id < 1) {
        return reply.code(400).send({ error: 'Invalid unit id' });
      }
      const [row] = await query('SELECT id, image_url FROM units WHERE id = ?', [id]);
      if (!row) {
        return reply.code(404).send({ error: 'Unit not found' });
      }
      const oldUrl = row?.image_url;
      if (oldUrl && oldUrl.startsWith('/uploads/units/')) {
        const oldPath = path.join(UPLOADS_UNITS_DIR, path.basename(oldUrl));
        try {
          await fs.promises.unlink(oldPath);
        } catch (_) {}
      }
      await query('UPDATE units SET image_url = NULL WHERE id = ?', [id]);
      return { image_url: null };
    }
  );

  fastify.post(
    '/admin/simulate-unit',
    { preHandler: preAdmin },
    async (request, reply) => {
      const payload = request.body || {};
      const result = validateUnit(payload);
      if (!result.valid) {
        return reply.code(400).send({ error: 'Validation failed', errors: result.errors });
      }
      try {
        const { simulateBattle } = await import('../../../core/combatEngine.js');
        const unit = {
          name: payload.name || 'Test',
          base_hp: Number(payload.base_hp ?? 1000),
          base_attack: Number(payload.base_attack ?? 80),
          base_defense: Number(payload.base_defense ?? 80),
          base_speed: 500,
          level: 1,
          mastery: Number(payload.mastery ?? 0),
          element: payload.element || 'fire',
          archetype: payload.archetype || 'CAC_TANK',
          position: 'front',
          attack_type: payload.attack_type || 'melee',
          traits: Array.isArray(payload.traits) ? payload.traits : [],
          skill_data: buildSkillData(payload)
        };
        const dummy = {
          name: 'Dummy',
          base_hp: 500,
          base_attack: 5,
          base_defense: 5,
          base_speed: 1,
          level: 1,
          mastery: 0,
          element: 'fire',
          archetype: 'CAC_DPS',
          position: 'front',
          attack_type: 'melee',
          traits: [],
          skill_data: null
        };
        const log = simulateBattle([unit], [dummy], { seed: 42, maxRounds: 3, maxActions: 15 });
        const events = log?.events || [];
        const battleLog = log?.battleLog || [];
        return { events, battleLog, summary: log?.summary };
      } catch (err) {
        fastify.log?.error?.(err, 'Admin simulate-unit');
        return reply.code(500).send({ error: 'Simulation failed', message: err.message });
      }
    }
  );

  // Liste des joueurs (pour la page admin "Gestion unités joueurs")
  fastify.get(
    '/admin/players',
    { preHandler: preAdmin },
    async (_request, reply) => {
      try {
        const rows = await query(
          'SELECT id, display_name FROM users ORDER BY display_name ASC, id ASC'
        );
        return { players: rows.map((r) => ({ id: r.id, display_name: r.display_name || `User ${r.id}` })) };
      } catch (err) {
        fastify.log?.error?.(err, 'Admin list players');
        return reply.code(500).send({ error: 'List failed', message: err.message });
      }
    }
  );

  // Liste de tous les utilisateurs (admin gestion utilisateurs) — champs éditables + last_login_at
  fastify.get(
    '/admin/users',
    { preHandler: preAdmin },
    async (_request, reply) => {
      try {
        const rows = await query(
          `SELECT u.id, u.email, u.display_name, u.elo, u.pvp_elo, u.avatar_url, u.last_login_at, u.last_opponent_id,
                  COALESCE(w.credits, 0) AS credits,
                  COALESCE(w.cores, 0) AS cores,
                  COALESCE(w.fragments, 0) AS fragments,
                  COALESCE(w.ascension_essence, 0) AS ascension_essence,
                  COALESCE(w.gold, 0) AS gold,
                  COALESCE(gc.guild_coins, 0) AS guild_coins
           FROM users u
           LEFT JOIN user_wallet w ON w.user_id = u.id
           LEFT JOIN guild_currencies gc ON gc.user_id = u.id
           ORDER BY u.id ASC`
        );
        return {
          users: rows.map((r) => ({
            id: r.id,
            email: r.email ?? '',
            display_name: r.display_name ?? '',
            elo: Number(r.elo ?? 0),
            pvp_elo: Number(r.pvp_elo ?? 0),
            avatar_url: r.avatar_url ?? null,
            last_login_at: r.last_login_at ?? null,
            last_opponent_id: r.last_opponent_id != null ? Number(r.last_opponent_id) : null,
            wallet: {
              credits: Number(r.credits ?? 0),
              cores: Number(r.cores ?? 0),
              fragments: Number(r.fragments ?? 0),
              ascension_essence: Number(r.ascension_essence ?? 0),
              gold: Number(r.gold ?? 0)
            },
            guild_coins: Number(r.guild_coins ?? 0)
          }))
        };
      } catch (err) {
        fastify.log?.error?.(err, 'Admin list users');
        return reply.code(500).send({ error: 'List failed', message: err.message });
      }
    }
  );

  // Détail d'un utilisateur
  fastify.get(
    '/admin/users/:id',
    { preHandler: preAdmin },
    async (request, reply) => {
      const id = Number(request.params?.id);
      if (!Number.isInteger(id) || id < 1) {
        return reply.code(400).send({ error: 'Invalid user id' });
      }
      try {
        const user = await getAdminUserById(id);
        if (!user) {
          return reply.code(404).send({ error: 'User not found' });
        }
        return user;
      } catch (err) {
        fastify.log?.error?.(err, 'Admin get user');
        return reply.code(500).send({ error: 'Failed', message: err.message });
      }
    }
  );

  // Mise à jour d'un utilisateur (display_name, email, elo, pvp_elo, last_opponent_id, avatar_url = null, wallet_adjustments)
  fastify.patch(
    '/admin/users/:id',
    { preHandler: preAdmin },
    async (request, reply) => {
      const id = Number(request.params?.id);
      if (!Number.isInteger(id) || id < 1) {
        return reply.code(400).send({ error: 'Invalid user id' });
      }
      const body = request.body || {};
      const updates = [];
      const values = [];

      if (body.display_name !== undefined) {
        const name = String(body.display_name ?? '').trim().slice(0, 64);
        if (name.length > 0) {
          const existing = await query('SELECT id FROM users WHERE display_name = ? AND id != ?', [name, id]);
          if (existing.length) {
            return reply.code(409).send({ error: 'PSEUDO_ALREADY_EXISTS', message: 'Ce pseudo est déjà pris.' });
          }
        }
        updates.push('display_name = ?');
        values.push(name || null);
      }
      if (body.email !== undefined) {
        const email = String(body.email ?? '').trim().toLowerCase().slice(0, 255);
        if (email.length > 0) {
          const existing = await query('SELECT id FROM users WHERE email = ? AND id != ?', [email, id]);
          if (existing.length) {
            return reply.code(409).send({ error: 'EMAIL_ALREADY_EXISTS', message: 'Cet email est déjà utilisé.' });
          }
        }
        updates.push('email = ?');
        values.push(email || null);
      }
      if (body.elo !== undefined) {
        const elo = Number(body.elo);
        if (!Number.isFinite(elo) || elo < 0) {
          return reply.code(400).send({ error: 'elo doit être un nombre >= 0' });
        }
        updates.push('elo = ?');
        values.push(Math.round(elo));
      }
      if (body.pvp_elo !== undefined) {
        const pvpElo = Number(body.pvp_elo);
        if (!Number.isFinite(pvpElo) || pvpElo < 0) {
          return reply.code(400).send({ error: 'pvp_elo doit être un nombre >= 0' });
        }
        updates.push('pvp_elo = ?');
        values.push(Math.round(pvpElo));
      }
      if (body.last_opponent_id !== undefined) {
        const oppId = body.last_opponent_id === null || body.last_opponent_id === '' ? null : Number(body.last_opponent_id);
        updates.push('last_opponent_id = ?');
        values.push(oppId);
      }
      if (body.avatar_url !== undefined && body.avatar_url === null) {
        updates.push('avatar_url = NULL');
      }

      const walletAdjustments = body.wallet_adjustments && typeof body.wallet_adjustments === 'object'
        ? body.wallet_adjustments
        : null;
      const walletFields = ['credits', 'cores', 'fragments', 'ascension_essence', 'gold'];
      const walletDeltas = {};
      let hasWalletAdjustment = false;
      if (walletAdjustments) {
        for (const field of walletFields) {
          if (walletAdjustments[field] === undefined || walletAdjustments[field] === null || walletAdjustments[field] === '') {
            continue;
          }
          const value = Number(walletAdjustments[field]);
          if (!Number.isFinite(value) || !Number.isInteger(value)) {
            return reply.code(400).send({ error: `${field} doit être un entier (positif ou négatif)` });
          }
          walletDeltas[field] = value;
          hasWalletAdjustment = true;
        }
      }

      if (updates.length === 0 && !hasWalletAdjustment) {
        return reply.code(400).send({ error: 'No fields to update' });
      }
      try {
        if (updates.length > 0) {
          values.push(id);
          const [result] = await getPool().execute(
            `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
            values
          );
          if (result?.affectedRows === 0) {
            return reply.code(404).send({ error: 'User not found' });
          }
        } else {
          const existingUser = await query('SELECT id FROM users WHERE id = ?', [id]);
          if (!existingUser.length) {
            return reply.code(404).send({ error: 'User not found' });
          }
        }

        if (hasWalletAdjustment) {
          await getPool().execute(
            `INSERT INTO user_wallet (user_id, credits, cores, fragments, ascension_essence, gold)
             VALUES (?, 0, 0, 0, 0, 0)
             ON DUPLICATE KEY UPDATE user_id = VALUES(user_id)`,
            [id]
          );
          for (const [field, delta] of Object.entries(walletDeltas)) {
            await getPool().execute(
              `UPDATE user_wallet
               SET ${field} = GREATEST(0, ${field} + ?)
               WHERE user_id = ?`,
              [delta, id]
            );
          }
        }
        return await getAdminUserById(id);
      } catch (err) {
        fastify.log?.error?.(err, 'Admin patch user');
        return reply.code(500).send({ error: 'Update failed', message: err.message });
      }
    }
  );

  fastify.delete(
    '/admin/users/:id',
    { preHandler: preAdmin },
    async (request, reply) => {
      const id = Number(request.params?.id);
      if (!Number.isInteger(id) || id < 1) {
        return reply.code(400).send({ error: 'Invalid user id' });
      }
      if (request.user?.id === id) {
        return reply.code(400).send({ error: 'SELF_DELETE_FORBIDDEN', message: 'Vous ne pouvez pas supprimer votre propre compte admin.' });
      }
      try {
        const [rows] = await getPool().execute('SELECT id, avatar_url FROM users WHERE id = ?', [id]);
        const user = rows[0];
        if (!user) {
          return reply.code(404).send({ error: 'User not found' });
        }
        const avatarUrl = user.avatar_url ?? null;
        if (avatarUrl && typeof avatarUrl === 'string' && avatarUrl.startsWith('/uploads/avatars/')) {
          const avatarPath = path.join(process.cwd(), avatarUrl.replace(/^\//, ''));
          try {
            await fs.promises.unlink(avatarPath);
          } catch {}
        }
        await getPool().execute('DELETE FROM users WHERE id = ?', [id]);
        return { ok: true, deleted: id };
      } catch (err) {
        fastify.log?.error?.(err, 'Admin delete user');
        return reply.code(500).send({ error: 'Delete failed', message: err.message });
      }
    }
  );

  // Mise à jour niveau / xp / spé / fatigue d'une user_unit (admin uniquement)
  fastify.patch(
    '/admin/user-units/:userUnitId',
    { preHandler: preAdmin },
    async (request, reply) => {
      const userUnitId = Number(request.params?.userUnitId);
      if (!Number.isInteger(userUnitId) || userUnitId < 1) {
        return reply.code(400).send({ error: 'Invalid userUnitId' });
      }
      const body = request.body || {};
      const updates = [];
      const values = [];

      if (body.level !== undefined) {
        const level = Number(body.level);
        if (!Number.isInteger(level) || level < 1 || level > 50) {
          return reply.code(400).send({ error: 'level doit être entre 1 et 50' });
        }
        updates.push('level = ?');
        values.push(level);
      }
      if (body.xp !== undefined) {
        const xp = Number(body.xp);
        if (!Number.isInteger(xp) || xp < 0) {
          return reply.code(400).send({ error: 'xp doit être un entier >= 0' });
        }
        updates.push('xp = ?');
        values.push(xp);
      }
      if (body.specialization !== undefined) {
        const spec = body.specialization === null || body.specialization === '' ? null : String(body.specialization).toUpperCase();
        if (spec !== null && spec !== 'A' && spec !== 'B') {
          return reply.code(400).send({ error: 'specialization doit être A, B ou vide' });
        }
        updates.push('specialization = ?');
        values.push(spec);
      }
      if (body.fatigue !== undefined) {
        const fatigue = Number(body.fatigue);
        if (!Number.isFinite(fatigue) || fatigue < 0 || fatigue > 100) {
          return reply.code(400).send({ error: 'fatigue doit être entre 0 et 100' });
        }
        updates.push('fatigue = ?');
        values.push(fatigue);
      }

      if (updates.length === 0) {
        return reply.code(400).send({ error: 'Aucun champ à mettre à jour (level, xp, specialization, fatigue)' });
      }
      values.push(userUnitId);
      try {
        const [result] = await getPool().execute(
          `UPDATE user_units SET ${updates.join(', ')} WHERE id = ?`,
          values
        );
        if (result?.affectedRows === 0) {
          return reply.code(404).send({ error: 'User unit not found' });
        }
        return { ok: true, userUnitId };
      } catch (err) {
        fastify.log?.error?.(err, 'Admin patch user-unit');
        return reply.code(500).send({ error: 'Update failed', message: err.message });
      }
    }
  );

  fastify.post(
    '/admin/users/:id/units',
    { preHandler: preAdmin },
    async (request, reply) => {
      const userId = Number(request.params?.id);
      if (!Number.isInteger(userId) || userId < 1) {
        return reply.code(400).send({ error: 'Invalid user id' });
      }
      const unitId = Number(request.body?.unit_id);
      const count = Math.max(1, Math.min(50, Number(request.body?.count ?? 1) || 1));
      if (!Number.isInteger(unitId) || unitId < 1) {
        return reply.code(400).send({ error: 'unit_id requis' });
      }
      try {
        const userRows = await query('SELECT id FROM users WHERE id = ?', [userId]);
        if (!userRows.length) {
          return reply.code(404).send({ error: 'User not found' });
        }
        const unitRows = await query('SELECT id FROM units WHERE id = ?', [unitId]);
        if (!unitRows.length) {
          return reply.code(404).send({ error: 'Unit not found' });
        }
        for (let i = 0; i < count; i++) {
          await getPool().execute(
            'INSERT INTO user_units (user_id, unit_id, level, xp, fatigue, fatigue_last_update, injury_level, is_injured) VALUES (?, ?, 1, 0, 0, NOW(), 0, 0)',
            [userId, unitId]
          );
        }
        return { ok: true, added: count, unit_id: unitId, user_id: userId };
      } catch (err) {
        fastify.log?.error?.(err, 'Admin add user-unit');
        return reply.code(500).send({ error: 'Add failed', message: err.message });
      }
    }
  );

  fastify.get(
    '/admin/users/:id/artifacts',
    { preHandler: preAdmin },
    async (request, reply) => {
      const userId = Number(request.params?.id);
      if (!Number.isInteger(userId) || userId < 1) {
        return reply.code(400).send({ error: 'Invalid user id' });
      }
      try {
        const payload = await getAdminArtifactsByUserId(userId);
        if (!payload) {
          return reply.code(404).send({ error: 'User not found' });
        }
        return payload;
      } catch (err) {
        fastify.log?.error?.(err, 'Admin list user artifacts');
        return reply.code(500).send({ error: 'List failed', message: err.message });
      }
    }
  );

  fastify.post(
    '/admin/users/:id/artifacts',
    { preHandler: preAdmin },
    async (request, reply) => {
      const userId = Number(request.params?.id);
      if (!Number.isInteger(userId) || userId < 1) {
        return reply.code(400).send({ error: 'Invalid user id' });
      }
      const statKey = String(request.body?.stat_key ?? '').trim();
      const level = Number(request.body?.level ?? 0);
      const count = Math.max(1, Math.min(100, Number(request.body?.count ?? 1) || 1));
      const equippedUserUnitIdRaw = request.body?.equipped_user_unit_id;
      const equippedUserUnitId = equippedUserUnitIdRaw == null || equippedUserUnitIdRaw === ''
        ? null
        : Number(equippedUserUnitIdRaw);

      if (!ARTIFACT_STAT_KEYS.includes(statKey)) {
        return reply.code(400).send({ error: 'INVALID_ARTIFACT_STAT' });
      }
      if (!Number.isInteger(level) || level < 0) {
        return reply.code(400).send({ error: 'INVALID_ARTIFACT_LEVEL' });
      }
      if (equippedUserUnitId != null && count !== 1) {
        return reply.code(400).send({ error: 'EQUIPPED_ARTIFACT_COUNT_MUST_BE_ONE' });
      }

      try {
        const userRows = await query('SELECT id FROM users WHERE id = ?', [userId]);
        if (!userRows.length) {
          return reply.code(404).send({ error: 'User not found' });
        }
        await validateArtifactEquipTarget(query, userId, 0, statKey, equippedUserUnitId);
        for (let i = 0; i < count; i++) {
          await getPool().execute(
            'INSERT INTO user_artifacts (user_id, stat_key, level, equipped_user_unit_id) VALUES (?, ?, ?, ?)',
            [userId, statKey, level, equippedUserUnitId]
          );
        }
        return await getAdminArtifactsByUserId(userId);
      } catch (err) {
        const message = err?.message || 'Add failed';
        if (['USER_UNIT_NOT_FOUND', 'ARTIFACT_SLOTS_FULL', 'DUPLICATE_ARTIFACT_STAT'].includes(message)) {
          return reply.code(400).send({ error: message });
        }
        fastify.log?.error?.(err, 'Admin add user-artifact');
        return reply.code(500).send({ error: 'Add failed', message });
      }
    }
  );

  fastify.patch(
    '/admin/user-artifacts/:artifactId',
    { preHandler: preAdmin },
    async (request, reply) => {
      const artifactId = Number(request.params?.artifactId);
      if (!Number.isInteger(artifactId) || artifactId < 1) {
        return reply.code(400).send({ error: 'Invalid artifactId' });
      }
      const body = request.body || {};
      try {
        const rows = await query(
          'SELECT id, user_id, stat_key, level, equipped_user_unit_id FROM user_artifacts WHERE id = ? LIMIT 1',
          [artifactId]
        );
        const artifact = rows[0];
        if (!artifact) {
          return reply.code(404).send({ error: 'Artifact not found' });
        }

        const updates = [];
        const values = [];

        if (body.level !== undefined) {
          const level = Number(body.level);
          if (!Number.isInteger(level) || level < 0) {
            return reply.code(400).send({ error: 'INVALID_ARTIFACT_LEVEL' });
          }
          updates.push('level = ?');
          values.push(level);
        }

        if (body.equipped_user_unit_id !== undefined) {
          const equippedUserUnitId = body.equipped_user_unit_id === null || body.equipped_user_unit_id === ''
            ? null
            : Number(body.equipped_user_unit_id);
          if (equippedUserUnitId != null && (!Number.isInteger(equippedUserUnitId) || equippedUserUnitId < 1)) {
            return reply.code(400).send({ error: 'INVALID_USER_UNIT_ID' });
          }
          await validateArtifactEquipTarget(query, Number(artifact.user_id), artifactId, artifact.stat_key, equippedUserUnitId);
          updates.push('equipped_user_unit_id = ?');
          values.push(equippedUserUnitId);
        }

        if (!updates.length) {
          return reply.code(400).send({ error: 'No fields to update' });
        }

        values.push(artifactId);
        await getPool().execute(
          `UPDATE user_artifacts SET ${updates.join(', ')} WHERE id = ?`,
          values
        );

        return await getAdminArtifactsByUserId(Number(artifact.user_id));
      } catch (err) {
        const message = err?.message || 'Update failed';
        if (['USER_UNIT_NOT_FOUND', 'ARTIFACT_SLOTS_FULL', 'DUPLICATE_ARTIFACT_STAT'].includes(message)) {
          return reply.code(400).send({ error: message });
        }
        fastify.log?.error?.(err, 'Admin patch user-artifact');
        return reply.code(500).send({ error: 'Update failed', message });
      }
    }
  );

  fastify.delete(
    '/admin/user-artifacts/:artifactId',
    { preHandler: preAdmin },
    async (request, reply) => {
      const artifactId = Number(request.params?.artifactId);
      if (!Number.isInteger(artifactId) || artifactId < 1) {
        return reply.code(400).send({ error: 'Invalid artifactId' });
      }
      try {
        const rows = await query('SELECT id, user_id FROM user_artifacts WHERE id = ? LIMIT 1', [artifactId]);
        const artifact = rows[0];
        if (!artifact) {
          return reply.code(404).send({ error: 'Artifact not found' });
        }
        await getPool().execute('DELETE FROM user_artifacts WHERE id = ?', [artifactId]);
        return await getAdminArtifactsByUserId(Number(artifact.user_id));
      } catch (err) {
        fastify.log?.error?.(err, 'Admin delete user-artifact');
        return reply.code(500).send({ error: 'Delete failed', message: err.message });
      }
    }
  );

  fastify.delete(
    '/admin/user-units/:userUnitId',
    { preHandler: preAdmin },
    async (request, reply) => {
      const userUnitId = Number(request.params?.userUnitId);
      if (!Number.isInteger(userUnitId) || userUnitId < 1) {
        return reply.code(400).send({ error: 'Invalid userUnitId' });
      }
      try {
        const [result] = await getPool().execute('DELETE FROM user_units WHERE id = ?', [userUnitId]);
        if (result?.affectedRows === 0) {
          return reply.code(404).send({ error: 'User unit not found' });
        }
        return { ok: true, deleted: userUnitId };
      } catch (err) {
        fastify.log?.error?.(err, 'Admin delete user-unit');
        return reply.code(500).send({ error: 'Delete failed', message: err.message });
      }
    }
  );

  // --- Campagne Admin ---
  fastify.get(
    '/admin/campaign-stages',
    { preHandler: preAdmin },
    async (_request, reply) => {
      try {
        const rows = await query(
          'SELECT chapter, stage, is_boss, normal_multiplier, hard_multiplier, enemy_template, boss_unit_code FROM campaign_stages ORDER BY chapter, stage'
        );
        const stages = rows.map((r) => {
          let template = r.enemy_template;
          if (typeof template === 'string') {
            try {
              template = JSON.parse(template);
            } catch {
              template = null;
            }
          }
          return {
            chapter: Number(r.chapter),
            stage: Number(r.stage),
            is_boss: !!r.is_boss,
            normal_multiplier: Number(r.normal_multiplier),
            hard_multiplier: Number(r.hard_multiplier),
            enemy_template: template,
            boss_unit_code: r.boss_unit_code ?? null
          };
        });
        return { stages };
      } catch (err) {
        fastify.log?.error?.(err, 'Admin campaign-stages list');
        return reply.code(500).send({ error: 'List failed', message: err.message });
      }
    }
  );

  fastify.put(
    '/admin/campaign-stages/:chapter/:stage',
    { preHandler: preAdmin },
    async (request, reply) => {
      const chapter = Number(request.params.chapter);
      const stage = Number(request.params.stage);
      if (!Number.isInteger(chapter) || chapter < 1 || chapter > 10 || !Number.isInteger(stage) || stage < 1 || stage > 10) {
        return reply.code(400).send({ error: 'Invalid chapter or stage' });
      }
      const body = request.body || {};
      const enemyTemplate = body.enemy_template;
      const bossUnitCode = body.boss_unit_code ?? null;
      if (enemyTemplate != null && typeof enemyTemplate !== 'object') {
        return reply.code(400).send({ error: 'enemy_template must be an object' });
      }
      try {
        const templateJson = enemyTemplate != null ? JSON.stringify(enemyTemplate) : null;
        await query(
          `UPDATE campaign_stages SET enemy_template = ?, boss_unit_code = ? WHERE chapter = ? AND stage = ?`,
          [templateJson, bossUnitCode, chapter, stage]
        );
        const [rows] = await getPool().execute(
          'SELECT chapter, stage, is_boss, enemy_template, boss_unit_code FROM campaign_stages WHERE chapter = ? AND stage = ?',
          [chapter, stage]
        );
        if (!rows.length) {
          return reply.code(404).send({ error: 'Stage not found' });
        }
        const r = rows[0];
        let template = r.enemy_template;
        if (typeof template === 'string') {
          try {
            template = JSON.parse(template);
          } catch {
            template = null;
          }
        }
        return {
          ok: true,
          stage: {
            chapter: Number(r.chapter),
            stage: Number(r.stage),
            is_boss: !!r.is_boss,
            enemy_template: template,
            boss_unit_code: r.boss_unit_code ?? null
          }
        };
      } catch (err) {
        fastify.log?.error?.(err, 'Admin campaign-stages update');
        return reply.code(500).send({ error: 'Update failed', message: err.message });
      }
    }
  );

  // --- Donjon Admin (compositions ennemies : 3 combats par niveau × élément) ---
  const DUNGEON_ELEMENTS = new Set(['fire', 'water', 'plant', 'light', 'dark']);
  const MAX_DUNGEON_LEVEL = 10;
  const COMBATS_PER_DUNGEON_LEVEL = 3;

  function normalizeDungeonElement(raw) {
    const e = String(raw || '')
      .toLowerCase()
      .trim();
    if (e === 'lumiere' || e === 'light') return 'light';
    if (e === 'tenebres' || e === 'tenebre' || e === 'dark') return 'dark';
    return DUNGEON_ELEMENTS.has(e) ? e : null;
  }

  fastify.get(
    '/admin/dungeon-encounters',
    { preHandler: preAdmin },
    async (_request, reply) => {
      try {
        const rows = await query(
          'SELECT element, level, combat_index, enemy_template_json FROM dungeon_encounters ORDER BY element, level, combat_index'
        );
        const encounters = rows.map((r) => {
          let template = r.enemy_template_json;
          if (typeof template === 'string') {
            try {
              template = JSON.parse(template);
            } catch {
              template = null;
            }
          }
          return {
            element: String(r.element),
            level: Number(r.level),
            combat_index: Number(r.combat_index),
            enemy_template: template
          };
        });
        return { encounters };
      } catch (err) {
        fastify.log?.error?.(err, 'Admin dungeon-encounters list');
        return reply.code(500).send({ error: 'List failed', message: err.message });
      }
    }
  );

  fastify.put(
    '/admin/dungeon-encounters/:element/:level/:combatIndex',
    { preHandler: preAdmin },
    async (request, reply) => {
      const element = normalizeDungeonElement(request.params.element);
      const level = Number(request.params.level);
      const combatIndex = Number(request.params.combatIndex);
      if (!element) {
        return reply.code(400).send({ error: 'Invalid element' });
      }
      if (!Number.isInteger(level) || level < 1 || level > MAX_DUNGEON_LEVEL) {
        return reply.code(400).send({ error: 'Invalid level (1–10)' });
      }
      if (!Number.isInteger(combatIndex) || combatIndex < 1 || combatIndex > COMBATS_PER_DUNGEON_LEVEL) {
        return reply.code(400).send({ error: 'Invalid combat index (1–3)' });
      }
      const body = request.body || {};
      const enemyTemplate = body.enemy_template;
      if (enemyTemplate != null && typeof enemyTemplate !== 'object') {
        return reply.code(400).send({ error: 'enemy_template must be an object' });
      }
      try {
        const templateJson = enemyTemplate != null ? JSON.stringify(enemyTemplate) : null;
        await query(
          `INSERT INTO dungeon_encounters (element, level, combat_index, enemy_template_json)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE enemy_template_json = VALUES(enemy_template_json)`,
          [element, level, combatIndex, templateJson]
        );
        const [rows] = await getPool().execute(
          'SELECT element, level, combat_index, enemy_template_json FROM dungeon_encounters WHERE element = ? AND level = ? AND combat_index = ?',
          [element, level, combatIndex]
        );
        if (!rows.length) {
          return reply.code(404).send({ error: 'Encounter not found' });
        }
        const r = rows[0];
        let template = r.enemy_template_json;
        if (typeof template === 'string') {
          try {
            template = JSON.parse(template);
          } catch {
            template = null;
          }
        }
        return {
          ok: true,
          encounter: {
            element: String(r.element),
            level: Number(r.level),
            combat_index: Number(r.combat_index),
            enemy_template: template
          }
        };
      } catch (err) {
        fastify.log?.error?.(err, 'Admin dungeon-encounters update');
        return reply.code(500).send({ error: 'Update failed', message: err.message });
      }
    }
  );
}
