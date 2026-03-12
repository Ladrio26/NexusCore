/**
 * Utilitaire pour dériver une description de compétence à afficher dans les tooltips.
 * Gère : description.skill/specA/specB, skill (legacy), skills[] (nouveau format).
 */

const SKILL_TYPE_FR = {
  BASIC: 'Attaque de base',
  GENERIC: 'Attaque spéciale',
  DAMAGE: 'Dégâts',
  DAMAGE_SINGLE: 'Dégâts monocible',
  DAMAGE_AOE: 'Dégâts de zone',
  HEAL: 'Soin',
  HEALS: 'Soins',
  SHIELD: 'Bouclier',
  BUFF: 'Bonus',
  APPLY_DEBUFF: 'Débuff',
  APPLY_BUFF: 'Bonus'
};

function skillTypeToLabel(type) {
  if (!type) return 'Compétence';
  const t = String(type).toUpperCase();
  return SKILL_TYPE_FR[t] ?? t;
}

function inferTypeFromEffects(effects) {
  if (!Array.isArray(effects) || effects.length === 0) return 'GENERIC';
  for (const e of effects) {
    const t = String(e?.type ?? '').toUpperCase();
    if (t === 'DAMAGE') return 'DAMAGE';
    if (t === 'HEAL') return 'HEAL';
    if (t === 'SHIELD' || t === 'APPLY_BUFF') return t === 'SHIELD' ? 'SHIELD' : 'BUFF';
    if (t === 'APPLY_DEBUFF') return 'APPLY_DEBUFF';
  }
  return 'GENERIC';
}

/** Une ligne de description de la compétence pour le tooltip. */
export function getSkillDescriptionForTooltip(u) {
  const data = u?.skill_data ?? u?.skillData;
  if (!data || typeof data !== 'object') return '';

  // 1. Texte explicite depuis description (priorité)
  const desc = data.description;
  if (desc && typeof desc === 'object') {
    const d = desc;
    if (typeof d.skill === 'string' && d.skill.trim()) return d.skill.trim();
    if (typeof d.specA === 'string' && d.specA.trim()) return d.specA.trim();
    if (typeof d.specB === 'string' && d.specB.trim()) return d.specB.trim();
  }

  // 2. Format skills[] (nouveau)
  const skills = Array.isArray(data.skills) ? data.skills : [];
  const activeSkill = skills.find((s) => s && String(s.type || '').toUpperCase() === 'ACTIVE');
  const skillObj = activeSkill ?? data.skill ?? data.basic ?? data;

  if (skillObj && typeof skillObj === 'object') {
    let type = String(skillObj.type || '').toUpperCase();
    if (!type && Array.isArray(skillObj.effects)) {
      type = inferTypeFromEffects(skillObj.effects);
    }
    if (!type) type = 'GENERIC';
    const parts = [skillTypeToLabel(type)];
    if (skillObj.mult != null) parts.push(`×${skillObj.mult}`);
    if (skillObj.cd_actions != null) parts.push(`CD ${skillObj.cd_actions}`);
    return parts.join(' ');
  }

  return '';
}
