#!/usr/bin/env node
/**
 * Exporte la liste des unités de la base vers un fichier ODS à la racine du projet.
 * Usage: depuis la racine: node scripts/export-units-to-ods.mjs
 *        depuis backend:  node scripts/export-units-to-ods.mjs (depuis backend, scripts au même niveau)
 * Nécessite: DB accessible en local (localhost:3306 ou DB_HOST/DB_PORT), mysql2 (backend/node_modules).
 */
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const backendDir = path.join(PROJECT_ROOT, 'backend');
const require = createRequire(path.join(backendDir, 'package.json'));
const mysql = require('mysql2/promise');
import { mkdir, writeFile } from 'fs/promises';
import { execSync } from 'child_process';

const OUT_ODS = path.join(PROJECT_ROOT, 'unites.ods');

const DB = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'ladrio',
  password: process.env.DB_PASSWORD || 'cerise',
  database: process.env.DB_NAME || 'nexuscore'
};

function escapeXml(s) {
  if (s == null || s === undefined) return '';
  const t = String(s);
  return t
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function descriptionFromSkillData(skillData) {
  if (!skillData || typeof skillData !== 'object') return '';
  const d = skillData.description;
  if (!d || typeof d !== 'object') return '';
  const parts = [];
  if (d.skill) parts.push(d.skill);
  if (d.specA) parts.push('Spec A: ' + d.specA);
  if (d.specB) parts.push('Spec B: ' + d.specB);
  return parts.join(' | ');
}

function skillSummary(skillData) {
  if (!skillData || typeof skillData !== 'object') return '';
  const skill = skillData.skill || (Array.isArray(skillData.skills) && skillData.skills[0]) || null;
  if (!skill) return skillData.passives ? 'Passif' : '';
  const type = (skill.type || '').toUpperCase();
  const cd = skill.cd_actions ?? skill.cooldown;
  const effects = Array.isArray(skill.effects) ? skill.effects : [];
  const parts = [];
  if (type === 'PASSIVE') parts.push('Passif');
  else if (type) parts.push(type);
  if (cd != null && cd > 0) parts.push('CD ' + cd);
  if (effects.length) parts.push(effects.length + ' effet(s)');
  return parts.join(' · ');
}

async function main() {
  const conn = await mysql.createConnection(DB);
  const [rows] = await conn.execute(
    `SELECT name, rarity, element, role, attack_type, archetype,
            base_hp, base_attack, base_defense, base_speed, mastery,
            traits, skill_data
     FROM units
     ORDER BY name`
  );
  await conn.end();

  const cols = ['Nom', 'Rareté', 'Element', 'ROLE', 'ATTACK TYPE', 'ARCHETYPE', 'HP', 'ATQ', 'DEF', 'VITESSE', 'MAITRISE', 'TRAITS', 'DESCRIPTION', 'SKILL'];

  const tableRows = [
    cols.map((c) => `<table:table-cell office:value-type="string"><text:p>${escapeXml(c)}</text:p></table:table-cell>`).join('\n')
  ];

  for (const r of rows) {
    const traitsStr = Array.isArray(r.traits) ? r.traits.join(', ') : (r.traits ? String(r.traits) : '');
    const skillData = typeof r.skill_data === 'string' ? JSON.parse(r.skill_data || '{}') : r.skill_data;
    const desc = descriptionFromSkillData(skillData);
    const skill = skillSummary(skillData);
    const cells = [
      r.name,
      r.rarity,
      r.element,
      r.role,
      r.attack_type,
      r.archetype,
      String(r.base_hp ?? ''),
      String(r.base_attack ?? ''),
      String(r.base_defense ?? ''),
      String(r.base_speed ?? ''),
      String(r.mastery ?? ''),
      traitsStr,
      desc,
      skill
    ];
    tableRows.push(
      cells
        .map(
          (val, i) =>
            `<table:table-cell office:value-type="${i >= 6 && i <= 10 && val !== '' ? 'float' : 'string'}"><text:p>${escapeXml(val)}</text:p></table:table-cell>`
        )
        .join('\n')
    );
  }

  const contentXml = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0">
  <office:body>
    <office:spreadsheet>
      <table:table table:name="Unités">
${tableRows.map((row) => '        <table:table-row>\n          ' + row.replace(/\n/g, '\n          ') + '\n        </table:table-row>').join('\n')}
      </table:table>
    </office:spreadsheet>
  </office:body>
</office:document-content>`;

  const metaXml = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"/>
`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"/>
`;

  const manifestXml = `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0">
  <manifest:file-entry manifest:media-type="application/vnd.oasis.opendocument.spreadsheet" manifest:full-path="/"/>
  <manifest:file-entry manifest:media-type="text/xml" manifest:full-path="content.xml"/>
  <manifest:file-entry manifest:media-type="text/xml" manifest:full-path="meta.xml"/>
  <manifest:file-entry manifest:media-type="text/xml" manifest:full-path="styles.xml"/>
  <manifest:file-entry manifest:media-type="text/xml" manifest:full-path="META-INF/manifest.xml"/>
</manifest:manifest>`;

  const mimetype = 'application/vnd.oasis.opendocument.spreadsheet';
  const tmpDir = path.join(PROJECT_ROOT, '.tmp_ods_export');
  await mkdir(tmpDir, { recursive: true });
  await mkdir(path.join(tmpDir, 'META-INF'), { recursive: true });

  await writeFile(path.join(tmpDir, 'mimetype'), mimetype, 'ascii');
  await writeFile(path.join(tmpDir, 'content.xml'), contentXml, 'utf8');
  await writeFile(path.join(tmpDir, 'meta.xml'), metaXml, 'utf8');
  await writeFile(path.join(tmpDir, 'styles.xml'), stylesXml, 'utf8');
  await writeFile(path.join(tmpDir, 'META-INF', 'manifest.xml'), manifestXml, 'utf8');

  // ODS: mimetype must be first and uncompressed (créer le zip dans tmpDir puis déplacer)
  const odsName = path.basename(OUT_ODS);
  execSync(`cd "${tmpDir}" && zip -0 -X "${odsName}" mimetype`, { stdio: 'inherit' });
  execSync(`cd "${tmpDir}" && zip -u "${odsName}" content.xml meta.xml styles.xml META-INF/manifest.xml`, { stdio: 'inherit' });

  const { rename, rm } = await import('fs/promises');
  await rename(path.join(tmpDir, odsName), OUT_ODS);
  await rm(tmpDir, { recursive: true, force: true });

  console.log('Export OK:', OUT_ODS);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
