/**
 * Règles d’incompatibilité locales (miroir backend customUnitIncompatibilities).
 */

function normUpper(s: string) {
  return String(s || '')
    .trim()
    .toUpperCase();
}

function atbUp(arr: string[]) {
  return arr.some((x) => x === 'ATB_UP_50' || x === 'ATB_UP_100');
}

function atbDown(arr: string[]) {
  return arr.some((x) => x === 'REDUCE_ATB_50' || x === 'REDUCE_ATB_100');
}

function bigAoeTarget(t: string) {
  const u = normUpper(t);
  return u === 'TEAM_ENEMY' || u === 'TEAM_ALLY' || u === 'TEAM';
}

export type SlotBrief = { id: string; target: string };

/**
 * Combinaisons invalides sur une compétence (cibles par ligne d’effet).
 */
export function skillEffectsConflictReasonsForSlots(slots: SlotBrief[]): string[] {
  const effects = slots.map((s) => normUpper(s.id)).filter(Boolean);
  const errors: string[] = [];

  if (effects.includes('RESURRECT') && effects.includes('INVINCIBILITY')) {
    errors.push('RESURRECT et INVINCIBILITY exclus sur la même compétence.');
  }
  if (atbUp(effects) && atbDown(effects)) {
    errors.push('ATB↑ et ATB↓ incompatibles sur la même compétence.');
  }

  const hasReset = effects.includes('RESET_SKILL_CD');
  const hasBigAoeDamage = slots.some((s) => normUpper(s.id) === 'DAMAGE' && bigAoeTarget(s.target));
  if (hasReset && hasBigAoeDamage) {
    errors.push('RESET_SKILL_CD interdit avec des dégâts de zone sur cette compétence.');
  }

  return errors;
}

/**
 * Candidat effet au slot `slotIndex` avec cible `rowTarget`.
 */
export function isEffectDisabledForSlot(
  candidate: string,
  slotIndex: number,
  slots: SlotBrief[],
  rowTarget: string
): { disabled: boolean; reason?: string } {
  if (!candidate) return { disabled: false };
  const up = normUpper(candidate);
  const dup = slots.some(
    (s, i) => i !== slotIndex && normUpper(s.id) === up && up !== ''
  );
  if (dup) return { disabled: true, reason: 'Cet effet est déjà utilisé sur cette compétence.' };
  const next: SlotBrief[] = slots.map((s, i) =>
    i === slotIndex ? { id: candidate, target: rowTarget } : { id: s.id, target: s.target }
  );
  const reasons = skillEffectsConflictReasonsForSlots(next);
  if (reasons.length) return { disabled: true, reason: reasons[0] };
  return { disabled: false };
}
