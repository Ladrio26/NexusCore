/**
 * Audit COMPLET de toutes les unités du jeu.
 * Vérifie cohérence : skill_data, moteur, buildBattleLog, applySkillEffect, ensureSkillEffects.
 * Simule un tour pour vérifier que le skill produit des results.
 *
 * À lancer (avec DB locale) :
 *   cd backend && node scripts/audit-all-units.mjs
 */

import { query } from '../src/config/db.js';
import { simulateBattle } from '../../core/combatEngine.js';

const MIN_EXPECTED_UNITS = 20;

const EFFECT_TYPES_APPLY = new Set([
  'APPLY_DEBUFF', 'STRIP', 'REDUCE_ATB', 'RESURRECT', 'ATB_UP', 'APPLY_BUFF', 'HEAL', 'SHIELD', 'DEFEND'
]);

const EFFECT_TYPES_BUILD_LOG = new Set([
  'HEAL', 'SHIELD', 'APPLY_DEBUFF', 'APPLY_BUFF', 'ATB_UP', 'STRIP', 'REDUCE_ATB', 'RESURRECT'
]);

const PERFORM_SKILL_TYPES = new Set([
  'DAMAGE_SINGLE', 'SHIELD_SELF', 'APPLY_DEBUFF'
]);

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

function getDescriptionSkill(skillData) {
  if (!skillData?.description || typeof skillData.description !== 'object') return '';
  const s = skillData.description.skill;
  return typeof s === 'string' ? s.trim() : '';
}

/** ensureSkillEffects reconnaît type.startsWith('HEAL') ou 'SHIELD' */
function ensureSkillEffectsRecognizes(skill) {
  if (!skill?.type) return false;
  const t = String(skill.type).toUpperCase().trim();
  return t.startsWith('HEAL') || t.startsWith('SHIELD');
}

/** performSkillAction a une branche pour ce type (effets, DAMAGE_SINGLE, SHIELD_SELF, APPLY_DEBUFF) */
function performSkillActionHandles(skill) {
  if (!skill) return false;
  if (Array.isArray(skill.effects) && skill.effects.length > 0) return true;
  const t = String(skill.type || '').toUpperCase().trim();
  return PERFORM_SKILL_TYPES.has(t) || t.startsWith('HEAL') || t.startsWith('SHIELD');
}

/** Chaque effect.type est reconnu par applySkillEffect et buildBattleLog */
function effectTypesCompatible(skill) {
  if (!skill?.effects || !Array.isArray(skill.effects)) return { ok: true, unknown: [] };
  const unknown = [];
  for (const eff of skill.effects) {
    const t = String(eff?.type || '').toUpperCase().trim();
    if (!t) continue;
    if (!EFFECT_TYPES_APPLY.has(t)) unknown.push(t);
    if (!EFFECT_TYPES_BUILD_LOG.has(t) && t !== 'DEFEND') {
      if (!EFFECT_TYPES_APPLY.has(t)) unknown.push(t);
    }
  }
  return { ok: unknown.length === 0, unknown: [...new Set(unknown)] };
}

/** Crée un dummy ennemi pour la simulation */
function createDummyEnemy() {
  return {
    id: 999999,
    code: 'DUMMY',
    name: 'Dummy',
    base_hp: 300,
    base_attack: 5,
    base_defense: 5,
    base_speed: 1,
    level: 1,
    mastery: 0,
    element: 'fire',
    archetype: 'CAC_DPS',
    position: 'front',
    attack_type: 'melee',
    rangeType: 'melee',
    traits: [],
    skill_data: null
  };
}

/** Simule un tour : notre unité en teamA[0] avec vitesse haute pour agir en premier */
function simulateOneTurn(unitRow) {
  const skillData = parseJson(unitRow.skill_data);
  const raw = {
    ...unitRow,
    level: 1,
    base_speed: 500,
    skill_data: skillData,
    skillData: skillData,
    position: 'front',
    attack_type: unitRow.attack_type || 'melee',
    rangeType: (unitRow.attack_type || 'melee') === 'ranged' ? 'ranged' : 'melee',
    traits: parseJson(unitRow.traits) || []
  };
  const teamA = [raw];
  const teamB = [createDummyEnemy()];

  let log;
  try {
    log = simulateBattle(teamA, teamB, { seed: 42, maxRounds: 2, maxActions: 5 });
  } catch (err) {
    return { error: err.message, resultsGenerated: false, skillEvent: null };
  }

  const events = log?.events || [];
  const firstActionOfUnit0 = events.find((e) => e.actor === 0 || e.actorId === 0);
  if (!firstActionOfUnit0) {
    return { resultsGenerated: false, skillEvent: null, reason: 'Aucune action de l’unité 0' };
  }

  if (firstActionOfUnit0.type === 'skill' && Array.isArray(firstActionOfUnit0.effectsResultsByTarget)) {
    const totalResults = firstActionOfUnit0.effectsResultsByTarget.reduce((acc, e) => acc + (e.results?.length || 0), 0);
    return { resultsGenerated: totalResults > 0, skillEvent: firstActionOfUnit0, totalResults };
  }

  return { resultsGenerated: false, skillEvent: null, reason: 'Attaque de base (pas de skill)' };
}

