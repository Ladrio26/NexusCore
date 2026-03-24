#!/usr/bin/env node
/**
 * Script de debug : vérifie la structure skill_data des unités et ce que getSkillEffectDescription retournerait.
 */
import { query } from '../src/config/db.js';

function getSkillEffectDescription(skillData) {
  if (!skillData || typeof skillData !== 'object') return '';
  const skills = Array.isArray(skillData.skills) ? skillData.skills : [];
  const active = skills.find((s) => s && typeof s === 'object' && String(s.type ?? '').toUpperCase() === 'ACTIVE');
  if (active && typeof active.description === 'string' && active.description.trim()) {
    return active.description.trim();
  }
  const desc = skillData.description;
  if (desc && typeof desc === 'object' && typeof desc.skill === 'string' && desc.skill.trim()) {
    return desc.skill.trim();
  }
  return '';
}

async function main() {
  const bossRows = await query('SELECT DISTINCT boss_unit_code FROM campaign_stages WHERE boss_unit_code IS NOT NULL AND boss_unit_code != ""');
  const bossCodes = bossRows.map((r) => r.boss_unit_code).filter(Boolean);
  const placeholders = bossCodes.map(() => '?').join(', ');
  const summonable = await query(
    `SELECT id, code, name, rarity, skill_data FROM units WHERE code NOT IN (${placeholders || "'__none__'"}) ORDER BY id LIMIT 10`,
    bossCodes.length ? bossCodes : []
  );
  console.log('=== Unités INVOQUABLES (hors boss) ===\n');
  const { getSkillDescriptionForTooltip } = await import('../src/utils/skillDescription.js');
  for (const r of summonable) {
    const sd = typeof r.skill_data === 'string' ? JSON.parse(r.skill_data || 'null') : r.skill_data;
    const apiDesc = getSkillDescriptionForTooltip({ skill_data: sd });
    console.log(`ID ${r.id} | ${r.code} | ${r.name} (${r.rarity})`);
    console.log('  skill_description (API) =>', apiDesc || '(vide)');
    console.log('');
  }
}

main().catch(console.error);
