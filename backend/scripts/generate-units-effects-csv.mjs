/**
 * Génère un fichier CSV des unités triées par effet.
 * Colonnes : Nom, Rareté, Élément, puis une colonne par effet (X si l'unité possède l'effet).
 *
 * À lancer depuis le dossier backend :
 *   node scripts/generate-units-effects-csv.mjs
 *
 * Sortie : units-effects.csv à la racine du projet
 */

import { query } from '../src/config/db.js';
import fs from 'fs';
import path from 'path';

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

/** Extrait tous les effets d'un skill (actif ou passif). */
function extractEffectsFromSkill(skill) {
  const effects = [];
  if (!skill || typeof skill !== 'object') return effects;
  const effList = Array.isArray(skill.effects) ? skill.effects : [];
  for (const e of effList) {
    if (!e || typeof e !== 'object') continue;
    const type = String(e.type || '').toUpperCase().trim();
    if (!type) continue;
    effects.push({
      type,
      buffType: e.buffType ?? e.buff ?? null,
      debuffType: e.debuffType ?? e.debuff ?? null
    });
  }
  return effects;
}

/** Extrait skills depuis skill_data (format nouveau ou legacy). */
function getSkillsFromSkillData(skillData) {
  const allSkills = [];
  if (!skillData || typeof skillData !== 'object') return allSkills;

  if (Array.isArray(skillData.skills) && skillData.skills.length > 0) {
    for (const s of skillData.skills) {
      if (s && typeof s === 'object') allSkills.push(s);
    }
    return allSkills;
  }

  const innerSkill = skillData.skill ?? skillData;
  if (innerSkill && typeof innerSkill === 'object') {
    if (innerSkill.effects?.length || innerSkill.cd_actions != null) {
      allSkills.push(innerSkill);
    }
  }

  const passives = Array.isArray(skillData.passives) ? skillData.passives : [];
  const innerPassives = Array.isArray(innerSkill?.passives) ? innerSkill.passives : [];
  for (const p of [...passives, ...innerPassives]) {
    if (p && typeof p === 'object') {
      if (p.trigger === 'SELF_RESURRECT' || p.type === 'SELF_RESURRECT') {
        allSkills.push({
          effects: [{ type: 'RESURRECT', target: 'SELF', percentHp: p.percentHP ?? p.percent ?? 0.3 }]
        });
      } else if (Array.isArray(p.effects) && p.effects.length > 0) {
        allSkills.push({ effects: p.effects });
      } else if (p.effect && typeof p.effect === 'object') {
        allSkills.push({ effects: [p.effect] });
      }
    }
  }
  return allSkills;
}

/** Collecte tous les effets d'une unité (type + buffType/debuffType). */
function collectUnitEffects(skillData) {
  const effectKeys = new Set();
  const skills = getSkillsFromSkillData(skillData);
  for (const skill of skills) {
    const effects = extractEffectsFromSkill(skill);
    for (const e of effects) {
      const type = e.type;
      if (type === 'APPLY_BUFF' && (e.buffType || e.buff)) {
        const bt = String(e.buffType || e.buff || '').toUpperCase().trim();
        if (bt) effectKeys.add(`BUFF_${bt}`);
      } else if (type === 'APPLY_DEBUFF' && (e.debuffType || e.debuff)) {
        const dt = String(e.debuffType || e.debuff || '').toUpperCase().trim();
        if (dt) effectKeys.add(`DEBUFF_${dt}`);
      } else if (type) {
        effectKeys.add(type);
      }
    }
  }
  return effectKeys;
}

/** Échappe une valeur pour CSV (guillemets si contient virgule ou guillemet). */
function csvEscape(val) {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

async function main() {
  const rows = await query(
    `SELECT id, code, name, rarity, element, skill_data
     FROM units
     ORDER BY name`
  );

  const allEffectColumns = new Set();
  const unitEffects = new Map();

  for (const r of rows) {
    const skillData = parseJson(r.skill_data);
    const effects = collectUnitEffects(skillData);
    unitEffects.set(r.id, {
      name: r.name,
      rarity: r.rarity ?? 'common',
      element: r.element ?? 'neutral',
      effects
    });
    for (const k of effects) {
      allEffectColumns.add(k);
    }
  }

  const baseTypes = [
    'DAMAGE', 'HEAL', 'STRIP', 'CLEANSE', 'REDUCE_ATB', 'ATB_UP', 'RESURRECT', 'STEAL_STAT',
    'RESET_SKILL_COOLDOWN', 'SET_SKILL_COOLDOWN_MAX', 'CD_UP', 'CD_DOWN'
  ];
  const effectCols = Array.from(allEffectColumns).sort((a, b) => {
    const cat = (x) => (baseTypes.includes(x) ? 0 : x.startsWith('BUFF_') ? 1 : 2);
    const ca = cat(a);
    const cb = cat(b);
    if (ca !== cb) return ca - cb;
    if (ca === 0) return baseTypes.indexOf(a) - baseTypes.indexOf(b);
    return a.localeCompare(b);
  });

  const header = ['Nom', 'Rareté', 'Élément', ...effectCols];
  const lines = [header.map(csvEscape).join(',')];

  for (const [, u] of unitEffects) {
    const row = [
      csvEscape(u.name),
      csvEscape(u.rarity),
      csvEscape(u.element)
    ];
    for (const col of effectCols) {
      row.push(u.effects.has(col) ? 'X' : '');
    }
    lines.push(row.join(','));
  }

  const outPath = path.join(process.cwd(), '..', 'units-effects.csv');
  fs.writeFileSync(outPath, '\uFEFF' + lines.join('\n'), 'utf8');
  console.log(`CSV généré : ${outPath}`);
  console.log(`${rows.length} unités, ${effectCols.length} colonnes d'effets`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
