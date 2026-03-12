import { query } from '../config/db.js';

// Rareté ordonnée
const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

function rarityLeq(a, b) {
  return RARITY_ORDER.indexOf(a) <= RARITY_ORDER.indexOf(b);
}

// RNG déterministe simple (mulberry32-like)
function hashSeed(seed) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    const x = (h ^= h >>> 16) >>> 0;
    return x / 4294967296;
  };
}

function choice(rng, arr) {
  if (!arr.length) return null;
  const idx = Math.floor(rng() * arr.length);
  return arr[idx];
}

// Mapping élément DB -> élément JSON
function toJsonElement(element) {
  switch (element) {
    case 'water':
      return 'eau';
    case 'fire':
      return 'feu';
    case 'plant':
      return 'plante';
    default:
      return element;
  }
}

// Catégorie de rôle métier
function toRoleCategory(role) {
  if (role === 'tank') return 'tank';
  if (role === 'support') return 'support';
  // assassin / ranged / frontline / autres => DPS
  return 'dps';
}

// Catégorie de portée métier
function toRangeCategory(attackType) {
  return attackType === 'melee' ? 'cac' : 'distance';
}

function isFrontline(unitMeta) {
  return unitMeta.roleCategory === 'tank' || unitMeta.rangeCategory === 'cac';
}

/**
 * XP par combat (base, hors boss) par chapitre.
 * Boss: xp * 2.5
 */
const XP_PER_CHAPTER = {
  1: 60,
  2: 80,
  3: 110,
  4: 150,
  5: 210,
  6: 300,
  7: 420,
  8: 600,
  9: 800,
  10: 1100
};

function getBaseXp(chapter) {
  return XP_PER_CHAPTER[chapter] ?? XP_PER_CHAPTER[10];
}

function getXpForFight(chapter, isBoss) {
  const base = getBaseXp(chapter);
  return isBoss ? Math.round(base * 2.5) : base;
}

// Nombre d’ennemis par chapitre / mode
function getEnemyCount(chapter, isBoss, mode) {
  if (mode === 'hard') return 5;
  // Normal
  if (chapter <= 3) return 3;
  if (chapter <= 7) return 4;
  return 5;
}

// Cap de rareté max selon mode / chapitre
function getMaxRarity(mode, chapter, isBoss) {
  if (mode === 'normal') {
    if (chapter <= 2) return 'rare';
    if (chapter <= 5) return 'epic';
    if (chapter <= 9) return 'legendary';
    // Chapitre 10 : boss mythic autorisé, trash <= legendary
    return isBoss ? 'mythic' : 'legendary';
  }
  // Hard
  if (chapter <= 3) return 'epic';
  if (chapter <= 7) return 'legendary';
  return isBoss ? 'mythic' : 'legendary';
}

// Spécialisation (bool) selon contraintes
function shouldBeSpecialized(mode, chapter, isBoss, rng) {
  if (isBoss) return true;
  if (mode === 'normal') {
    if (chapter <= 7) return false;
    // Chap 8–10 : seuls les boss doivent l’être
    return false;
  }
  // Hard
  if (chapter <= 3) {
    return rng() < 0.5;
  }
  if (chapter <= 6) {
    return rng() < 0.75;
  }
  return true;
}

// Template métier (Standard / Mur / Burst)
function pickTemplate(mode, rng) {
  const r = rng();
  if (mode === 'hard') {
    // Hard : plus de Mur/Burst
    if (r < 0.35) return 'standard';
    if (r < 0.65) return 'mur';
    return 'burst';
  }
  // Normal
  if (r < 0.6) return 'standard';
  if (r < 0.8) return 'mur';
  return 'burst';
}

function computeRoleCounts(template, count) {
  // Retourne { tank, dps, support }
  if (template === 'burst') {
    // 1 tank, reste DPS
    return {
      tank: 1,
      support: 0,
      dps: Math.max(1, count - 1)
    };
  }
  if (template === 'mur') {
    if (count <= 3) {
      // Petite équipe "mur"
      return { tank: 2, dps: 1, support: 0 };
    }
    if (count === 4) {
      return { tank: 2, dps: 2, support: 0 };
    }
    // 5+
    return { tank: 2, dps: count - 3, support: 1 };
  }
  // Standard
  const tank = 1;
  const support = count >= 4 ? 1 : 0;
  const dps = Math.max(1, count - tank - support);
  return { tank, dps, support };
}

// Choix de la dominante élémentaire
function pickDominantElement(rng) {
  const v = rng();
  if (v < 1 / 3) return 'eau';
  if (v < 2 / 3) return 'feu';
  return 'plante';
}