async function main() {
  const [countRow] = await query('SELECT COUNT(*) AS totalUnits FROM units');
  if (Number(countRow?.totalUnits || 0) < MIN_EXPECTED_UNITS && process.env.ALLOW_SMALL_DATASET !== '1') {
    throw new Error(
      `BDD probablement incomplète pour cet audit (${countRow?.totalUnits || 0} unités trouvées). `
      + `Utilisez une BDD plus complète ou relancez avec ALLOW_SMALL_DATASET=1 si c'est volontaire.`
    );
  }

  const rows = await query(
    `SELECT id, code, name, base_hp, base_attack, base_defense, base_speed, mastery,
            traits, skill_data, element, archetype, attack_type
     FROM units
     WHERE code NOT LIKE 'BOSS_%'
     ORDER BY name`
  );

  const report = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const skillData = parseJson(r.skill_data);
    const skill = getSkillObject(skillData);
    const skillType = skill ? String(skill.type || '').trim() || '(vide)' : '(pas de skill)';
    const effectsPresent = !!(skill && Array.isArray(skill.effects) && skill.effects.length > 0);
    const descSkill = getDescriptionSkill(skillData);

    const effectCompat = effectTypesCompatible(skill);
    const engineRecognizes = ensureSkillEffectsRecognizes(skill) || (effectsPresent && effectCompat.ok);
    const performHandles = performSkillActionHandles(skill);
    const compatibleMoteur = engineRecognizes && performHandles && effectCompat.ok;

    const sim = simulateOneTurn(r);
    const resultsGenerated = sim.resultsGenerated === true;
    let probleme = '';
    if (sim.error) probleme = `Erreur simu: ${sim.error}`;
    else if (!effectCompat.ok) probleme = `Effect types non reconnus: ${effectCompat.unknown.join(', ')}`;
    else if (!performHandles) probleme = 'Type non géré par performSkillAction';
    else if (!engineRecognizes && effectsPresent) probleme = 'Effects présents mais types non reconnus buildBattleLog/applySkillEffect';
    else if (!resultsGenerated && skill && (effectsPresent || skillType !== '(pas de skill)')) {
      probleme = sim.reason || 'Aucun résultat généré (skill inefficace?)';
    }
    if (!probleme) probleme = '—';

    report.push({
      name: r.name,
      skillType,
      effectsPresent: effectsPresent ? 'Oui' : 'Non',
      resultsGenerated: resultsGenerated ? 'Oui' : 'Non',
      compatibleMoteur: compatibleMoteur ? 'Oui' : 'Non',
      probleme
    });
  }

  const sep = '|';
  const header = ['Nom unité', 'skill.type', 'effects présents', 'results générés', 'Compatible moteur', 'Problème détecté'];
  const line = (arr) => sep + arr.map((c) => ` ${String(c).replace(/\|/g, ' ')} `).join(sep) + sep;
  const divider = sep + header.map(() => '---').join(sep) + sep;

  console.log('\n=== AUDIT COMPLET TOUTES LES UNITÉS ===\n');
  console.log(line(header));
  console.log(divider);
  for (const row of report) {
    console.log(line([row.name, row.skillType, row.effectsPresent, row.resultsGenerated, row.compatibleMoteur, row.probleme]));
  }
  console.log('\nTotal:', report.length);
  const withProblem = report.filter((r) => r.probleme !== '—');
  console.log('Avec problème:', withProblem.length);

  const fs = await import('fs');
  const path = await import('path');
  const outPath = path.join(process.cwd(), 'AUDIT_ALL_UNITS.md');
  const md = [
    '# Audit complet – Toutes les unités',
    '',
    'Cohérence skill_data / moteur / buildBattleLog / applySkillEffect / ensureSkillEffects.',
    '',
    '| Nom unité | skill.type | effects présents | results générés | Compatible moteur | Problème détecté |',
    '|-----------|------------|------------------|-----------------|-------------------|------------------|',
    ...report.map((row) => `| ${row.name} | ${row.skillType} | ${row.effectsPresent} | ${row.resultsGenerated} | ${row.compatibleMoteur} | ${row.probleme} |`)
  ].join('\n');
  fs.writeFileSync(outPath, md, 'utf8');
  console.log('\nRapport écrit:', outPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
