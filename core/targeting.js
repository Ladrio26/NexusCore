// Gestion du ciblage : CAC / distance, positions front / back,
// provocation, focus dynamique, et résolution unifiée (resolveTargets).

import { getEffectiveCombatStats } from './effects.js';
import { hasElementAdvantage } from './utils/element.js';

export function hasProvoke(unit) {
  if (!unit?.debuffs) return false;
  for (const d of unit.debuffs) {
    if (String(d.type || d.key || '').toUpperCase() === 'PROVOKE') return true;
  }
  return false;
}

/**
 * Retourne l'unité qui a appliqué PROVOKE sur `unit` (le « lanceur »),
 * ou null si introuvable / morte / même camp.
 */
export function getProvokerUnit(state, unit) {
  if (!state?.units || !unit?.debuffs) return null;
  let appliedByUid = null;
  for (const d of unit.debuffs) {
    if (String(d.type || d.key || '').toUpperCase() === 'PROVOKE') {
      appliedByUid = d.meta?.appliedBy ?? null;
      break;
    }
  }
  if (!appliedByUid) return null;
  const provoker = state.units.find((u) => u.uid === appliedByUid);
  if (!provoker || provoker.side === unit.side || !provoker.alive) return null;
  return provoker;
}

/**
 * Choisit une cible ennemie (une seule).
 * @param {Array} units - Toutes les unités
 * @param {Object} actor - Unité qui agit
 * @param {{ ignoreTargetingRules?: boolean, ignoreProvocation?: boolean, ignoreDistanceRestriction?: boolean }} options
 */
export function chooseTarget(units, actor, options = {}) {
  const enemies = units.filter((u) => u.side !== actor.side && u.alive === true);
  if (!enemies.length) return null;

  if (options.ignoreTargetingRules || options.ignoreDistanceRestriction) {
    enemies.sort((a, b) => a.hp - b.hp);
    return enemies[0];
  }

  // Règle PROVOKE : l'unité avec PROVOKE doit attaquer le lanceur (provoker).
  if (!options.ignoreProvocation && options.state && hasProvoke(actor)) {
    const provoker = getProvokerUnit(options.state, actor);
    if (provoker) return provoker;
  }

  const front = enemies.filter((u) => u.position === 'front');
  const back = enemies.filter((u) => u.position === 'back');

  if (actor.rangeType === 'melee') {
    const pool = front.length > 0 ? front : back;
    pool.sort((a, b) => a.hp - b.hp);
    return pool[0];
  }

  if (front.length > 0) {
    front.sort((a, b) => a.hp - b.hp);
    return front[0];
  }

  back.sort((a, b) => a.hp - b.hp);
  return back[0];
}

/**
 * Restreint le pool ennemi aux cibles à portée (CAC = front prioritaire).
 * Ne modifie pas les tableaux, retourne un nouveau pool.
 */
function applyRangeRestriction(units, actor, enemyPool) {
  if (!enemyPool.length) return [];
  const front = enemyPool.filter((u) => u.position === 'front');
  const back = enemyPool.filter((u) => u.position === 'back');
  if (actor.rangeType === 'melee') {
    return front.length > 0 ? front : back;
  }
  return [...front, ...back];
}

/** Stats courantes (avec buffs/debuffs) pour le focus dynamique. */
function getCurrentStats(unit) {
  const stats = getEffectiveCombatStats(unit);
  return {
    currentHp: unit.hp ?? 0,
    maxHp: unit.maxHp ?? 1,
    currentAtk: stats.attack,
    currentDef: stats.defense,
    currentSpeed: stats.speed,
    buffCount: (unit.buffs || []).length
  };
}

/**
 * Cibles valides pour une attaque : respecte CAC (front uniquement si au moins un) / Distance.
 * @param {Object} attacker
 * @param {Array} enemyTeam - Ennemis vivants
 * @param {boolean} isSkill - Si true, tous les ennemis vivants sont valides (skill ignore CAC).
 */
