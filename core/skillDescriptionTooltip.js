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

/** Ligne synthétique à partir d’un objet compétence (ACTIVE/PASSIVE / legacy). */
function inferSyntheticSkillLine(skillObj) {
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

/** Texte global `description.skill` (hors entrées skills[]), normalisé. */
function getGlobalSkillDescription(skillData) {
  if (!skillData || typeof skillData !== 'object') return '';
  const desc = skillData.description;
  if (!desc || typeof desc !== 'object') return '';
  const raw = desc.skill;
  if (typeof raw === 'string' && raw.trim()) {
    return normalizeSkillDescriptionLite(raw.trim());
  }
  return '';
}

/** Au moins une entrée ACTIVE/PASSIVE pertinente a un champ `description` non vide (texte lié à la capacité). */
function hasAnySkillEntryDescription(skillData) {
  const relevant = collectRelevantSkillsForTooltip(skillData);
  for (const sk of relevant) {
    const raw = sk.description;
    if (typeof raw === 'string' && raw.trim()) return true;
  }
  return false;
}

/** Synthèse depuis les champs techniques (effets, CD…). N’utilise pas description.skill (texte générique). */
function buildSkillDescriptionFromSkillData(skillData) {
  if (!skillData || typeof skillData !== 'object') return '';
  const skills = Array.isArray(skillData.skills) ? skillData.skills : [];
  const active = skills.find((s) => s && String(s.type ?? '').toUpperCase() === 'ACTIVE');
  const skillObj = active ?? skillData.skill ?? skillData.basic ?? skillData;
  return inferSyntheticSkillLine(skillObj);
}

/**
 * Entrées ACTIVE/PASSIVE pour l’affichage : `skills[]` + passifs au format legacy
 * (`passives` à la racine ou sous `skill.passives`), sans doublon si un PASSIVE existe déjà dans `skills[]`.
 */
export function collectRelevantSkillsForTooltip(skillData) {
  if (!skillData || typeof skillData !== 'object') return [];
  const out = [];
  const skills = Array.isArray(skillData.skills) ? skillData.skills : [];
  for (const s of skills) {
    if (s != null && typeof s === 'object' && ['ACTIVE', 'PASSIVE'].includes(String(s.type ?? '').toUpperCase())) {
      out.push(s);
    }
  }
  const hasPassiveInSkills = out.some((s) => String(s.type ?? '').toUpperCase() === 'PASSIVE');
  const inner = skillData.skill && typeof skillData.skill === 'object' ? skillData.skill : null;
  const legacyPassives = Array.isArray(skillData.passives) && skillData.passives.length
    ? skillData.passives
    : Array.isArray(inner?.passives) && inner.passives.length
      ? inner.passives
      : [];
  if (!hasPassiveInSkills && legacyPassives.length) {
    for (const p of legacyPassives) {
      if (p != null && typeof p === 'object') {
        out.push({ type: 'PASSIVE', ...p });
      }
    }
  }
  return out;
}

/**
 * Bloc multi-compétences (ACTIVE/PASSIVE), ou chaîne vide si une seule entrée pertinente.
 */
export function getMultiSkillDescriptionsForTooltip(skillData) {
  if (!skillData || typeof skillData !== 'object') return '';
  const relevant = collectRelevantSkillsForTooltip(skillData);
  if (relevant.length < 2) return '';
  /** Sans aucune description sur les entrées skills[], on ne montre pas le bloc multi (lignes synthétiques seules) : le repli est description.skill. */
  if (!hasAnySkillEntryDescription(skillData)) return '';

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
      body = inferSyntheticSkillLine(sk) || '—';
    }
    parts.push(`${label}\n${body}`);
  }
  return parts.join('\n\n');
}

/**
 * Texte unique pour tooltip / decisionRequest : multi-compétences si applicable,
 * sinon description sur la compétence ACTIVE dans skills[], puis texte spé A/B si `opts.specialization`,
 * puis `description.skill` si aucune description liée aux entrées skills[] n’est renseignée,
 * puis synthèse technique.
 * @param {{ specialization?: 'A'|'B' }} [opts] - pour afficher le texte de spé quand la compétence n’a pas de description dédiée
 */
export function getSkillTooltipPlainText(skillData, opts = {}) {
  if (!skillData || typeof skillData !== 'object') return '';

  const multi = getMultiSkillDescriptionsForTooltip(skillData);
  if (multi) return multi;

  const spec = opts.specialization === 'A' || opts.specialization === 'B' ? opts.specialization : null;

  const relevant = collectRelevantSkillsForTooltip(skillData);
  if (relevant.length === 1 && String(relevant[0].type ?? '').toUpperCase() === 'PASSIVE') {
    const raw = relevant[0].description;
    if (typeof raw === 'string' && raw.trim()) {
      return normalizeSkillDescriptionLite(raw.trim());
    }
    const globalPassive = getGlobalSkillDescription(skillData);
    if (globalPassive) return globalPassive;
    const synth = inferSyntheticSkillLine(relevant[0]);
    if (synth) return synth;
  }

  const skills = Array.isArray(skillData.skills) ? skillData.skills : [];
  const active = skills.find((s) => s && String(s.type ?? '').toUpperCase() === 'ACTIVE');
  if (active && typeof active.description === 'string' && active.description.trim()) {
    return normalizeSkillDescriptionLite(active.description.trim());
  }

  const desc = skillData.description;
  if (desc && typeof desc === 'object') {
    const d = desc;
    if (spec === 'A' && typeof d.specA === 'string' && d.specA.trim()) {
      return normalizeSkillDescriptionLite(d.specA.trim());
    }
    if (spec === 'B' && typeof d.specB === 'string' && d.specB.trim()) {
      return normalizeSkillDescriptionLite(d.specB.trim());
    }
  }

  const globalSkill = getGlobalSkillDescription(skillData);
  if (globalSkill) return globalSkill;

  return buildSkillDescriptionFromSkillData(skillData);
}
