#!/usr/bin/env node
/**
 * Analyse d’équilibrage : roster comme référentiel, audit de l’arbre custom, export JSON/CSV.
 *
 * Usage :
 *   cd backend && node scripts/analyze-custom-balance.mjs
 *   OUT_DIR=reports/custom-balance-analysis node scripts/analyze-custom-balance.mjs
 *
 * Variables optionnelles :
 *   ALLOW_SMALL_DATASET=1 — si moins de 20 unités en base
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { loadRosterUnitsForBalance } from '../src/services/customUnitBalanceAnalyzer/rosterLoader.js';
import { computeUnitPowerScore } from '../src/services/customUnitBalanceAnalyzer/unitPowerScoring.js';
import { buildBenchmarksBySegment } from '../src/services/customUnitBalanceAnalyzer/rarityBenchmarks.js';
import { auditCustomTreeAgainstRoster } from '../src/services/customUnitBalanceAnalyzer/customTreeAudit.js';
import { generateCustomBalanceRecommendations } from '../src/services/customUnitBalanceAnalyzer/customBalanceRecommendations.js';
import {
  exportBalanceReportJson,
  exportBalanceReportCsvBundle
} from '../src/services/customUnitBalanceAnalyzer/exportBalanceReport.js';
import { buildFullBalanceReport } from '../src/services/customUnitBalanceAnalyzer/buildFullReport.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIN_ROSTER = 5;

async function main() {
  const outDir = process.env.OUT_DIR || path.join(__dirname, '../reports/custom-balance-analysis');
  const jsonPath = path.join(outDir, 'full-report.json');
  const csvDir = path.join(outDir, 'csv');

  const rows = await loadRosterUnitsForBalance({ excludeCustom: true, excludeBoss: true });
  if (rows.length < MIN_ROSTER && process.env.ALLOW_SMALL_DATASET !== '1') {
    console.warn(
      `[analyze-custom-balance] Seulement ${rows.length} unités. Export quand même. Relancez avec ALLOW_SMALL_DATASET=1 pour supprimer cet avertissement.`
    );
  }

  const rosterScores = rows.map((r) => computeUnitPowerScore(r));
  const benchmarks = buildBenchmarksBySegment(rosterScores);

  const customAudit = auditCustomTreeAgainstRoster({
    benchmarks,
    element: 'fire',
    samplesPerRole: Number(process.env.AUDIT_SAMPLES_PER_ROLE) || undefined,
    seed: Number(process.env.AUDIT_SEED) || undefined
  });

  const recommendations = generateCustomBalanceRecommendations(customAudit);

  const report = buildFullBalanceReport({
    rosterScores,
    benchmarks,
    customAudit,
    recommendations
  });

  exportBalanceReportJson(report, jsonPath);
  exportBalanceReportCsvBundle(report, csvDir);

  console.log(`[analyze-custom-balance] OK — ${rows.length} unités roster, benchmarks ${Object.keys(benchmarks).length} segments.`);
  console.log(`  JSON : ${jsonPath}`);
  console.log(`  CSV  : ${csvDir}/`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