export function getValidTargets(attacker, enemyTeam, isSkill) {
  const alive = enemyTeam.filter((u) => u && u.alive === true);
  if (!alive.length) return [];

  if (isSkill) return [...alive];

  const isMelee = (attacker.rangeType || '').toLowerCase() === 'melee';
  if (!isMelee) return [...alive];

  const front = alive.filter((u) => (u.position || 'front') === 'front');
  return front.length > 0 ? front : alive;
}

function getExtremum(units, selector, direction) {
  if (!units.length) return [];
  const sorted = [...units].sort((a, b) =>
    direction === 'LOW' ? selector(a) - selector(b) : selector(b) - selector(a)
  );
  const bestValue = selector(sorted[0]);
  return sorted.filter((u) => selector(u) === bestValue);
}

function applyFocusRule(candidates, rule, getStats) {
  switch (String(rule || '').toUpperCase()) {
    case 'LOWEST_HP':
      return getExtremum(candidates, (u) => getStats(u).currentHp, 'LOW');
    case 'HIGHEST_HP':
      return getExtremum(candidates, (u) => getStats(u).currentHp, 'HIGH');
    case 'LOWEST_PERCENT_HP':
      return getExtremum(candidates, (u) => getStats(u).currentHp / getStats(u).maxHp || 1, 'LOW');
    case 'HIGHEST_PERCENT_HP':
      return getExtremum(candidates, (u) => getStats(u).currentHp / getStats(u).maxHp || 1, 'HIGH');
    case 'LOWEST_ATK':
      return getExtremum(candidates, (u) => getStats(u).currentAtk, 'LOW');
    case 'HIGHEST_ATK':
      return getExtremum(candidates, (u) => getStats(u).currentAtk, 'HIGH');
    case 'LOWEST_DEF':
      return getExtremum(candidates, (u) => getStats(u).currentDef, 'LOW');
    case 'HIGHEST_DEF':
      return getExtremum(candidates, (u) => getStats(u).currentDef, 'HIGH');
    case 'LOWEST_SPEED':
      return getExtremum(candidates, (u) => getStats(u).currentSpeed, 'LOW');
    case 'HIGHEST_SPEED':
      return getExtremum(candidates, (u) => getStats(u).currentSpeed, 'HIGH');
    case 'MOST_BUFFS':
      return getExtremum(candidates, (u) => getStats(u).buffCount, 'HIGH');
    default:
      return candidates;
  }
}

function handleNoFocus(attacker, candidates, rng) {
  const adv = candidates.filter((u) => hasElementAdvantage(attacker.element, u.element));
  if (adv.length) return adv[Math.floor(rng() * adv.length)];
  const same = candidates.filter((u) => String(u.element || '').toLowerCase() === String(attacker.element || '').toLowerCase());
  if (same.length) return same[Math.floor(rng() * same.length)];
  return candidates[Math.floor(rng() * candidates.length)];
}

/**
 * Sélectionne une cible selon la règle de focus (stats dynamiques, provoke, tie-break élémentaire).
 * @param {Object} attacker
 * @param {Array} enemyTeam - Ennemis vivants
 * @param {string} focusRule - NO_FOCUS, LOWEST_HP, RANDOM, etc.
 * @param {boolean} isSkill
 * @param {Object} state - pour PROVOKE (state.units)
 * @param {Function} rng - 0..1
 * @returns {Object|null} Unité cible ou null
 */
/**
 * PROVOKE a priorité sur le focus (basic_targeting / skill_targeting) du team builder :
 * si l'attaquant a PROVOKE, la cible est toujours le lanceur du PROVOKE.
 */