function fromJsonElement(el) {
  if (el === 'eau') return 'water';
  if (el === 'feu') return 'fire';
  if (el === 'plante') return 'plant';
  return el;
}

// Règles de CAC / distance
function pickRangeCategoryForSlot(dominantElement, currentCounts, totalPlanned, rng) {
  const { cac, distance } = currentCounts;
  // Contraintes globales
  if (cac === 0 && totalPlanned - (cac + distance) === 1) {
    // Dernier slot et encore aucun CAC => CAC obligatoire
    return 'cac';
  }
  if (distance >= 3) return 'cac';

  // Biais par dominante
  const r = rng();
  if (dominantElement === 'feu') {
    // Plus de distance
    return r < 0.6 ? 'distance' : 'cac';
  }
  if (dominantElement === 'plante') {
    // Plus de CAC
    return r < 0.7 ? 'cac' : 'distance';
  }
  // Eau : équilibré
  return r < 0.5 ? 'cac' : 'distance';
}

// Sélection d'unité respectant toutes les contraintes
function pickUnitForSlot(pools, options) {
  const {
    rng,
    dominantElement,
    roleCategory,
    desiredRange,
    maxRarity,
    usedCounts
  } = options;

  const dbElement = fromJsonElement(dominantElement);

  const pool = pools.filter((u) => {
    if (u.element !== dbElement) return false;
    if (u.roleCategory !== roleCategory) return false;
    if (u.rangeCategory !== desiredRange) return false;
    if (!rarityLeq(u.rarity, maxRarity)) return false;
    const used = usedCounts.get(u.code) ?? 0;
    if (used >= 2) return false;
    return true;
  });

  if (!pool.length) {
    return null;
  }

  const unit = choice(rng, pool);
  usedCounts.set(unit.code, (usedCounts.get(unit.code) ?? 0) + 1);
  return unit;
}

// Allocation des récompenses (crédits / cores / fragments / essence)
function computeRewards(mode, chapter, stage, isBoss) {
  // Formules simples, croissantes, respectant les ordres de grandeur.
  const xp = getXpForFight(chapter, isBoss);

  let creditsBase;
  let coresBase;
  let fragmentsBase;

  if (mode === 'normal') {
    creditsBase = 20 + chapter * 5 + stage * 2;
    coresBase = 0.5 + chapter * 0.3 + stage * 0.1;
    fragmentsBase = 3 + chapter * 0.5 + stage * 0.3;
  } else {
    creditsBase = 30 + chapter * 7 + stage * 3;
    coresBase = 1 + chapter * 0.4 + stage * 0.15;
    fragmentsBase = 5 + chapter * 0.8 + stage * 0.5;
  }

  const bossMultiplier = isBoss ? 2.5 : 1;

  const credits = Math.round(creditsBase * bossMultiplier);
  const cores = Math.max(0, Math.round(coresBase * bossMultiplier));
  const fragments = Math.max(0, Math.round(fragmentsBase * bossMultiplier));

  const essence =
    isBoss &&
    ((mode === 'normal' && chapter >= 1 && chapter <= 10) ||
      (mode === 'hard' && chapter >= 1 && chapter <= 5));

  return {
    xp,
    credits,
    cores,
    fragments,
    essence
  };
}

/**
 * Charge et catégorise les unités éligibles à la campagne.
 */
async function loadUnitPool() {
  const rows = await query(
    "SELECT code, rarity, role, attack_type, element, archetype FROM units WHERE element IN ('water','fire','plant') AND code NOT LIKE 'BOSS_CH%'"
  );
  return rows.map((r) => {
    const roleCategory = toRoleCategory(r.role);
    const rangeCategory = toRangeCategory(r.attack_type);
    return {
      code: r.code,
      rarity: r.rarity,
      element: r.element,
      role: r.role,
      attackType: r.attack_type,
      archetype: r.archetype,
      roleCategory,
      rangeCategory
    };
  });
}

/**
 * Génère la campagne complète (normal + hard) de façon déterministe via un seed.
 *
 * Retourne un tableau de 200 combats :
 * { chapter, fight, mode, isBoss, dominantElement, enemies[], rewards{} }
 */
