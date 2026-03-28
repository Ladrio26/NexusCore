import { getMultiSkillDescriptionsForTooltip, getSkillTooltipPlainText } from '@engine/skillDescriptionTooltip.js';

/**
 * Texte complet pour l’UI : entrées skills[] en priorité ; sinon `description.skill` (voir moteur) ;
 * si l’unité est spécialisée (A/B) : base + **specA/specB** en dessous lorsqu’il existe.
 */
export function getUnitSkillDisplayText(
  skillData: Record<string, unknown> | null | undefined,
  specialization?: string | null
): string {
  if (!skillData || typeof skillData !== 'object') return '';

  const specLetter =
    specialization != null && String(specialization).trim() !== ''
      ? String(specialization).toUpperCase()
      : null;

  let base = getSkillTooltipPlainText(skillData, {}).trim();
  if (!base) {
    base = (buildSkillDescriptionFromSkillData(skillData) || '').trim();
  }

  let specLine = '';
  if (specLetter === 'A' || specLetter === 'B') {
    const desc = skillData.description;
    if (desc && typeof desc === 'object') {
      const d = desc as Record<string, unknown>;
      const raw = specLetter === 'A' ? d.specA : d.specB;
      if (typeof raw === 'string' && raw.trim()) {
        specLine = normalizeSkillDescription(raw.trim());
      }
    }
  }

  if (specLine) {
    if (base) {
      if (base === specLine) return normalizeSkillDescription(base);
      /** Ne pas passer le tout dans normalizeSkillDescription : les \n\n seraient effacés (\s{2,}). */
      const baseNorm = normalizeSkillDescription(base);
      return baseNorm ? `${baseNorm}\n\n${specLine}` : specLine;
    }
    return specLine;
  }

  if (base) return normalizeSkillDescription(base);
  return '';
}

/** Texte de la compétence active sans la ligne de spécialisation A/B (pour affichage structuré). */
export function getUnitSkillBaseText(skillData: Record<string, unknown> | null | undefined): string {
  if (!skillData || typeof skillData !== 'object') return '';
  let base = getSkillTooltipPlainText(skillData, {}).trim();
  if (!base) {
    base = (buildSkillDescriptionFromSkillData(skillData) || '').trim();
  }
  return base ? normalizeSkillDescription(base) : '';
}

/** Bloc contenant specA/specB : `description` racine ou `description` de la compétence ACTIVE dans skills[]. */
function getSpecBranchDescriptionObject(
  skillData: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!skillData || typeof skillData !== 'object') return null;
  const root = skillData.description;
  if (root && typeof root === 'object') {
    const d = root as Record<string, unknown>;
    if (typeof d.specA === 'string' || typeof d.specB === 'string') return d;
  }
  const skills = Array.isArray(skillData.skills) ? skillData.skills : [];
  const active = skills.find(
    (s: unknown) => s && typeof s === 'object' && String((s as Record<string, unknown>).type ?? '').toUpperCase() === 'ACTIVE'
  ) as Record<string, unknown> | undefined;
  const ad = active?.description;
  if (ad && typeof ad === 'object') {
    const d = ad as Record<string, unknown>;
    if (typeof d.specA === 'string' || typeof d.specB === 'string') return d;
  }
  return null;
}

/** Texte de la branche spécialisée (specA / specB) si l’unité a choisi A ou B. */
export function getUnitSpecializationText(
  skillData: Record<string, unknown> | null | undefined,
  specialization?: string | null
): string {
  const specLetter =
    specialization != null && String(specialization).trim() !== ''
      ? String(specialization).trim().toUpperCase()
      : null;
  if (specLetter !== 'A' && specLetter !== 'B') return '';
  const d = getSpecBranchDescriptionObject(skillData);
  if (!d) return '';
  const raw = specLetter === 'A' ? d.specA : d.specB;
  return typeof raw === 'string' && raw.trim() ? normalizeSkillDescription(raw.trim()) : '';
}

/**
 * Description liée aux capacités (skills[]) en priorité ; sinon spé A/B ; sinon `description.skill`.
 */
export function getSkillEffectDescription(
  skillData: Record<string, unknown> | null | undefined,
  opts?: { specialization?: 'A' | 'B' | null }
): string {
  if (!skillData || typeof skillData !== 'object') return '';

  const skills = Array.isArray(skillData.skills) ? skillData.skills : [];
  const active = skills.find(
    (s: unknown) => s && typeof s === 'object' && String((s as Record<string, unknown>).type ?? '').toUpperCase() === 'ACTIVE'
  ) as Record<string, unknown> | undefined;
  if (active) {
    const d = active.description;
    if (typeof d === 'string' && d.trim()) return normalizeSkillDescription(d.trim());
  }

  const desc = skillData.description;
  if (desc && typeof desc === 'object') {
    const d = desc as Record<string, unknown>;
    const spec = opts?.specialization;
    if (spec === 'A' && typeof d.specA === 'string' && d.specA.trim()) {
      return normalizeSkillDescription(d.specA.trim());
    }
    if (spec === 'B' && typeof d.specB === 'string' && d.specB.trim()) {
      return normalizeSkillDescription(d.specB.trim());
    }
    if (typeof d.skill === 'string' && d.skill.trim()) {
      return normalizeSkillDescription(d.skill.trim());
    }
  }
  return '';
}

