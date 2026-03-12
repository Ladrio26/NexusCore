/**
 * Audit des unités dont la compétence mentionne soin ou bouclier.
 * Vérifie la cohérence description / skill_data / moteur de combat.
 *
 * À lancer depuis le dossier backend :
 *   node scripts/audit-heal-shield-units.mjs
 *
 * Ou depuis la racine du projet (avec DB accessible) :
 *   node backend/scripts/audit-heal-shield-units.mjs
 */

import { query } from '../src/config/db.js';

const KEYWORDS = ['soin', 'soigne', 'soins', 'bouclier', 'shield'];
const MIN_EXPECTED_UNITS = 20;

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

/** Retourne le texte de description de la compétence (skill + specA + specB). */
function getSkillDescriptionText(skillData) {
  if (!skillData || typeof skillData !== 'object') return '';
  const desc = skillData.description;
  if (desc && typeof desc === 'object') {
    const parts = [];
    if (typeof desc.skill === 'string' && desc.skill.trim()) parts.push(desc.skill.trim());
    if (typeof desc.specA === 'string' && desc.specA.trim()) parts.push(desc.specA.trim());
    if (typeof desc.specB === 'string' && desc.specB.trim()) parts.push(desc.specB.trim());
    return parts.join(' ');
  }
  return '';
}

/** True si le texte contient l'un des mots-clés (insensible à la casse). */
function descriptionMatchesHealOrShield(text) {
  const lower = String(text || '').toLowerCase();
  return KEYWORDS.some((k) => lower.includes(k));
}

/** Récupère l'objet skill (skill_data.skill ou skill_data). */
function getSkillObject(skillData) {
  if (!skillData || typeof skillData !== 'object') return null;
  const raw = skillData.skill ?? skillData;
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw && typeof raw === 'object' ? raw : null;
}

/**
 * Étape 2 : skill_data a-t-il une structure compatible moteur ?
 * - skill.effects existe et non vide OU
 * - skill.type commence par HEAL ou SHIELD
 */
function hasValidStructure(skill) {
  if (!skill) return false;
  if (Array.isArray(skill.effects) && skill.effects.length > 0) return true;
  const type = String(skill.type || '').toUpperCase().trim();
  return type.startsWith('HEAL') || type.startsWith('SHIELD');
}

/**
 * Étape 3 : Le moteur reconnaîtra-t-il ce skill ?
 * - ensureSkillEffects : type.startsWith('HEAL') || type.startsWith('SHIELD')
 * - buildBattleLog : effType === 'HEAL' ou 'SHIELD' avec results
 * - applySkillEffect : case 'HEAL' et 'SHIELD'
 */
function isEngineCompatible(skill) {
  if (!skill) return false;
  const type = String(skill.type || '').toUpperCase().trim();
  const isHeal = type.startsWith('HEAL');
  const isShield = type.startsWith('SHIELD');
  if (isHeal || isShield) return true;
  // Si le skill a des effects avec type HEAL/SHIELD, le moteur les gère aussi
  if (Array.isArray(skill.effects) && skill.effects.length > 0) {
    return skill.effects.some((eff) => {
      const t = String(eff?.type || '').toUpperCase();
      return t.startsWith('HEAL') || t.startsWith('SHIELD');
    });
  }
  return false;
}

function runAudit() {
  return {
    hasValidStructure(skill) {
      return hasValidStructure(skill);
    },
    isEngineCompatible(skill) {
      return isEngineCompatible(skill);
    }
  };
}

async function main() {
  const audit = runAudit();
  const [countRow] = await query('SELECT COUNT(*) AS totalUnits FROM units');

  if (Number(countRow?.totalUnits || 0) < MIN_EXPECTED_UNITS && process.env.ALLOW_SMALL_DATASET !== '1') {
    throw new Error(
      `BDD probablement incomplète pour cet audit (${countRow?.totalUnits || 0} unités trouvées). `
      + `Utilisez une BDD plus complète ou relancez avec ALLOW_SMALL_DATASET=1 si c'est volontaire.`
    );
  }

  const rows = await query(
    `SELECT id, code, name, skill_data
     FROM units
     ORDER BY name`
  );

  const toAudit = [];
  for (const r of rows) {
    const skillData = parseJson(r.skill_data);
    const descriptionText = getSkillDescriptionText(skillData);
    if (!descriptionMatchesHealOrShield(descriptionText)) continue;
    const skill = getSkillObject(skillData);
    toAudit.push({
      id: r.id,
      code: r.code,
      name: r.name,
      descriptionSnippet: descriptionText.slice(0, 80) + (descriptionText.length > 80 ? '…' : ''),
      skill,
      skillType: skill ? String(skill.type || '').trim() || '(vide)' : '(pas de skill)',
      effectsPresent: !!(skill && Array.isArray(skill.effects) && skill.effects.length > 0),
      validStructure: audit.hasValidStructure(skill),
      engineCompatible: audit.isEngineCompatible(skill)
    });
  }

  // Problème = description évoque heal/shield mais structure ou moteur incohérent
  const report = toAudit.map((u) => {
    let problem = '';
    if (!u.skill) problem = 'Pas d’objet skill dans skill_data';
    else if (!u.validStructure) problem = 'Skill non compatible structure (ni effects, ni type HEAL/SHIELD)';
    else if (!u.engineCompatible) problem = 'Type non reconnu par ensureSkillEffects / moteur';
    return {
      name: u.name,
      skillType: u.skillType,
      effectsPresent: u.effectsPresent ? 'Oui' : 'Non',
      compatibleMoteur: u.engineCompatible ? 'Oui' : 'Non',
      probleme: problem || '—'
    };
  });

  // Affichage tableau
  const sep = '|';
  const header = ['Nom unité', 'Type skill', 'Effects présents ?', 'Compatible moteur ?', 'Problème ?'];
  const line = (arr) => sep + arr.map((c) => ` ${String(c)} `).join(sep) + sep;
  const divider = sep + header.map(() => '---').join(sep) + sep;

  console.log('\n=== AUDIT UNITÉS HEAL/SHIELD (description mentionne soin ou bouclier) ===\n');
  console.log(line(header));
  console.log(divider);
  for (const r of report) {
    console.log(line([r.name, r.skillType, r.effectsPresent, r.compatibleMoteur, r.probleme]));
  }
  console.log('\nTotal unités auditées:', report.length);
  const withProblem = report.filter((r) => r.probleme !== '—');
  if (withProblem.length) {
    console.log('Unités avec problème:', withProblem.length);
  }
  console.log('');

  // Écriture du rapport en Markdown (chemin relatif au dossier backend)
  const fs = await import('fs');
  const path = await import('path');
  const outPath = path.join(process.cwd(), 'AUDIT_HEAL_SHIELD_UNITS.md');
  const md = [
    '# Audit unités Heal / Shield',
    '',
    'Unités dont la description de compétence mentionne : soin, soigne, soins, bouclier, shield.',
    '',
    '| Nom unité | Type skill | Effects présents ? | Compatible moteur ? | Problème ? |',
    '|-----------|------------|--------------------|----------------------|------------|',
    ...report.map((r) => `| ${r.name} | ${r.skillType} | ${r.effectsPresent} | ${r.compatibleMoteur} | ${r.probleme} |`)
  ].join('\n');
  fs.writeFileSync(outPath, md, 'utf8');
  console.log('Rapport écrit dans:', outPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
