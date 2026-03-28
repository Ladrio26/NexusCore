/**
 * BotDungeonPlanner.js
 * Stratégie donjon du bot : push progression vs farm artefacts.
 *
 * État donjon dans botState.dungeonState :
 * {
 *   failures:     { [element]: number },   // échecs consécutifs sur le niveau max
 *   farmUntil:    { [element]: timestamp }, // timestamp avant lequel on reste en mode farm
 *   lastAttempted:{ [element]: number }     // dernier niveau tenté par élément
 * }
 */

import { getDungeonStatus, DUNGEON_ELEMENTS } from '../services/dungeonService.js';

/**
 * Retourne le plan de donjon optimal pour ce tick.
 * Retourne { element, level, mode: 'push'|'farm' } ou null si impossible.
 */
export async function getDungeonPlan(userId, botState, profile) {
  let status;
  try {
    status = await getDungeonStatus(userId);
  } catch {
    return null;
  }

  // Si un run est déjà en cours, signaler pour que l'executor le continue
  if (status.activeRun) {
    return {
      element:    status.activeRun.element,
      level:      status.activeRun.current_level ?? 1,
      mode:       'continue',
      hasActiveRun: true,
    };
  }

  const progress  = status.progress ?? {};
  const strategy  = profile.dungeonStrategy ?? 'balanced';
  const failures  = botState.dungeonState?.failures   ?? {};
  const farmUntil = botState.dungeonState?.farmUntil  ?? {};
  const now       = Date.now();

  const elements  = Array.isArray(DUNGEON_ELEMENTS) ? DUNGEON_ELEMENTS : Object.keys(DUNGEON_ELEMENTS ?? {});
  const candidates = [];

  for (const element of elements) {
    const maxUnlocked = Number(progress[element] ?? 1);
    const failCount   = Number(failures[element] ?? 0);
    const farmTs      = Number(farmUntil[element] ?? 0);
    const inFarmMode  = farmTs > now;

    // Décision push vs farm
    const goFarm =
      inFarmMode ||
      strategy === 'farm' ||
      (strategy === 'balanced' && failCount >= profile.dungeonFailuresBeforeFarm);

    if (goFarm) {
      const farmLevel = Math.max(1, maxUnlocked - 1);
      candidates.push({ element, level: farmLevel, mode: 'farm' });
    } else {
      candidates.push({ element, level: maxUnlocked, mode: 'push' });
    }
  }

  if (!candidates.length) return null;

  // Choisir aléatoirement parmi les candidats (varier les éléments)
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/**
 * Met à jour l'état donjon après une tentative.
 * Appeler après chaque run donjon terminé (succès ou échec).
 *
 * @param {object} botState   - état runtime du bot (modifié en place)
 * @param {string} element
 * @param {number} level      - niveau tenté
 * @param {boolean} success   - true si victoire sur les 3 combats
 * @param {object} profile
 */
export function updateDungeonState(botState, element, level, success, profile) {
  if (!botState.dungeonState)          botState.dungeonState = {};
  const ds = botState.dungeonState;
  if (!ds.failures)      ds.failures      = {};
  if (!ds.farmUntil)     ds.farmUntil     = {};
  if (!ds.lastAttempted) ds.lastAttempted = {};

  ds.lastAttempted[element] = level;

  if (success) {
    // Réinitialiser les compteurs d'échec sur ce succès
    ds.failures[element]  = 0;
    delete ds.farmUntil[element];
  } else {
    const prev = Number(ds.failures[element] ?? 0);
    ds.failures[element] = prev + 1;
    if (ds.failures[element] >= profile.dungeonFailuresBeforeFarm) {
      ds.farmUntil[element] = Date.now() + profile.dungeonFarmCooldownAfterFailMs;
    }
  }

  return botState;
}
