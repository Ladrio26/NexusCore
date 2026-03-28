/**
 * BotProfiles.js
 * Définit les profils de comportement des bots.
 * Les définitions en base (bot_profile_definitions) surchargent priorités et champs optionnels.
 */

import { query } from '../config/db.js';

const MIN = 60_000;

/** Ordre par défaut des étapes de décision (ids stables pour l’API / l’admin). */
export const DEFAULT_ACTION_PRIORITY = Object.freeze([
  'summon',
  'specialize',
  'equip',
  'upgrade',
  'guildWar',
  'campaign',
  'dungeon',
  'pvp',
  'idle',
]);

/** Catalogue des actions affiché côté admin (libellés FR). */
export const BOT_DECISION_ACTIONS = Object.freeze([
  { id: 'summon', labelFr: 'Invocation (sanctuaire)' },
  { id: 'specialize', labelFr: 'Spécialisation (niveau 50)' },
  { id: 'equip', labelFr: 'Équiper un artefact' },
  { id: 'upgrade', labelFr: 'Améliorer un artefact' },
  { id: 'guildWar', labelFr: 'Attaque guerre de guilde' },
  { id: 'campaign', labelFr: 'Combat campagne' },
  { id: 'dungeon', labelFr: 'Donjon' },
  { id: 'pvp', labelFr: 'Combat PvP' },
  { id: 'idle', labelFr: 'Pause (idle)' },
]);

/**
 * Structure d'un profil :
 * - globalTickCooldownMs  : délai entre deux ticks.
 * - weights               : probabilités relatives campagne vs donjon (legacy, peu utilisé si ordre strict).
 * - cooldowns             : délais minimum avant de répéter la même action.
 * - maxFatigueForCombat   : fatigue max tolérée pour campagne/donjon.
 * - maxArtifactUpgradeLevel : niveau max d'amélioration artefact.
 * - dungeonStrategy       : 'push' | 'farm' | 'balanced'.
 * - dungeonFailuresBeforeFarm : échecs consécutifs avant farm.
 * - dungeonFarmCooldownAfterFailMs : durée du mode farm après un échec.
 * - preferredSpec : 'A', 'B', ou 'random'.
 * - actionPriority : ordre d’évaluation dans BotDecisionEngine (fusionné depuis la DB si présent).
 */
