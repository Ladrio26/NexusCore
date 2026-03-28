/**
 * BotArtifactPlanner.js
 * Décide quels artefacts équiper ou améliorer pour le bot.
 */

import { getArtifactInventory } from '../services/artifactService.js';

/**
 * Construit un plan d'équipement : liste d'artefacts non équipés à associer à des unités.
 * Règles :
 *  - Une unité peut porter au maximum 2 artefacts.
 *  - Pas deux artefacts du même stat_key sur la même unité.
 *  - Les artefacts de trait (stat_key commençant par "trait_") ne sont traités que si
 *    le service d'équipement n'y trouve pas d'incompatibilité (on laisse `equipArtifactById` décider).
 *
 * Retourne Array<{ artifactId, userUnitId }>.
 */
export async function getEquipPlan(userId) {
  let inventory;
  try {
    inventory = await getArtifactInventory(userId);
  } catch {
    return [];
  }

  const units     = inventory.units     ?? [];
  const artifacts = (inventory.artifacts ?? []).filter((a) => a.equipped_user_unit_id == null);
  if (!artifacts.length || !units.length) return [];

  // Unités qui peuvent encore recevoir un artefact
  const unitState = units
    .filter((u) => (u.equipped_artifacts ?? []).length < 2)
    .map((u) => ({
      unitId:         Number(u.user_unit_id ?? u.id),
      equippedStats:  new Set((u.equipped_artifacts ?? []).map((a) => String(a.stat_key))),
      equippedCount:  (u.equipped_artifacts ?? []).length,
    }));

  if (!unitState.length) return [];

  const plan = [];

  for (const artifact of artifacts) {
    const statKey = String(artifact.stat_key);
    for (const us of unitState) {
      if (us.equippedCount >= 2) continue;
      if (us.equippedStats.has(statKey)) continue; // stat dupliquée
      plan.push({ artifactId: Number(artifact.id), userUnitId: us.unitId });
      us.equippedStats.add(statKey);
      us.equippedCount++;
      break; // chaque artefact va sur une seule unité
    }
  }

  return plan;
}

/**
 * Construit un plan d'amélioration : liste d'IDs d'artefacts équipés à améliorer.
 * Critères :
 *  - L'artefact est équipé.
 *  - Son niveau actuel est inférieur à maxLevel.
 * Triés du niveau le plus bas au plus haut (améliorer les plus faibles en premier).
 *
 * Retourne Array<number> (artifact IDs).
 */
export async function getUpgradePlan(userId, maxLevel = 5) {
  let inventory;
  try {
    inventory = await getArtifactInventory(userId);
  } catch {
    return [];
  }

  const candidates = (inventory.artifacts ?? []).filter(
    (a) => a.equipped_user_unit_id != null && Number(a.level ?? 0) < maxLevel
  );
  if (!candidates.length) return [];

  candidates.sort((a, b) => Number(a.level ?? 0) - Number(b.level ?? 0));
  return candidates.map((a) => Number(a.id));
}
