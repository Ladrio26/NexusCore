/**
 * Construit une description de compétence depuis skill_data (fallback côté client).
 * Même logique que getSkillDescriptionForTooltip backend.
 */
export function buildSkillDescriptionFromSkillData(skillData: Record<string, unknown> | null | undefined): string {
  if (!skillData || typeof skillData !== 'object') return '';
  const desc = skillData.description;
  if (desc && typeof desc === 'object') {
    const d = desc as Record<string, unknown>;
    const skill = d.skill;
    if (typeof skill === 'string' && skill.trim()) return skill.trim();
    const specA = d.specA;
    if (typeof specA === 'string' && specA.trim()) return specA.trim();
    const specB = d.specB;
    if (typeof specB === 'string' && specB.trim()) return specB.trim();
  }
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
