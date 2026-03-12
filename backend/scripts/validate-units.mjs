/**
 * Valide toutes les unités en base contre un schéma strict (effets de compétence).
 * Lecture seule : ne modifie rien en base.
 *
 * À lancer depuis le dossier backend :
 *   node scripts/validate-units.mjs
 *
 * Génère : VALIDATION_REPORT.md (à la racine backend)
 */

import { query } from '../src/config/db.js';
import { writeFileSync } from 'fs';
import { join } from 'path';

function parseJson(v) {
  if (v == null) return null;
  if (typeof v === 'object') return v;
  if (typeof v !== 'string') return null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

function getSkillObject(skillData) {
  if (!skillData || typeof skillData !== 'object') return null;
  const raw = skillData.skill ?? skillData;
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw && typeof raw === 'object' ? raw : null;
}

/** Vérifie qu'au moins une des clés est définie (non undefined, null exclu pour valeur 0). */
function hasAny(eff, ...keys) {
  return keys.some((k) => eff[k] != null);
}

/** Vérifie que la clé existe et est véridique / non vide selon le type. */
function hasValue(eff, key) {
  const v = eff[key];
  if (v == null) return false;
  if (typeof v === 'number') return true;
  if (typeof v === 'string') return v.trim() !== '';
  return true;
}

const EFFECT_TYPES_REQUIRING_TARGET = new Set([
  'SHIELD', 'HEAL', 'APPLY_BUFF', 'APPLY_DEBUFF', 'DAMAGE', 'ATB_UP', 'REDUCE_ATB', 'STRIP', 'RESURRECT', 'DEFEND'
]);

/**
 * Valide un effet selon le schéma strict.
 * Retourne un tableau de { problem, type, detail }.
 */
function validateEffect(eff, index) {
  const issues = [];
  const type = (eff?.type ?? '').toString().toUpperCase().trim();
  const effLabel = `effet[${index}] type=${type}`;

  if (!type) {
    issues.push({ problem: 'Type effet manquant', type: '(vide)', detail: effLabel });
    return issues;
  }

  switch (type) {
    case 'SHIELD': {
      if (!hasAny(eff, 'value', 'percentMaxHp', 'percentMaxHpCaster')) {
        issues.push({
          problem: 'Valeur bouclier manquante',
          type: 'SHIELD',
          detail: `${effLabel} : doit avoir value, percentMaxHp ou percentMaxHpCaster`
        });
      }
      break;
    }
    case 'HEAL': {
      if (!hasAny(eff, 'value', 'percentMaxHp', 'percentMaxHpCaster')) {
        issues.push({
          problem: 'Valeur soin manquante',
          type: 'HEAL',
          detail: `${effLabel} : doit avoir value, percentMaxHp ou percentMaxHpCaster`
        });
      }
      break;
    }
    case 'APPLY_BUFF': {
      if (!hasValue(eff, 'buffType')) {
        issues.push({
          problem: 'buffType manquant',
          type: 'APPLY_BUFF',
          detail: `${effLabel} : buffType requis`
        });
      }
      if (eff.remainingActions == null) {
        issues.push({
          problem: 'remainingActions manquant',
          type: 'APPLY_BUFF',
          detail: `${effLabel} : remainingActions requis`
        });
      }
      break;
    }
    case 'APPLY_DEBUFF': {
      if (!hasValue(eff, 'debuffType')) {
        issues.push({
          problem: 'debuffType manquant',
          type: 'APPLY_DEBUFF',
          detail: `${effLabel} : debuffType requis`
        });
      }
      if (eff.remainingActions == null) {
        issues.push({
          problem: 'remainingActions manquant',
          type: 'APPLY_DEBUFF',
          detail: `${effLabel} : remainingActions requis`
        });
      }
      break;
    }
    case 'DAMAGE': {
      if (!hasAny(eff, 'mult', 'percentMaxHp')) {
        issues.push({
          problem: 'Valeur dégâts manquante',
          type: 'DAMAGE',
          detail: `${effLabel} : doit avoir mult ou percentMaxHp`
        });
      }
      break;
    }
    default:
      break;
  }

  if (EFFECT_TYPES_REQUIRING_TARGET.has(type)) {
    if (!hasValue(eff, 'target')) {
      issues.push({
        problem: 'target manquant',
        type,
        detail: `${effLabel} : target requis pour ce type d'effet`
      });
    }
  }

  return issues;
}

async function main() {
  const rows = await query(
    `SELECT id, code, name, skill_data
     FROM units
     WHERE code NOT LIKE 'BOSS_%'
     ORDER BY name`
  );

  const reportRows = [];

  for (const r of rows) {
    const skillData = parseJson(r.skill_data);
    const skill = getSkillObject(skillData);
    const unitName = r.name ?? r.code ?? '(sans nom)';

    if (!skill) {
      reportRows.push({
        name: unitName,
        problem: 'Pas d\'objet skill',
        type: '—',
        detail: 'skill_data.skill absent ou invalide'
      });
      continue;
    }

    const effects = Array.isArray(skill.effects) ? skill.effects : [];
    if (effects.length === 0) {
      reportRows.push({
        name: unitName,
        problem: 'Aucun effet',
        type: '—',
        detail: 'skill.effects vide ou absent'
      });
      continue;
    }

    for (let i = 0; i < effects.length; i++) {
      const issues = validateEffect(effects[i], i);
      for (const u of issues) {
        reportRows.push({
          name: unitName,
          problem: u.problem,
          type: u.type,
          detail: u.detail
        });
      }
    }
  }

  const sep = '|';
  const header = ['Nom unité', 'Problème détecté', 'Type', 'Détail'];
  const line = (arr) => sep + arr.map((c) => ` ${String(c).replace(/\|/g, ' ').replace(/\n/g, ' ')} `).join(sep) + sep;

  console.log('\n=== VALIDATION UNITÉS (schéma strict) ===\n');
  console.log(line(header));
  console.log(sep + header.map(() => '---').join(sep) + sep);
  for (const row of reportRows) {
    console.log(line([row.name, row.problem, row.type, row.detail]));
  }
  console.log('\nTotal unités:', rows.length);
  console.log('Total problèmes:', reportRows.length);

  const md = [
    '# Rapport de validation des unités',
    '',
    'Validation des effets de compétence contre un schéma strict. Lecture seule, aucune modification en base.',
    '',
    '| Nom unité | Problème détecté | Type | Détail |',
    '|-----------|------------------|------|--------|',
    ...reportRows.map(
      (row) =>
        `| ${row.name} | ${row.problem} | ${row.type} | ${row.detail.replace(/\|/g, ' ').replace(/\n/g, ' ')} |`
    )
  ].join('\n');

  const outPath = join(process.cwd(), 'VALIDATION_REPORT.md');
  writeFileSync(outPath, md, 'utf8');
  console.log('\nRapport écrit:', outPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
