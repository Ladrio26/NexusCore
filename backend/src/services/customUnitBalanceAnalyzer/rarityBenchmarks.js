/**
 * Distributions statistiques par segment (rareté + rôle normalisé).
 */

import { benchmarkKey } from './unitPowerScoring.js';
import { normalizeRoleKey } from './roleStatWeights.js';

function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stddev(arr, m) {
  if (arr.length < 2) return 0;
  const v = arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length;
  return Math.sqrt(v);
}

/** Percentile linéaire sur tableau trié. */
export function percentile(sortedAsc, p) {
  if (!sortedAsc.length) return 0;
  if (sortedAsc.length === 1) return sortedAsc[0];
  const idx = (p / 100) * (sortedAsc.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo];
  return sortedAsc[lo] * (hi - idx) + sortedAsc[hi] * (idx - lo);
}

/**
 * @param {number[]} values
 */
export function distributionStats(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  if (!n) {
    return {
      count: 0,
      mean: 0,
      median: 0,
      min: 0,
      max: 0,
      std: 0,
      p25: 0,
      p50: 0,
      p75: 0,
      p90: 0,
      scores: []
    };
  }
  const m = mean(sorted);
  return {
    count: n,
    mean: m,
    median: percentile(sorted, 50),
    min: sorted[0],
    max: sorted[n - 1],
    std: stddev(sorted, m),
    p25: percentile(sorted, 25),
    p50: percentile(sorted, 50),
    p75: percentile(sorted, 75),
    p90: percentile(sorted, 90),
    scores: sorted
  };
}

/**
 * @param {Array<{ finalScore: number } & Record<string, unknown>>} scoredUnits
 * @returns {Record<string, ReturnType<typeof distributionStats>>}
 */
export function buildBenchmarksBySegment(scoredUnits) {
  /** @type {Record<string, number[]>} */
  const buckets = {};
  for (const u of scoredUnits) {
    const k = benchmarkKey(u);
    if (!buckets[k]) buckets[k] = [];
    buckets[k].push(Number(u.finalScore) || 0);
  }
  /** @type {Record<string, ReturnType<typeof distributionStats>>} */
  const out = {};
  for (const k of Object.keys(buckets)) {
    out[k] = distributionStats(buckets[k]);
  }
  return out;
}

/**
 * Score cible pour un build custom (référence épique + rôle).
 * @param {Record<string, ReturnType<typeof distributionStats>>} benchmarks
 * @param {string} role
 * @param {string} refRarity
 * @param {number} targetP percentile 0–100
 */
export function getTargetScoreForCustomRole(benchmarks, role, refRarity = 'epic', targetP = 72) {
  const nk = normalizeRoleKey(role);
  const key = `${String(refRarity).toLowerCase()}::${nk}`;
  const dist = benchmarks[key];
  if (!dist?.scores?.length) return null;
  return percentile(dist.scores, targetP);
}
