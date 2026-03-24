/**
 * Système d'artefacts avec rareté (common, uncommon, rare).
 *
 * Commun : PV, ATQ, DEF, VIT, Maîtrise (upgradable)
 * Peu commun : Immunité, +50% XP (non upgradable) ; Double bonus (2 stats, upgradable comme le commun)
 * Rare : Octroie trait (Arcaniste, Berserker, Bourreau, Druide, Gardien, Tacticien) — non équipable sur unité ayant déjà le trait
 */

export const ARTIFACT_RARITIES = Object.freeze(['common', 'uncommon', 'rare']);

export const ARTIFACT_RARITY_LABELS_FR = Object.freeze({
  common: 'Commun',
  uncommon: 'Peu commun',
  rare: 'Rare'
});

// Stat keys pour artefacts communs (upgradable)
export const ARTIFACT_COMMON_STAT_KEYS = Object.freeze(['attack', 'defense', 'speed', 'maxHp', 'mastery']);

// Tous les stat_key possibles (inclut uncommon/rare)
export const ARTIFACT_STAT_KEYS = Object.freeze([
  ...ARTIFACT_COMMON_STAT_KEYS,
  'immune',
  'dual_bonus',
  'xp_boost',
  'trait_arcanist',
  'trait_berserker',
  'trait_executioner',
  'trait_druid',
  'trait_guardian',
  'trait_tactician'
]);

/**
 * Clé canonique pour comparaisons / bonus (ex. "maxhp" ou "MAXHP" -> "maxHp").
 * Les stats communes utilisent le camelCase du tableau ARTIFACT_*.
 */
export function canonicalArtifactStatKey(statKey) {
  const raw = String(statKey || '').trim();
  if (!raw) return raw;
  const lower = raw.toLowerCase();
  for (const key of ARTIFACT_COMMON_STAT_KEYS) {
    if (key.toLowerCase() === lower) return key;
  }
  for (const key of ARTIFACT_STAT_KEYS) {
    if (key.toLowerCase() === lower) return key;
  }
  return raw;
}

export const ARTIFACT_STAT_LABELS_FR = Object.freeze({
  attack: 'ATQ',
  defense: 'DEF',
  speed: 'VITESSE',
  maxHp: 'PV',
  mastery: 'Maîtrise',
  immune: 'Immunité',
  dual_bonus: 'Double bonus',
  xp_boost: 'Bonus XP',
  trait_arcanist: 'Arcaniste',
  trait_berserker: 'Berserker',
  trait_executioner: 'Bourreau',
  trait_druid: 'Druide',
  trait_guardian: 'Gardien',
  trait_tactician: 'Tacticien'
});

// Mapping trait artifact -> trait synergy
export const TRAIT_ARTIFACT_TO_TRAIT = Object.freeze({
  trait_arcanist: 'ARCANISTS',
  trait_berserker: 'BERSERKERS',
  trait_executioner: 'EXECUTIONERS',
  trait_druid: 'DRUIDS',
  trait_guardian: 'GUARDIANS',
  trait_tactician: 'TACTICIANS'
});

// Options pour dual_bonus : [key, value]
export const DUAL_BONUS_OPTIONS = Object.freeze([
  { key: 'attack', value: 6 },
  { key: 'defense', value: 6 },
  { key: 'speed', value: 6 },
  { key: 'mastery', value: 12 },
  { key: 'maxHp', value: 30 }
]);

export function getArtifactRarity(statKey) {
  const c = canonicalArtifactStatKey(statKey);
  if (ARTIFACT_COMMON_STAT_KEYS.includes(c) || c === '') return 'common';
  const k = c.toLowerCase();
  if (k === 'immune' || k === 'dual_bonus' || k === 'xp_boost') return 'uncommon';
  if (k.startsWith('trait_')) return 'rare';
  return 'common';
}

export function isValidArtifactStatKey(statKey) {
  const c = canonicalArtifactStatKey(statKey);
  return ARTIFACT_STAT_KEYS.includes(c);
}

