/**
 * Génère un fichier CSV par effet (soin, buff ATQ, dégâts, etc.)
 * Colonnes : Nom, Élément, Rareté, Description de la compétence
 *
 * À lancer depuis le dossier backend :
 *   node scripts/generate-units-effects-by-effect-csv.mjs
 *
 * Sortie : dossier ../exports-effets-unites/ (à la racine du projet nexuscore)
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

/** Texte de description compétence (skill + spé A/B). */
function getSkillDescriptionText(skillData) {
  if (!skillData || typeof skillData !== 'object') return '';
  const desc = skillData.description;
  if (desc && typeof desc === 'object') {
    const parts = [];
    if (typeof desc.skill === 'string' && desc.skill.trim()) parts.push(desc.skill.trim());
    if (typeof desc.specA === 'string' && desc.specA.trim()) parts.push(`[Spé A] ${desc.specA.trim()}`);
    if (typeof desc.specB === 'string' && desc.specB.trim()) parts.push(`[Spé B] ${desc.specB.trim()}`);
    return parts.join(' ');
  }
  return '';
}

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

function collectUnitEffectKeys(skillData) {
  const keys = new Set();
  const skills = getSkillsFromSkillData(skillData);
  for (const skill of skills) {
    for (const e of extractEffectsFromSkill(skill)) {
      const type = e.type;
      if (type === 'APPLY_BUFF' && (e.buffType || e.buff)) {
        const bt = String(e.buffType || e.buff || '').toUpperCase().trim();
        if (bt) keys.add(`BUFF_${bt}`);
      } else if (type === 'APPLY_DEBUFF' && (e.debuffType || e.debuff)) {
        const dt = String(e.debuffType || e.debuff || '').toUpperCase().trim();
        if (dt) keys.add(`DEBUFF_${dt}`);
      } else if (type) {
        keys.add(type);
      }
    }
  }
  return keys;
}

/** Nom de fichier CSV lisible (slug FR + clé technique pour unicité). */
const EFFECT_FILE_SLUG = {
  DAMAGE: 'degats',
  HEAL: 'soin',
  STRIP: 'strip',
  CLEANSE: 'cleanse',
  REDUCE_ATB: 'reduction-atb',
  ATB_UP: 'augmentation-atb',
  RESURRECT: 'resurrection',
  STEAL_STAT: 'vol-de-stats',
  RESET_SKILL_COOLDOWN: 'reset-recharge-competence',
  SET_SKILL_COOLDOWN_MAX: 'recharge-competence-max',
  CD_UP: 'augmentation-recharge-cible',
  CD_DOWN: 'reduction-recharge-cible',
  BUFF_ATK_UP: 'buff-attaque',
  BUFF_DEF_UP: 'buff-defense',
  BUFF_SPEED_UP: 'buff-vitesse',
  BUFF_SHIELD: 'bouclier',
  BUFF_DEFEND: 'defense-allié',
  BUFF_LIFESTEAL: 'vol-de-vie',
  BUFF_REGEN: 'regeneration',
  BUFF_IMMUNITY: 'immunite',
  BUFF_INVINCIBILITY: 'invincibilite',
  BUFF_COUNTER_ATTACK: 'contre-attaque',
  BUFF_PROVOKE: 'provocation',
  BUFF_ATK_DOWN: 'debuff-attaque',
  BUFF_DEF_DOWN: 'debuff-defense',
  BUFF_SLOW: 'ralentissement',
  BUFF_SILENCE: 'silence',
  BUFF_STUN: 'etourdissement',
  BUFF_BLIND: 'cecite',
  BUFF_ANTI_HEAL: 'anti-soin',
  BUFF_ANTI_SHIELD: 'anti-bouclier',
  BUFF_ANTI_BUFF: 'anti-buff',
  BUFF_DOT: 'degats-sur-la-duree',
  DEBUFF_ATK_DOWN: 'debuff-attaque-appl-debuff',
  DEBUFF_DEF_DOWN: 'debuff-defense-appl-debuff',
  DEBUFF_SLOW: 'ralentissement-appl-debuff',
  DEBUFF_SILENCE: 'silence-appl-debuff',
  DEBUFF_STUN: 'etourdissement-appl-debuff',
  DEBUFF_BLIND: 'cecite-appl-debuff',
  DEBUFF_PROVOKE: 'provocation-appl-debuff',
  DEBUFF_ANTI_HEAL: 'anti-soin-appl-debuff',
  DEBUFF_ANTI_SHIELD: 'anti-bouclier-appl-debuff',
  DEBUFF_ANTI_BUFF: 'anti-buff-appl-debuff',
  DEBUFF_DOT: 'dot-appl-debuff'
};

function slugForEffect(key) {
  if (EFFECT_FILE_SLUG[key]) return EFFECT_FILE_SLUG[key];
  return key.toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'effet';
}

function csvEscape(val) {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
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

  /** @type {Map<string, Array<{ name: string; element: string; rarity: string; description: string }>>} */
  const byEffect = new Map();

  for (const r of rows) {
    const skillData = parseJson(r.skill_data);
    const keys = collectUnitEffectKeys(skillData);
    const description = getSkillDescriptionText(skillData);
    const unitRow = {
      name: r.name,
      element: r.element ?? 'neutral',
      rarity: r.rarity ?? 'common',
      description: description || '—'
    };
    for (const k of keys) {
      if (!byEffect.has(k)) byEffect.set(k, []);
      byEffect.get(k).push(unitRow);
    }
  }

  const outDir = path.join(process.cwd(), '..', 'exports-effets-unites');
  fs.mkdirSync(outDir, { recursive: true });

  const effectKeys = Array.from(byEffect.keys()).sort((a, b) => a.localeCompare(b));
  const header = ['Nom', 'Élément', 'Rareté', 'Description de la compétence'];

  for (const key of effectKeys) {
    const list = byEffect.get(key) || [];
    const slug = slugForEffect(key);
    const fileName = `effet-${slug}.csv`;
    const lines = [header.map(csvEscape).join(',')];
    for (const u of list) {
      lines.push(
        [u.name, u.element, u.rarity, u.description].map(csvEscape).join(',')
      );
    }
    const outPath = path.join(outDir, fileName);
    fs.writeFileSync(outPath, '\uFEFF' + lines.join('\n'), 'utf8');
    console.log(`${fileName} (${list.length} unité(s))`);
  }

  const indexLines = [
    '# Index des fichiers générés (effet technique → fichier)',
    ...effectKeys.map((k) => `${k}\t${`effet-${slugForEffect(k)}.csv`}`)
  ];
  fs.writeFileSync(path.join(outDir, 'INDEX.txt'), indexLines.join('\n'), 'utf8');

  console.log(`\nDossier : ${outDir}`);
  console.log(`${effectKeys.length} fichiers CSV + INDEX.txt`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
