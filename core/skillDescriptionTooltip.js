/**
 * Textes de compétence pour tooltips (combat, API, moteur).
 * Si ≥2 entrées ACTIVE/PASSIVE dans skill_data.skills[], on affiche la description
 * par compétence (liée à l’unité), pas description.skill seule.
 */

function normalizeSkillDescriptionLite(text) {
  if (text == null || typeof text !== 'string') return '';
  let s = text.trim();
  if (!s) return '';
  s = s.replace(/\bCD\s*:\s*/g, 'CD : ');
  s = s.replace(/\bLe temps de recharge passe à (\d+) tours?/gi, 'CD passe à $1 tours');
  s = s.replace(/\bCD passe à (\d+)\./g, 'CD passe à $1 tours.');
  s = s.replace(/(\d+)\s*%\s*ATB(?!\w)/g, "$1% d'ATB");
  s = s.replace(/\s{2,}/g, ' ');
  const last = s.slice(-1);
  if (last && !/[.!?]/.test(last)) s += '.';
  return s.trim();
}

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

function buildSkillDescriptionFromSkillData(skillData) {
  if (!skillData || typeof skillData !== 'object') return '';
  const desc = skillData.description;
  if (desc && typeof desc === 'object') {
    const d = desc;
    if (typeof d.skill === 'string' && d.skill.trim()) return d.skill.trim();
    if (typeof d.specA === 'string' && d.specA.trim()) return d.specA.trim();
    if (typeof d.specB === 'string' && d.specB.trim()) return d.specB.trim();
  }
  const skills = Array.isArray(skillData.skills) ? skillData.skills : [];
  const active = skills.find((s) => s && String(s.type ?? '').toUpperCase() === 'ACTIVE');
  const skillObj = active ?? skillData.skill ?? skillData.basic ?? skillData;
  if (!skillObj || typeof skillObj !== 'object') return '';
  let type = String(skillObj.type ?? '').toUpperCase();
  if (!type && Array.isArray(skillObj.effects)) {
    for (const e of skillObj.effects) {
      const t = String(e?.type ?? '').toUpperCase();
      if (t === 'DAMAGE') {
        type = 'DAMAGE';
        break;
      }
      if (t === 'HEAL') {
        type = 'HEAL';
        break;
      }
      if (t === 'SHIELD') {
        type = 'SHIELD';
        break;
      }
      if (t === 'APPLY_DEBUFF') {
        type = 'APPLY_DEBUFF';
        break;
      }
      if (t === 'APPLY_BUFF') {
        type = 'BUFF';
        break;
      }
    }
    if (!type) type = 'GENERIC';
  }
  if (!type) type = 'GENERIC';
  const parts = [skillTypeToLabel(type)];
  if (skillObj.mult != null) parts.push(`×${skillObj.mult}`);
  if (skillObj.cd_actions != null) parts.push(`CD ${skillObj.cd_actions}`);
  return parts.join(' ');
}

/**
 * Bloc multi-compétences (ACTIVE/PASSIVE), ou chaîne vide si une seule entrée pertinente.
 */
export function getMultiSkillDescriptionsForTooltip(skillData) {
  if (!skillData || typeof skillData !== 'object') return '';
  const skills = Array.isArray(skillData.skills) ? skillData.skills : [];
  const relevant = skills.filter(
    (s) =>
      s != null &&
      typeof s === 'object' &&
      ['ACTIVE', 'PASSIVE'].includes(String(s.type ?? '').toUpperCase())
  );
  if (relevant.length < 2) return '';

  const parts = [];
  for (const sk of relevant) {
    const type = String(sk.type ?? '').toUpperCase();
    const sameType = relevant.filter((s) => String(s.type ?? '').toUpperCase() === type);
    const idxInType = sameType.indexOf(sk);
    const base = type === 'PASSIVE' ? 'Passif' : 'Compétence active';
    const label = sameType.length > 1 ? `${base} (${idxInType + 1})` : base;

    const raw = sk.description;
    let body = '';
    if (typeof raw === 'string' && raw.trim()) {
      body = normalizeSkillDescriptionLite(raw.trim());
    } else {
      body = buildSkillDescriptionFromSkillData({ skill: sk, description: skillData.description }) || '—';
    }
    parts.push(`${label}\n${body}`);
  }
  return parts.join('\n\n');
}

/**
 * Texte unique pour tooltip / decisionRequest : multi-compétences si applicable,
 * sinon description ACTIVE puis description.skill puis fallback synthétique.
 */
export function getSkillTooltipPlainText(skillData) {
  if (!skillData || typeof skillData !== 'object') return '';

  const multi = getMultiSkillDescriptionsForTooltip(skillData);
  if (multi) return multi;

  const skills = Array.isArray(skillData.skills) ? skillData.skills : [];
  const active = skills.find((s) => s && String(s.type ?? '').toUpperCase() === 'ACTIVE');
  if (active && typeof active.description === 'string' && active.description.trim()) {
    return normalizeSkillDescriptionLite(active.description.trim());
  }

  const desc = skillData.description;
  if (desc && typeof desc === 'object') {
    const d = desc;
    if (typeof d.skill === 'string' && d.skill.trim()) return normalizeSkillDescriptionLite(d.skill.trim());
    if (typeof d.specA === 'string' && d.specA.trim()) return normalizeSkillDescriptionLite(d.specA.trim());
    if (typeof d.specB === 'string' && d.specB.trim()) return normalizeSkillDescriptionLite(d.specB.trim());
  }

  return buildSkillDescriptionFromSkillData(skillData);
}
