/**
 * Recommandations textuelles à partir de l’audit et des benchmarks.
 */
import { getNodeByKey } from '../../data/customUnitDefinitions.js';
import { CUSTOM_BUILD_THRESHOLDS } from './coefficients.js';

/**
 * @param {ReturnType<import('./customTreeAudit.js').auditCustomTreeAgainstRoster>} audit
 */
export function generateCustomBalanceRecommendations(audit) {
  const recs = [];
  const byRole = audit?.byRole || {};

  for (const role of Object.keys(byRole)) {
    const block = byRole[role];
    const nodes = block.nodeAnalysis || [];
    for (const n of nodes) {
      const meta = getNodeByKey(n.nodeKey);
      const label = meta?.labelFr || n.nodeKey;

      if (n.overpoweredBuildRate >= 0.35 && n.appearances >= 8) {
        recs.push({
          severity: 'high',
          nodeKey: n.nodeKey,
          role,
          kind: 'nerf',
          message: `« ${label} » apparaît souvent dans des builds au-dessus du percentile cible (${(n.overpoweredBuildRate * 100).toFixed(0)}% de builds marqués OP). Envisager : augmenter powerCost, réduire ratios/durées/chances, ou renforcer les exclusions d’arbre.`
        });
      } else if (n.underpoweredBuildRate >= 0.4 && n.appearances >= 8) {
        recs.push({
          severity: 'medium',
          nodeKey: n.nodeKey,
          role,
          kind: 'buff',
          message: `« ${label} » est souvent dans des builds sous la cible (${(n.underpoweredBuildRate * 100).toFixed(0)}% under). Envisager : baisser légèrement le CD, augmenter un ratio, ou réduire powerCost.`
        });
      } else if (n.averageDeltaScore > 0 && n.averageDeltaScore > (block.targetScore || 1) * CUSTOM_BUILD_THRESHOLDS.overpowered * 0.5) {
        recs.push({
          severity: 'low',
          nodeKey: n.nodeKey,
          role,
          kind: 'watch',
          message: `« ${label} » : delta moyen ${n.averageDeltaScore.toFixed(1)} vs cible — surveiller les synergies avec les branches voisines.`
        });
      }
    }
  }

  return recs.sort((a, b) => {
    const o = { high: 0, medium: 1, low: 2 };
    return (o[a.severity] ?? 3) - (o[b.severity] ?? 3);
  });
}
