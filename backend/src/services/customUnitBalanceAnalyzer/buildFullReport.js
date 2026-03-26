/**
 * Assemble le rapport complet (roster + benchmarks + audit + reco).
 */
import { distributionStats } from './rarityBenchmarks.js';

/**
 * @param {object} params
 * @param {Array<ReturnType<import('./unitPowerScoring.js').computeUnitPowerScore>>} params.rosterScores
 * @param {Record<string, ReturnType<typeof distributionStats>>} params.benchmarks
 * @param {ReturnType<import('./customTreeAudit.js').auditCustomTreeAgainstRoster>} params.customAudit
 * @param {ReturnType<import('./customBalanceRecommendations.js').generateCustomBalanceRecommendations>} params.recommendations
 */
export function buildFullBalanceReport({ rosterScores, benchmarks, customAudit, recommendations }) {
  const scores = rosterScores.map((r) => r.finalScore).sort((a, b) => a - b);
  const globalDist = distributionStats(scores);
  if (globalDist.scores) delete globalDist.scores;

  const sorted = [...rosterScores].sort((a, b) => b.finalScore - a.finalScore);
  const topUnits = sorted.slice(0, 25).map((u) => ({
    unitId: u.unitId,
    name: u.name,
    rarity: u.rarity,
    role: u.role,
    finalScore: u.finalScore
  }));
  const bottomUnits = sorted
    .slice(-25)
    .reverse()
    .map((u) => ({
      unitId: u.unitId,
      name: u.name,
      rarity: u.rarity,
      role: u.role,
      finalScore: u.finalScore
    }));

  const benchmarksSlim = {};
  for (const k of Object.keys(benchmarks)) {
    const d = benchmarks[k];
    benchmarksSlim[k] = {
      count: d.count,
      mean: d.mean,
      median: d.median,
      min: d.min,
      max: d.max,
      std: d.std,
      p25: d.p25,
      p50: d.p50,
      p75: d.p75,
      p90: d.p90
    };
  }

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      rosterUnitCount: rosterScores.length,
      globalScoreDistribution: globalDist
    },
    benchmarks: benchmarksSlim,
    topUnits,
    bottomUnits,
    rosterScores,
    customAudit,
    recommendations
  };
}