export function selectTarget(attacker, enemyTeam, focusRule, isSkill, state, rng = Math.random) {
  const candidates = getValidTargets(attacker, enemyTeam, isSkill);
  if (!candidates.length) return null;

  if (state && hasProvoke(attacker)) {
    const provoker = getProvokerUnit(state, attacker);
    if (provoker && candidates.some((c) => c.uid === provoker.uid)) return provoker;
  }

  const rule = String(focusRule || 'NO_FOCUS').toUpperCase();

  if (rule === 'RANDOM') {
    return candidates[Math.floor(rng() * candidates.length)];
  }

  if (rule === 'NO_FOCUS') {
    return handleNoFocus(attacker, candidates, rng);
  }

  const getStats = (u) => getCurrentStats(u);
  let filtered = applyFocusRule(candidates, rule, getStats);

  const withAdvantage = filtered.filter((u) => hasElementAdvantage(attacker.element, u.element));
  if (withAdvantage.length) filtered = withAdvantage;

  return filtered[Math.floor(rng() * filtered.length)];
}

/**
 * Résout la ou les cibles pour un effet de skill.
 * Fonction pure : ne modifie pas state, ne log pas. Retourne uniquement un tableau de cibles.
 * @param {Object} state - state.units, state.rng, state.lastResurrectedUnit
 * @param {Object} actor - Unité qui lance la skill
 * @param {Object} cfg - Config effet : target, count, ignoreTargetingRules, ignoreProvocation
 * @returns {Array} Liste d'unités cibles (peut être vide)
 */