export function getArtifactBaseBonus(statKey) {
  const c = canonicalArtifactStatKey(statKey);
  if (c === 'immune') return 0;
  if (c === 'maxHp') return 50;
  return c === 'mastery' ? 20 : 10;
}

/**
 * @param {string} statKey
 * @param {number} level
 * @param {null|{ bonuses?: string[] }} [extraData] — requis pour dual_bonus (somme des deux stats scalées)
 */
export function getArtifactBonusValue(statKey, level = 0, extraData = null) {
  const c = canonicalArtifactStatKey(statKey);
  const normalizedLevel = Math.max(0, Number(level) || 0);
  if (c === 'dual_bonus') {
    const bonuses = extraData && typeof extraData === 'object' && Array.isArray(extraData.bonuses) ? extraData.bonuses : [];
    let sum = 0;
    for (const bKey of bonuses) {
      const canonB = canonicalArtifactStatKey(bKey);
      const opt = DUAL_BONUS_OPTIONS.find((o) => o.key === canonB);
      if (opt) sum += opt.value * (1 + normalizedLevel);
    }
    return sum;
  }
  const base = getArtifactBaseBonus(statKey);
  return base + normalizedLevel * base;
}

export function getArtifactUpgradeCost(level = 0) {
  const normalizedLevel = Math.max(0, Number(level) || 0);
  return Math.round(1000 * Math.pow(1.5, normalizedLevel));
}

export function getArtifactUpgradeSuccessChance(level = 0) {
  const normalizedLevel = Math.max(0, Number(level) || 0);
  return Math.max(1, 100 - normalizedLevel * 10);
}

/** Artefact non améliorable (immune, xp_boost, trait_*) — dual_bonus est améliorable. */
export function isArtifactUpgradable(statKey) {
  const c = canonicalArtifactStatKey(statKey);
  if (c === 'dual_bonus') return true;
  return ARTIFACT_COMMON_STAT_KEYS.includes(c);
}

/** Choisit 2 bonus distincts pour dual_bonus */
export function rollDualBonusExtraData(rng = Math.random) {
  const opts = [...DUAL_BONUS_OPTIONS];
  const i1 = Math.floor(rng() * opts.length);
  const [first] = opts.splice(i1, 1);
  const i2 = Math.floor(rng() * opts.length);
  const [second] = opts.splice(i2, 1);
  return { bonuses: [first.key, second.key] };
}

/**
 * dual_bonus dont l’une des deux stats est imposée (ex. donjon Feu → attaque comprise).
 */
export function rollDualBonusIncludingKey(requiredStatKey, rng = Math.random) {
  const req = canonicalArtifactStatKey(requiredStatKey);
  const keys = DUAL_BONUS_OPTIONS.map((o) => o.key);
  if (!keys.includes(req)) {
    return rollDualBonusExtraData(rng);
  }
  const others = keys.filter((k) => k !== req);
  const second = others[Math.floor(rng() * others.length)];
  return { bonuses: [req, second] };
}

export function chooseRandomArtifactStat(rng = Math.random) {
  const roll = typeof rng === 'function' ? rng() : Math.random();
  const index = Math.max(0, Math.min(ARTIFACT_COMMON_STAT_KEYS.length - 1, Math.floor(roll * ARTIFACT_COMMON_STAT_KEYS.length)));
  return ARTIFACT_COMMON_STAT_KEYS[index];
}

/**
 * Choisit un artefact à créer selon la rareté (pour drop PvP).
 * common: 1 stat parmi attack, defense, speed, maxHp, mastery
 * uncommon: immune, dual_bonus ou xp_boost (équiprobable entre les 3)
 * rare: 1 parmi les 6 traits (équiprobable)
 */
