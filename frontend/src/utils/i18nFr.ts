/**
 * Internationalisation FR — libellés centralisés pour l'UI (rareté, type d'attaque, rôle, etc.)
 * Gère les clés API (anglais/minuscule) et affichage français.
 */

export const RARITY_FR: Record<string, string> = {
  COMMON: 'Commune',
  UNCOMMON: 'Peu commune',
  RARE: 'Rare',
  EPIC: 'Épique',
  LEGENDARY: 'Légendaire',
  MYTHIC: 'Mythique'
};

export const ATTACK_TYPE_FR: Record<string, string> = {
  MELEE: 'Corps à corps',
  RANGED: 'Distance',
  MAGIC: 'Distance',
  CAC: 'Corps à corps',
  DISTANCE: 'Distance'
};

export const ROLE_FR: Record<string, string> = {
  TANK: 'Tank',
  ASSASSIN: 'Assassin',
  SUPPORT: 'Soutien',
  SOUTIEN: 'Soutien',
  DPS: 'DPS',
  FRONTLINE: 'Frontline',
  BACKLINE: 'Backline',
  RANGED: 'DPS',
  CAC: 'Corps à corps',
  DISTANCE: 'Distance',
  MELEE: 'Corps à corps'
};

export const ARCHETYPE_FR: Record<string, string> = {
  CAC_TANK: 'Mêlée',
  CAC_DPS: 'Mêlée',
  MELEE: 'Mêlée',
  DISTANCE: 'Distance'
};

export const ELEMENT_FR: Record<string, string> = {
  WATER: 'Eau',
  FIRE: 'Feu',
  PLANT: 'Plante',
  LIGHT: 'Lumière',
  LUMIERE: 'Lumière',
  DARK: 'Ténèbres',
  TENEBRES: 'Ténèbres',
  NEUTRE: 'Neutre',
  NEUTRAL: 'Neutre',
  EAU: 'Eau',
  FEU: 'Feu',
  PLANTE: 'Plante'
};

export const SKILL_KEY_FR: Record<string, string> = {
  BASIC: 'Attaque de base',
  DAMAGE_SINGLE: 'Dégâts monocible',
  DAMAGE_AOE: 'Dégâts de zone',
  SHIELD: 'Bouclier',
  SHIELD_SELF: 'Bouclier sur soi',
  HEAL: 'Soin',
  HEALS: 'Soins',
  BUFF: 'Bonus',
  APPLY_DEBUFF: 'Applique un débuff',
  DEBUFF: 'Débuff'
};

export const STAT_FR: Record<string, string> = {
  HP: 'PV',
  ATK: 'ATQ',
  DEF: 'DEF',
  SPD: 'VIT',
  MASTERY: 'Maîtrise',
  MAX_HP: 'PV max',
  BASE_HP: 'PV base',
  BASE_ATTACK: 'ATQ base',
  BASE_DEFENSE: 'DEF base',
  BASE_SPEED: 'VIT base'
};

/** Traits (singulier français) : clé API → libellé FR affiché */
export const TRAIT_FR: Record<string, string> = {
  GUARDIANS: 'Gardien',
  DRUIDS: 'Druide',
  ARCANISTS: 'Arcaniste',
  EXECUTIONERS: 'Bourreau',
  BERSERKERS: 'Berserker',
  TACTICIANS: 'Tacticien'
};

function normKey(key: string | undefined | null): string {
  if (key == null || key === '') return '';
  return String(key).toUpperCase().replace(/\s+/g, '_');
}

/** Rareté : clé API (common, uncommon…) → libellé FR */
export function toRarityFr(key: string | undefined | null): string {
  if (!key) return '—';
  const k = String(key).toLowerCase();
  const byLower: Record<string, string> = {
    common: RARITY_FR.COMMON,
    uncommon: RARITY_FR.UNCOMMON,
    rare: RARITY_FR.RARE,
    epic: RARITY_FR.EPIC,
    legendary: RARITY_FR.LEGENDARY,
    mythic: RARITY_FR.MYTHIC
  };
  return byLower[k] ?? RARITY_FR[normKey(key)] ?? key;
}

/** Type d'attaque : melee / ranged / magic → FR */
export function toAttackTypeFr(key: string | undefined | null): string {
  if (!key) return '—';
  const k = String(key).toLowerCase();
  if (k === 'melee') return ATTACK_TYPE_FR.MELEE;
  if (k === 'ranged' || k === 'magic') return ATTACK_TYPE_FR.RANGED;
  return ATTACK_TYPE_FR[normKey(key)] ?? key;
}