export const BOT_PROFILES = {
  balanced: {
    id: 'balanced',
    globalTickCooldownMs: 1 * MIN,
    preferredSpec: 'random',
    weights: { summon: 3, campaign: 3, dungeon: 2, pvp: 2, guildWar: 2, artifactEquip: 2, artifactUpgrade: 1 },
    cooldowns: {
      summon: 5 * MIN,
      campaignBattle: 2 * MIN,
      dungeonBattle: 3 * MIN,
      pvpBattle: 1 * MIN,
      guildWarAttack: 5 * MIN,
      artifactEquip: 2 * MIN,
      artifactUpgrade: 3 * MIN,
      specialize: 1 * MIN,
      idle: 1 * MIN,
    },
    maxFatigueForCombat: 60,
    maxArtifactUpgradeLevel: 5,
    dungeonStrategy: 'balanced',
    dungeonFailuresBeforeFarm: 2,
    dungeonFarmCooldownAfterFailMs: 5 * MIN,
  },

  farmer: {
    id: 'farmer',
    globalTickCooldownMs: 1 * MIN,
    preferredSpec: 'A',
    weights: { summon: 1, campaign: 2, dungeon: 5, pvp: 1, guildWar: 1, artifactEquip: 3, artifactUpgrade: 3 },
    cooldowns: {
      summon: 7 * MIN,
      campaignBattle: 2 * MIN,
      dungeonBattle: 2 * MIN,
      pvpBattle: 4 * MIN,
      guildWarAttack: 6 * MIN,
      artifactEquip: 2 * MIN,
      artifactUpgrade: 2 * MIN,
      specialize: 1 * MIN,
      idle: 1 * MIN,
    },
    maxFatigueForCombat: 70,
    maxArtifactUpgradeLevel: 8,
    dungeonStrategy: 'farm',
    dungeonFailuresBeforeFarm: 1,
    dungeonFarmCooldownAfterFailMs: 4 * MIN,
  },

  pvp_focused: {
    id: 'pvp_focused',
    globalTickCooldownMs: 1 * MIN,
    preferredSpec: 'B',
    weights: { summon: 2, campaign: 1, dungeon: 1, pvp: 6, guildWar: 2, artifactEquip: 2, artifactUpgrade: 2 },
    cooldowns: {
      summon: 6 * MIN,
      campaignBattle: 4 * MIN,
      dungeonBattle: 6 * MIN,
      pvpBattle: 1 * MIN,
      guildWarAttack: 5 * MIN,
      artifactEquip: 3 * MIN,
      artifactUpgrade: 4 * MIN,
      specialize: 1 * MIN,
      idle: 1 * MIN,
    },
    maxFatigueForCombat: 50,
    maxArtifactUpgradeLevel: 6,
    dungeonStrategy: 'push',
    dungeonFailuresBeforeFarm: 3,
    dungeonFarmCooldownAfterFailMs: 8 * MIN,
  },

  guild_warrior: {
    id: 'guild_warrior',
    globalTickCooldownMs: 1 * MIN,
    preferredSpec: 'A',
    weights: { summon: 2, campaign: 2, dungeon: 1, pvp: 1, guildWar: 6, artifactEquip: 2, artifactUpgrade: 1 },
    cooldowns: {
      summon: 6 * MIN,
      campaignBattle: 3 * MIN,
      dungeonBattle: 6 * MIN,
      pvpBattle: 3 * MIN,
      guildWarAttack: 3 * MIN,
      artifactEquip: 3 * MIN,
      artifactUpgrade: 6 * MIN,
      specialize: 1 * MIN,
      idle: 1 * MIN,
    },
    maxFatigueForCombat: 55,
    maxArtifactUpgradeLevel: 4,
    dungeonStrategy: 'balanced',
    dungeonFailuresBeforeFarm: 2,
    dungeonFarmCooldownAfterFailMs: 7 * MIN,
  },

  gacha_addict: {
    id: 'gacha_addict',
    globalTickCooldownMs: 1 * MIN,
    preferredSpec: 'random',
    weights: { summon: 8, campaign: 2, dungeon: 2, pvp: 1, guildWar: 1, artifactEquip: 2, artifactUpgrade: 1 },
    cooldowns: {
      summon: 2 * MIN,
      campaignBattle: 2 * MIN,
      dungeonBattle: 3 * MIN,
      pvpBattle: 2 * MIN,
      guildWarAttack: 7 * MIN,
      artifactEquip: 2 * MIN,
      artifactUpgrade: 4 * MIN,
      specialize: 1 * MIN,
      idle: 1 * MIN,
    },
    maxFatigueForCombat: 65,
    maxArtifactUpgradeLevel: 3,
    dungeonStrategy: 'balanced',
    dungeonFailuresBeforeFarm: 2,
    dungeonFarmCooldownAfterFailMs: 5 * MIN,
  },
};

export const DEFAULT_PROFILE = 'balanced';

/** @type {Map<string, object>} */
let resolvedProfilesCache = new Map();

function cloneDeep(o) {
  return JSON.parse(JSON.stringify(o));
}

function deepMerge(target, src) {
  if (!src || typeof src !== 'object') return target;
  for (const k of Object.keys(src)) {
    const v = src[k];
    if (
      v &&
      typeof v === 'object' &&
      !Array.isArray(v) &&
      target[k] &&
      typeof target[k] === 'object' &&
      !Array.isArray(target[k])
    ) {
      deepMerge(target[k], v);
    } else {
      target[k] = v;
    }
  }
  return target;
}

