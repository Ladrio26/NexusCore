/**
 * Utilitaire pour dériver une description de compétence à afficher dans les tooltips.
 * Logique alignée sur le client (core/skillDescriptionTooltip.js).
 */

import { getSkillTooltipPlainText } from '../../../core/skillDescriptionTooltip.js';

/** Une ligne ou bloc de description de compétence pour le tooltip (lié aux entrées skills[], spé si besoin). */
export function getSkillDescriptionForTooltip(u) {
  const data = u?.skill_data ?? u?.skillData;
  const specRaw = u?.specialization;
  const spec =
    specRaw != null && String(specRaw).trim() !== '' ? String(specRaw).toUpperCase() : null;
  const opts = spec === 'A' || spec === 'B' ? { specialization: spec } : {};
  return getSkillTooltipPlainText(data, opts) || '';
}