/** Rôle : tank, support, frontline… → FR */
export function toRoleFr(key: string | undefined | null): string {
  if (!key) return '—';
  const k = normKey(key);
  return ROLE_FR[k] ?? ROLE_FR[String(key).toLowerCase()] ?? key;
}

/** Rôle affiché en combat (Tank, DPS, Soutien, Assassin) à partir de role ou archetype. */
export function combatRoleLabel(role?: string | null, archetype?: string | null): string {
  const r = (role ?? '').toString().toLowerCase();
  const arch = (archetype ?? '').toString().toUpperCase();
  if (['tank', 'assassin', 'support', 'soutien', 'dps'].includes(r)) return toRoleFr(role);
  if (arch === 'CAC_TANK') return 'Tank';
  if (arch === 'CAC_DPS') return 'Assassin';
  if (arch.includes('SUPPORT')) return 'Soutien';
  if (arch.includes('DISTANCE') || arch.includes('DPS')) return 'DPS';
  if (r === 'ranged') return 'DPS';
  if (r === 'melee') return 'Mêlée';
  const fr = toRoleFr(role);
  return fr === '—' ? '' : fr;
}

/** Archétype : CAC_TANK, DISTANCE_*… → FR */
export function toArchetypeFr(key: string | undefined | null): string {
  if (!key) return '—';
  const k = String(key).toUpperCase();
  if (k === 'CAC_TANK' || k === 'CAC_DPS') return ARCHETYPE_FR.MELEE;
  if (k.startsWith('DISTANCE')) return ARCHETYPE_FR.DISTANCE;
  return ARCHETYPE_FR[k] ?? key;
}

/** Élément : water, fire, plant, light, dark, neutral → FR (majuscule initiale) */
export function toElementFr(key: string | undefined | null): string {
  if (!key) return '—';
  const k = String(key).toLowerCase();
  const byLower: Record<string, string> = {
    water: ELEMENT_FR.WATER,
    fire: ELEMENT_FR.FIRE,
    plant: ELEMENT_FR.PLANT,
    light: ELEMENT_FR.LIGHT,
    lumiere: ELEMENT_FR.LUMIERE,
    dark: ELEMENT_FR.DARK,
    tenebres: ELEMENT_FR.TENEBRES,
    neutral: ELEMENT_FR.NEUTRAL
  };
  return byLower[k] ?? ELEMENT_FR[normKey(key)] ?? key;
}

/** Type de compétence (skill key) → libellé FR */
export function toSkillKeyFr(key: string | undefined | null): string {
  if (!key) return '—';
  const k = normKey(key);
  return SKILL_KEY_FR[k] ?? key;
}

/** Libellé de stat (PV, ATQ, DEF, VIT, Maîtrise) */
export function toStatFr(key: string | undefined | null): string {
  if (!key) return '—';
  const k = normKey(key);
  const byKey: Record<string, string> = {
    BASE_HP: STAT_FR.HP,
    BASE_ATTACK: STAT_FR.ATK,
    BASE_DEFENSE: STAT_FR.DEF,
    BASE_SPEED: STAT_FR.SPD,
    MAXHP: STAT_FR.MAX_HP,
    ATTACK: STAT_FR.ATK,
    DEFENSE: STAT_FR.DEF,
    SPEED: STAT_FR.SPD,
    MASTERY: STAT_FR.MASTERY
  };
  return byKey[k] ?? STAT_FR[k] ?? key;
}

/** Trait (clé API) → libellé français au singulier */
export function toTraitFr(key: string | undefined | null): string {
  if (!key) return '—';
  const k = normKey(key);
  return TRAIT_FR[k] ?? key;
}

/** Mapping FR (minuscule, normalisé) → clé API pour la recherche par trait */
export const TRAIT_FR_TO_KEY: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const [key, fr] of Object.entries(TRAIT_FR)) {
    const norm = String(fr).toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
    map[norm] = key;
    map[String(fr).toLowerCase()] = key;
  }
  return map;
})();

/** Résout une chaîne de recherche (ex. "gardien") en clé de trait (ex. "GUARDIANS") si elle correspond. */
export function resolveTraitFromSearch(search: string): string | null {
  const q = search.toLowerCase().trim();
  if (!q) return null;
  const norm = q.normalize('NFD').replace(/\p{M}/gu, '');
  return TRAIT_FR_TO_KEY[norm] ?? TRAIT_FR_TO_KEY[q] ?? null;
}