export function createArtifactForRarity(rarity, rng = Math.random) {
  const r = String(rarity || 'common').toLowerCase();
  let statKey;
  let extraData = null;

  if (r === 'common') {
    statKey = chooseRandomArtifactStat(rng);
  } else if (r === 'uncommon') {
    const idx = Math.floor(rng() * 3);
    statKey = ['immune', 'dual_bonus', 'xp_boost'][idx];
    if (statKey === 'dual_bonus') {
      extraData = rollDualBonusExtraData(rng);
    }
  } else {
    const traits = ['trait_arcanist', 'trait_berserker', 'trait_executioner', 'trait_druid', 'trait_guardian', 'trait_tactician'];
    statKey = traits[Math.floor(rng() * traits.length)];
  }

  return { statKey, extraData };
}

/**
 * Applique les bonus des artefacts à l'unité (stats + traits pour artefact trait_*).
 */
export function applyArtifactBonusesToUnit(unit, artifacts) {
  if (!unit || !Array.isArray(artifacts) || artifacts.length === 0) return;

  // Traits accordés par artefacts (pour synergies)
  const artifactTraits = [];

  for (const artifact of artifacts) {
    const statKey = canonicalArtifactStatKey(String(artifact?.stat_key || artifact?.statKey || ''));
    if (!isValidArtifactStatKey(statKey)) continue;

    if (statKey === 'immune') continue; // Effet appliqué au démarrage du combat (IMMUNITY buff)
    if (statKey === 'xp_boost') continue; // Effet appliqué à l'XP, pas aux stats

    if (statKey.startsWith('trait_')) {
      const trait = TRAIT_ARTIFACT_TO_TRAIT[statKey];
      if (trait) artifactTraits.push(trait);
      continue;
    }

    if (statKey === 'dual_bonus') {
      const extra = artifact?.extra_data || artifact?.extraData;
      const bonuses = extra?.bonuses || [];
      const lv = Math.max(0, Number(artifact?.level ?? 0) || 0);
      for (const bKey of bonuses) {
        const canonB = canonicalArtifactStatKey(bKey);
        const opt = DUAL_BONUS_OPTIONS.find((o) => o.key === canonB);
        if (opt && typeof unit[opt.key] === 'number') {
          unit[opt.key] = (unit[opt.key] || 0) + opt.value * (1 + lv);
        }
      }
      continue;
    }

    // Commun : attack, defense, speed, maxHp, mastery
    const bonus = getArtifactBonusValue(statKey, artifact?.level ?? 0);
    if (typeof unit[statKey] === 'number') {
      unit[statKey] += bonus;
    }
  }

  if (artifactTraits.length > 0) {
    unit.traits = Array.isArray(unit.traits) ? [...unit.traits] : [];
    for (const t of artifactTraits) {
      if (!unit.traits.includes(t)) unit.traits.push(t);
    }
  }
}

export function formatArtifactModifierFr(statKey, level = 0, extraData = null) {
  const c = canonicalArtifactStatKey(statKey);
  if (c === 'immune') return 'Immunité au 1er tour';
  if (c === 'xp_boost') return '+50 % XP gagnée partout';
  if (c.startsWith('trait_')) {
    const trait = TRAIT_ARTIFACT_TO_TRAIT[c];
    const label = ARTIFACT_STAT_LABELS_FR[c] || trait || c;
    return `Octroie le trait ${label}`;
  }
  if (c === 'dual_bonus' && extraData?.bonuses?.length) {
    const lv = Math.max(0, Number(level) || 0);
    const labels = extraData.bonuses.map((b) => {
      const canonB = canonicalArtifactStatKey(b);
      const opt = DUAL_BONUS_OPTIONS.find((o) => o.key === canonB);
      if (!opt) return '';
      const val = opt.value * (1 + lv);
      return `+${val} ${ARTIFACT_STAT_LABELS_FR[canonB] || canonB}`;
    }).filter(Boolean);
    return labels.join(', ');
  }
  const label = ARTIFACT_STAT_LABELS_FR[c] || c;
  return `+${getArtifactBonusValue(c, level)} ${label}`;
}