/**
 * Construit une description de compétence depuis skill_data (fallback synthétique uniquement).
 * N’utilise pas description.skill (texte générique).
 */
export function buildSkillDescriptionFromSkillData(skillData: Record<string, unknown> | null | undefined): string {
  if (!skillData || typeof skillData !== 'object') return '';
  const skills = Array.isArray(skillData.skills) ? skillData.skills : [];
  const active = skills.find((s: unknown) => s && typeof s === 'object' && String((s as Record<string, unknown>).type ?? '').toUpperCase() === 'ACTIVE') as Record<string, unknown> | undefined;
  const skillObj = active ?? (skillData.skill as Record<string, unknown>) ?? (skillData.basic as Record<string, unknown>) ?? skillData;
  if (!skillObj || typeof skillObj !== 'object') return '';
  let type = String(skillObj.type ?? '').toUpperCase();
  if (!type && Array.isArray(skillObj.effects)) {
    for (const e of skillObj.effects as Array<Record<string, unknown>>) {
      const t = String(e?.type ?? '').toUpperCase();
      if (t === 'DAMAGE') { type = 'DAMAGE'; break; }
      if (t === 'HEAL') { type = 'HEAL'; break; }
      if (t === 'SHIELD') { type = 'SHIELD'; break; }
      if (t === 'APPLY_DEBUFF') { type = 'APPLY_DEBUFF'; break; }
      if (t === 'APPLY_BUFF') { type = 'BUFF'; break; }
    }
    if (!type) type = 'GENERIC';
  }
  if (!type) type = 'GENERIC';
  const labels: Record<string, string> = {
    BASIC: 'Attaque de base',
    GENERIC: 'Attaque spéciale',
    DAMAGE: 'Dégâts',
    DAMAGE_SINGLE: 'Dégâts monocible',
    DAMAGE_AOE: 'Dégâts de zone',
    HEAL: 'Soin',
    SHIELD: 'Bouclier',
    BUFF: 'Bonus',
    APPLY_DEBUFF: 'Débuff'
  };
  const parts = [labels[type] ?? type];
  if (skillObj.mult != null) parts.push(`×${skillObj.mult}`);
  if (skillObj.cd_actions != null) parts.push(`CD ${skillObj.cd_actions}`);
  return parts.join(' ');
}

/**
 * Bestiaire : même logique que le combat (skills[] + passifs legacy `passives`).
 * Si ≥2 entrées ACTIVE/PASSIVE pertinentes, texte par compétence ; sinon chaîne vide.
 */
export function getBestiaryMultiSkillDescriptions(skillData: Record<string, unknown> | null | undefined): string {
  if (!skillData || typeof skillData !== 'object') return '';
  return getMultiSkillDescriptionsForTooltip(skillData) || '';
}

/**
 * Normalise l'affichage des descriptions de compétences et spécialisations
 * pour qu'une même information soit écrite de la même façon partout.
 */
export function normalizeSkillDescription(text: string | null | undefined): string {
  if (text == null || typeof text !== 'string') return '';
  let s = text.trim();
  if (!s) return '';

  // CD : toujours avec espace avant les deux-points
  s = s.replace(/\bCD\s*:\s*/g, 'CD : ');

  // "Le temps de recharge passe à X tours" → "CD passe à X tours"
  s = s.replace(/\bLe temps de recharge passe à (\d+) tours?/gi, 'CD passe à $1 tours');

  // "CD passe à X." (sans "tours") → "CD passe à X tours."
  s = s.replace(/\bCD passe à (\d+)\./g, 'CD passe à $1 tours.');

  // Pourcentages ATB : "X% ATB" (gain/don) → "X% d'ATB"
  s = s.replace(/(\d+)\s*%\s*ATB(?!\w)/g, "$1% d'ATB");

  // Espaces multiples → un seul
  s = s.replace(/\s{2,}/g, ' ');

  // Phrase terminée par un point (si ça ressemble à une phrase et ne se termine pas par . ! ?)
  const last = s.slice(-1);
  if (last && !/[\\.!?]/.test(last)) s += '.';

  return s.trim();
}