function parseJsonField(v) {
  if (v == null) return null;
  if (typeof v === 'object') return v;
  if (typeof v === 'string') {
    try {
      return JSON.parse(v);
    } catch {
      return null;
    }
  }
  return null;
}

export function normalizeActionPriority(arr) {
  const valid = new Set(DEFAULT_ACTION_PRIORITY);
  const seen = new Set();
  const out = [];
  if (!Array.isArray(arr)) return [...DEFAULT_ACTION_PRIORITY];
  for (const x of arr) {
    const s = String(x);
    if (valid.has(s) && !seen.has(s)) {
      out.push(s);
      seen.add(s);
    }
  }
  for (const v of DEFAULT_ACTION_PRIORITY) {
    if (!seen.has(v)) out.push(v);
  }
  return out;
}

function buildResolvedProfile(key, row) {
  const codeProfile = BOT_PROFILES[key];
  let base;
  if (codeProfile) {
    base = cloneDeep(codeProfile);
  } else if (row) {
    const ext =
      row.extends_key && BOT_PROFILES[row.extends_key] ? row.extends_key : DEFAULT_PROFILE;
    base = cloneDeep(BOT_PROFILES[ext]);
    base.id = key;
  } else {
    base = cloneDeep(BOT_PROFILES[DEFAULT_PROFILE]);
    base.id = key;
  }

  base.actionPriority = [...DEFAULT_ACTION_PRIORITY];

  if (row) {
    const prio = parseJsonField(row.action_priority_json);
    if (Array.isArray(prio) && prio.length) {
      base.actionPriority = normalizeActionPriority(prio);
    }
    const over = parseJsonField(row.overrides_json);
    if (over && typeof over === 'object') {
      deepMerge(base, over);
      if (Array.isArray(over.actionPriority)) {
        base.actionPriority = normalizeActionPriority(over.actionPriority);
      }
    }
  }

  return base;
}

/**
 * Reconstruit le cache des profils depuis la base + BOT_PROFILES.
 * À appeler au démarrage et après chaque mutation admin.
 */
export async function rebuildBotProfileCache() {
  let rows = [];
  try {
    rows = await query(
      'SELECT profile_key, display_label, extends_key, action_priority_json, overrides_json FROM bot_profile_definitions'
    );
  } catch {
    rows = [];
  }
  const rowMap = new Map(rows.map((r) => [r.profile_key, r]));
  const allKeys = new Set([...Object.keys(BOT_PROFILES), ...rows.map((r) => r.profile_key)]);
  const next = new Map();
  for (const key of allKeys) {
    next.set(key, buildResolvedProfile(key, rowMap.get(key)));
  }
  resolvedProfilesCache = next;
}

export function getProfile(profileId) {
  const id = String(profileId || DEFAULT_PROFILE).trim();
  if (!resolvedProfilesCache.size) {
    const p = BOT_PROFILES[id] ?? BOT_PROFILES[DEFAULT_PROFILE];
    const c = cloneDeep(p);
    c.actionPriority = [...DEFAULT_ACTION_PRIORITY];
    return c;
  }
  if (resolvedProfilesCache.has(id)) {
    return cloneDeep(resolvedProfilesCache.get(id));
  }
  const fallback = BOT_PROFILES[id]
    ? cloneDeep(BOT_PROFILES[id])
    : cloneDeep(BOT_PROFILES[DEFAULT_PROFILE]);
  fallback.actionPriority = [...DEFAULT_ACTION_PRIORITY];
  if (!BOT_PROFILES[id]) fallback.id = id;
  return fallback;
}

export function getAllAssignableProfileIds() {
  if (!resolvedProfilesCache.size) {
    return Object.keys(BOT_PROFILES).sort();
  }
  return [...resolvedProfilesCache.keys()].sort();
}

export function isBuiltInProfileKey(key) {
  return Object.prototype.hasOwnProperty.call(BOT_PROFILES, key);
}

export function profileKeyFromParam(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(s)) return null;
  return s;
}