export function resolveTargets(state, actor, cfg) {
  if (!actor?.alive) return [];
  const units = state?.units ?? [];
  const targetKey = (cfg?.target ?? '').toUpperCase();
  const ignoreRules = !!cfg?.ignoreTargetingRules;
  const ignoreProvocation = !!cfg?.ignoreProvocation;
  const count = typeof cfg?.count === 'number' && cfg.count >= 1 ? Math.floor(cfg.count) : null;
  const rng = state?.rng != null && typeof state.rng === 'function' ? state.rng : Math.random;
  const allowDead = cfg?.targetDead === true;

  function filterAlive(targets) {
    return allowDead ? targets : targets.filter((t) => t.alive);
  }

  // --- Étape 1 : Groupe brut ---
  if (targetKey === 'SELF') {
    return filterAlive([actor]);
  }

  if (targetKey === 'RESURRECTED') {
    const u = state?.lastResurrectedUnit ?? null;
    if (u && u.alive) return [u];
    return [];
  }

  const isEnemyTarget =
    targetKey === 'TEAM_ENEMY' ||
    targetKey === 'ENEMY_SINGLE' ||
    targetKey === 'RANDOM_ENEMY' ||
    targetKey === 'LOWEST_HP_ENEMY' ||
    targetKey === 'HIGHEST_ATK_ENEMY' ||
    targetKey === 'HIGHEST_SPEED_ENEMY';

  // Règle PROVOKE : l'unité avec PROVOKE doit attaquer le lanceur.
  if (isEnemyTarget && !ignoreProvocation && hasProvoke(actor)) {
    const provoker = getProvokerUnit(state, actor);
    if (provoker) {
      const n = count != null && count >= 1 ? Math.min(count, 1) : 1;
      return filterAlive(n ? [provoker] : []);
    }
  }

  const enemies = units.filter((u) => u.side !== actor.side && u.alive === true);
  const allies = units.filter((u) => u.side === actor.side && u.alive === true);

  const isAllyTarget =
    targetKey === 'TEAM_ALLY' ||
    targetKey === 'ALLY_SINGLE' ||
    targetKey === 'RANDOM_ALLY' ||
    targetKey === 'LOWEST_HP_ALLY' ||
    targetKey === 'HIGHEST_HP_ALLY';

  let pool = [];

  if (isEnemyTarget) {
    pool = [...enemies];
    // CAC / Distance (plus de restriction « uniquement ennemis avec PROVOKE »)
    if (!ignoreRules && pool.length > 0 && actor.rangeType === 'melee') {
      pool = applyRangeRestriction(units, actor, pool);
    }
  } else if (isAllyTarget) {
    pool = [...allies];
  } else if (targetKey === 'RANDOM_ANY') {
    pool = [...enemies, ...allies];
  }

  // --- Ciblage allié mort (RESURRECT) ---
  if (targetKey === 'ALLY_DEAD_SINGLE' || (cfg?.type === 'RESURRECT' && !targetKey)) {
    const dead = units.filter((u) => u.side === actor.side && !u.alive);
    if (dead.length === 0) return [];
    dead.sort((a, b) => (a.maxHp || 0) - (b.maxHp || 0));
    return [dead[0]];
  }

  // --- Étape 4 : Méthodes spécifiques ---
  const take = (arr, n) => {
    if (n == null || n < 1) return arr;
    return arr.slice(0, n);
  };

  const shuffle = (arr) => {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };

  switch (targetKey) {
    case 'TEAM_ENEMY':
      // Toujours toute l'équipe ennemie (ignorer count pour cohérence sémantique).
      return filterAlive([...pool]);
    case 'TEAM_ALLY':
      // Toujours toute l'équipe alliée (ignorer count pour cohérence sémantique).
      return filterAlive([...pool]);
    case 'ENEMY_SINGLE': {
      if (pool.length === 0) return [];
      const focusRule = actor.skill_targeting || 'NO_FOCUS';
      const one = selectTarget(actor, pool, focusRule, true, state, rng);
      if (one) return filterAlive(take([one], count ?? 1));
      pool.sort((a, b) => a.hp - b.hp);
      return filterAlive(take(pool, count ?? 1));
    }
    case 'ALLY_SINGLE': {
      const aliveAllies = allies.filter((u) => u.uid !== actor.uid);
      if (aliveAllies.length === 0) return filterAlive([actor]);
      aliveAllies.sort((a, b) => (a.hp / (a.maxHp || 1)) - (b.hp / (b.maxHp || 1)));
      return filterAlive(take(aliveAllies, count ?? 1));
    }
    case 'RANDOM_ENEMY':
      if (pool.length === 0) return [];
      return filterAlive(take(shuffle(pool), count ?? 1));
    case 'RANDOM_ALLY':
      if (pool.length === 0) return [];
      return filterAlive(take(shuffle(pool), count ?? 1));
    case 'LOWEST_HP_ENEMY':
      if (pool.length === 0) return [];
      pool.sort((a, b) => (a.hp / (a.maxHp || 1)) - (b.hp / (b.maxHp || 1)));
      return filterAlive(take(pool, count ?? 1));
    case 'LOWEST_HP_ALLY':
      if (pool.length === 0) return [];
      pool.sort((a, b) => (a.hp / (a.maxHp || 1)) - (b.hp / (b.maxHp || 1)));
      return filterAlive(take(pool, count ?? 1));
    case 'HIGHEST_ATK_ENEMY':
      if (pool.length === 0) return [];
      pool.sort((a, b) => (b.attack ?? b.base_attack ?? 0) - (a.attack ?? a.base_attack ?? 0));
      return filterAlive(take(pool, count ?? 1));
    case 'HIGHEST_SPEED_ENEMY':
      if (pool.length === 0) return [];
      pool.sort((a, b) => (b.speed ?? b.base_speed ?? 0) - (a.speed ?? a.base_speed ?? 0));
      return filterAlive(take(pool, count ?? 1));
    case 'HIGHEST_HP_ALLY':
      if (pool.length === 0) return [];
      pool.sort((a, b) => (b.hp / (b.maxHp || 1)) - (a.hp / (a.maxHp || 1)));
      return filterAlive(take(pool, count ?? 1));
    case 'RANDOM_ANY':
      if (pool.length === 0) return [];
      return filterAlive(take(shuffle(pool), count ?? 1));
    case '':
      if (enemies.length === 0) return [];
      const one = chooseTarget(units, actor, {
        ignoreTargetingRules: ignoreRules,
        ignoreProvocation,
        state
      });
      return filterAlive(one ? [one] : []);
    default:
      return [];
  }
}