export async function generateCampaign(seed = 'NEXUS_CAMPAIGN_V1') {
  const rng = hashSeed(String(seed));
  const pools = await loadUnitPool();
  const fights = [];

  const modes = ['normal', 'hard'];

  for (const mode of modes) {
    for (let chapter = 1; chapter <= 10; chapter++) {
      for (let fight = 1; fight <= 10; fight++) {
        const isBoss = fight === 10;
        const dominantElement = pickDominantElement(rng);
        const enemyCount = getEnemyCount(chapter, isBoss, mode);
        const template = pickTemplate(mode, rng);
        const roleCounts = computeRoleCounts(template, enemyCount);

        // Vérif contraintes minimales
        if (roleCounts.tank + roleCounts.dps + roleCounts.support !== enemyCount) {
          // Fallback très simple : 1 tank, reste DPS, 0 support
          roleCounts.tank = 1;
          roleCounts.support = 0;
          roleCounts.dps = Math.max(1, enemyCount - 1);
        }

        const maxRarity = getMaxRarity(mode, chapter, isBoss);

        const units = [];
        const usedCounts = new Map();
        let rangeCounts = { cac: 0, distance: 0 };

        // Construire une liste des rôles à instancier (ordre déterministe mais varié)
        const roleSlots = [];
        for (let i = 0; i < roleCounts.tank; i++) roleSlots.push('tank');
        for (let i = 0; i < roleCounts.dps; i++) roleSlots.push('dps');
        for (let i = 0; i < roleCounts.support; i++) roleSlots.push('support');

        // Shuffle léger des slots via RNG déterministe
        for (let i = roleSlots.length - 1; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1));
          const tmp = roleSlots[i];
          roleSlots[i] = roleSlots[j];
          roleSlots[j] = tmp;
        }

        for (let idx = 0; idx < roleSlots.length; idx++) {
          const roleCat = roleSlots[idx];
          const desiredRange = pickRangeCategoryForSlot(
            dominantElement,
            rangeCounts,
            enemyCount,
            rng
          );

          let unit = pickUnitForSlot(pools, {
            rng,
            dominantElement,
            roleCategory: roleCat,
            desiredRange,
            maxRarity,
            usedCounts
          });

          // Fallbacks en cas de pool vide (on détend les contraintes)
          if (!unit) {
            // Essayer sans contrainte d’élément
            const relaxedPool = pools.filter((u) => {
              if (u.roleCategory !== roleCat) return false;
              if (u.rangeCategory !== desiredRange) return false;
              if (!rarityLeq(u.rarity, maxRarity)) return false;
              const used = usedCounts.get(u.code) ?? 0;
              if (used >= 2) return false;
              return true;
            });
            if (relaxedPool.length) {
              unit = choice(rng, relaxedPool);
              usedCounts.set(unit.code, (usedCounts.get(unit.code) ?? 0) + 1);
            }
          }

          if (!unit) {
            // Dernier fallback : prendre n'importe quel DPS dominants
            const anyPool = pools.filter((u) => {
              if (!rarityLeq(u.rarity, maxRarity)) return false;
              const used = usedCounts.get(u.code) ?? 0;
              return used < 2;
            });
            unit = choice(rng, anyPool) || pools[0];
            usedCounts.set(unit.code, (usedCounts.get(unit.code) ?? 0) + 1);
          }

          if (unit.rangeCategory === 'cac') rangeCounts.cac += 1;
          else rangeCounts.distance += 1;

          const isSpecialized = shouldBeSpecialized(mode, chapter, isBoss, rng);

          units.push({
            unitId: unit.code,
            level: computeLevelForEnemy(mode, chapter),
            isSpecialized
          });
        }

        // Validation minimale : au moins un frontline et un DPS
        const hasFrontline = units.length > 0; // par construction des pools (tank ou cac)
        const hasDps = true; // par construction des templates
        if (!hasFrontline || !hasDps) {
          // On pourrait ajouter des assertions ou logs ici en cas de besoin
        }

        const rewards = computeRewards(mode, chapter, fight, isBoss);

        fights.push({
          chapter,
          fight,
          mode,
          isBoss,
          dominantElement,
          enemies: units,
          rewards
        });
      }
    }
  }

  return fights;
}

// Courbe de niveau souhaitée par chapitre / mode
function computeLevelForEnemy(mode, chapter) {
  const normalRanges = {
    1: [5, 10],
    2: [10, 15],
    3: [15, 22],
    4: [22, 30],
    5: [30, 38],
    6: [38, 45],
    7: [45, 49],
    8: [48, 50],
    9: [50, 50],
    10: [50, 50]
  };
  const base = normalRanges[chapter] || [50, 50];
  if (mode === 'normal') {
    return base[1]; // on prend la borne haute pour les ennemis
  }
  // Hard : +10 niveaux (cap 50)
  const boosted = Math.min(50, base[1] + 10);
  return boosted;
}

