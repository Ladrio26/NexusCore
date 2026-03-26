/**
 * Export JSON / CSV des rapports d’analyse.
 */
import fs from 'fs';
import path from 'path';

/**
 * @param {object} report
 * @param {string} filePath
 */
export function exportBalanceReportJson(report, filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf8');
}

function csvEscape(v) {
  const s = v == null ? '' : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * @param {Array<Record<string, unknown>>} rows
 * @param {string[]} columns
 */
export function rowsToCsv(rows, columns) {
  const lines = [columns.join(',')];
  for (const row of rows) {
    lines.push(columns.map((c) => csvEscape(row[c])).join(','));
  }
  return lines.join('\n');
}

/**
 * @param {object} fullReport
 * @param {string} dir
 */
export function exportBalanceReportCsvBundle(fullReport, dir) {
  fs.mkdirSync(dir, { recursive: true });

  const bench = fullReport.benchmarks || {};
  const benchRows = Object.keys(bench).map((k) => {
    const d = bench[k];
    return {
      segment: k,
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
  });
  const bcols = ['segment', 'count', 'mean', 'median', 'min', 'max', 'std', 'p25', 'p50', 'p75', 'p90'];
  fs.writeFileSync(path.join(dir, 'benchmarks_by_segment.csv'), rowsToCsv(benchRows, bcols), 'utf8');

  const roster = fullReport.rosterScores || [];
  const rosterFlat = roster.map((r) => ({
    unitId: r.unitId,
    name: r.name,
    rarity: r.rarity,
    role: r.role,
    finalScore: r.finalScore,
    statsScore: r.statsScore,
    skill1Score: r.skill1Score,
    skill2Score: r.skill2Score,
    kitSynergyScore: r.kitSynergyScore,
    tags: Array.isArray(r.tags) ? r.tags.join('|') : ''
  }));
  fs.writeFileSync(
    path.join(dir, 'roster_scores.csv'),
    rowsToCsv(rosterFlat, [
      'unitId',
      'name',
      'rarity',
      'role',
      'finalScore',
      'statsScore',
      'skill1Score',
      'skill2Score',
      'kitSynergyScore',
      'tags'
    ]),
    'utf8'
  );

  const recs = fullReport.recommendations || [];
  fs.writeFileSync(
    path.join(dir, 'recommendations.csv'),
    rowsToCsv(recs, ['severity', 'role', 'nodeKey', 'kind', 'message']),
    'utf8'
  );

  const nodeRows = [];
  const audit = fullReport.customAudit?.byRole || {};
  for (const role of Object.keys(audit)) {
    for (const n of audit[role].nodeAnalysis || []) {
      nodeRows.push({ role, ...n });
    }
  }
  fs.writeFileSync(
    path.join(dir, 'custom_node_analysis.csv'),
    rowsToCsv(nodeRows, [
      'role',
      'nodeKey',
      'appearances',
      'averageScore',
      'averageDeltaScore',
      'overpoweredBuildRate',
      'underpoweredBuildRate'
    ]),
    'utf8'
  );
}
