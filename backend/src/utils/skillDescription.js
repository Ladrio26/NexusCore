/**
 * Utilitaire pour dériver une description de compétence à afficher dans les tooltips.
 * Logique alignée sur le client (core/skillDescriptionTooltip.js).
 */

import { getSkillTooltipPlainText } from '../../../core/skillDescriptionTooltip.js';

/** Une ligne ou bloc de description de compétence pour le tooltip. */
export function getSkillDescriptionForTooltip(u) {
  const data = u?.skill_data ?? u?.skillData;
  return getSkillTooltipPlainText(data) || '';
}
