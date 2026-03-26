/**
 * Audit Monte Carlo de l’arbre custom vs benchmarks roster.
 */
import { getNodesByRole } from '../../data/customUnitDefinitions.js';
import { getCustomUnitTree, requiredGroupsForRole, validateCustomUnitChoices } from '../customUnitBuilder.js';
import { computeCustomBuildPowerScore } from './unitPowerScoring.js';
import { getTargetScoreForCustomRole } from './rarityBenchmarks.js';
import {
  AUDIT_SAMPLES_PER_ROLE,
  DEFAULT_AUDIT_SEED,
  CUSTOM_BUILD_THRESHOLDS,
  CUSTOM_TARGET_PERCENTILE
} from './coefficients.js';

/** RNG déterministe (Mulberry32). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Tirage aléatoire d’une sélection valide (un nœud par groupe requis).
 * @param {string} role
 * @param {() => number} rng — dans [0,1)
 * @returns {string[] | null}
 */
export function sampleRandomValidBuild(role, rng) {
  const groups = requiredGroupsForRole(role);
  const nodes = getNodesByRole(role);
  const selected = [];
  for (const g of groups) {
    const tree = getCustomUnitTree(role, selected);
    const inGroup = nodes.filter((n) => n.groupId === g);
    const available = inGroup.filter((n) => {
      const st = tree.find((t) => t.nodeKey === n.nodeKey);
      return st && st.state === 'available';
    });
    if (available.length === 0) return null;
    const pick = available[Math.floor(rng() * available.length)];
    selected.push(pick.nodeKey);
  }
  return selected;
}

/**
 * @param {object} options
 * @param {Record<string, import('./rarityBenchmarks.js').distributionStats & { scores?: number[] }>} options.benchmarks
 * @param {string} [options.element]
 * @param {number} [options.samplesPerRole]
 * @param {number} [options.seed]
 * @param {string} [options.targetRefRarity]
 * @param {number} [options.targetPercentile]
 */
export function auditCustomTreeAgainstRoster(options) {
  const {
    benchmarks,
    element = 'fire',
    samplesPerRole = AUDIT_SAMPLES_PER_ROLE,
    seed = DEFAULT_AUDIT_SEED,
    targetRefRarity = 'epic',
    targetPercentile = CUSTOM_TARGET_PERCENTILE.targetPercentile
  } = options;

  const roles = ['dps', 'tank', 'support', 'assassin'];
  const rng = mulberry32(seed);
  /** @type {Record<string, unknown>} */
  const byRole = {};

  for (const role of roles) {
    const target = getTargetScoreForCustomRole(benchmarks, role, targetRefRarity, targetPercentile);
    const samples = [];
    /** @type {Map<string, { appearances: number; scoreSum: number; deltas: number[]; opHits: number; unHits: number }>} */
    const nodeMap = new Map();

    let attempts = 0;
    const maxAttempts = samplesPerRole * 12;
    while (samples.length < samplesPerRole && attempts < maxAttempts) {
      attempts += 1;
      const keys = sampleRandomValidBuild(role, rng);
      if (!keys) continue;
      const v = validateCustomUnitChoices(role, element, keys);
      if (!v.valid) continue;
      let scored;
      try {
        scored = computeCustomBuildPowerScore(role, element, keys);
      } catch {
        continue;
      }
      const delta = target != null ? scored.finalScore - target : 0;
      const isOp =
        target != null && scored.finalScore > target * (1 + CUSTOM_BUILD_THRESHOLDS.overpowered);
      const isUn =
        target != null && scored.finalScore < target * (1 + CUSTOM_BUILD_THRESHOLDS.underpowered);

      samples.push({
        selectedKeys: keys,
        finalScore: scored.finalScore,
        delta,
        isOverpowered: isOp,
        isUnderpowered: isUn
      });

      for (const nk of keys) {
        if (!nodeMap.has(nk)) {
          nodeMap.set(nk, { appearances: 0, scoreSum: 0, deltas: [], opHits: 0, unHits: 0 });
        }
        const rec = nodeMap.get(nk);
        rec.appearances += 1;
        rec.scoreSum += scored.finalScore;
        rec.deltas.push(delta);
        if (isOp) rec.opHits += 1;
        if (isUn) rec.unHits += 1;
      }
    }

    const nodeAnalysis = [...nodeMap.entries()].map(([nodeKey, rec]) => {
      const avgDelta = rec.deltas.length ? rec.deltas.reduce((a, b) => a + b, 0) / rec.deltas.length : 0;
      const overpoweredBuildRate = rec.appearances ? rec.opHits / rec.appearances : 0;
      const underpoweredBuildRate = rec.appearances ? rec.unHits / rec.appearances : 0;
      return {
        nodeKey,
        appearances: rec.appearances,
        averageDeltaScore: avgDelta,
        averageScore: rec.appearances ? rec.scoreSum / rec.appearances : 0,
        overpoweredBuildRate,
        underpoweredBuildRate,
        recommendation: ''
      };
    });

    byRole[role] = {
      targetScore: target,
      sampleCount: samples.length,
      attempts,
      samples: samples.slice(0, 50),
      nodeAnalysis
    };
  }

  return {
    targetRefRarity,
    targetPercentile,
    element,
    seed,
    samplesPerRole,
    byRole
  };
}
