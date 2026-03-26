/**
 * Spécialisation des unités custom (budget) : stats +10 % (A/B) et effet gratuit sur la compétence I.
 * Aligné sur core/combatEngine.js BONUS_STAT_MAP (specA_bonus_stat / specB_bonus_stat sur units).
 */

export const VALID_SPEC_BONUS_STATS = ['attack', 'defense', 'speed', 'mastery', 'maxHp'];

/** Buff soi gratuit sur la compétence I (hors budget). */
export const VALID_SKILL1_SPEC_BONUS = ['SELF_ATK', 'SELF_DEF', 'SELF_SPEED'];

/**
 * @param {string} raw
 * @returns {string|null}
 */
export function normalizeSpecBonusStat(raw) {
  const u = String(raw || '')
    .trim()
    .toLowerCase();
  if (u === 'hp') return 'maxHp';
  if (VALID_SPEC_BONUS_STATS.includes(u)) return u;
  return null;
}

/**
 * @param {string} raw
 * @returns {string|null}
 */
export function normalizeSkill1SpecBonus(raw) {
  const u = String(raw || '')
    .trim()
    .toUpperCase();
  return VALID_SKILL1_SPEC_BONUS.includes(u) ? u : null;
}

/**
 * @param {object} config
 * @returns {string[]}
 */
export function validateSpecializationConfig(config) {
  const errors = [];
  if (!config || typeof config !== 'object') return errors;

  const hasSpecA = config.specAStat != null && String(config.specAStat).trim() !== '';
  const hasSpecB = config.specBStat != null && String(config.specBStat).trim() !== '';
  const hasBonus = config.skill1SpecBonus != null && String(config.skill1SpecBonus).trim() !== '';

  /** Rétrocompat : aucun champ → pas d’erreur (valeurs dérivées comme avant). */
  if (!hasSpecA && !hasSpecB && !hasBonus) return errors;

  if (!hasSpecA || !hasSpecB || !hasBonus) {
    errors.push(
      'Spécialisation : choisis les deux stats bonus (spé A et B, +10 % chacune) et l’effet bonus sur la compétence I.'
    );
    return errors;
  }

  const sa = normalizeSpecBonusStat(config.specAStat);
  const sb = normalizeSpecBonusStat(config.specBStat);
  const bonus = normalizeSkill1SpecBonus(config.skill1SpecBonus);
  if (!sa) errors.push('Spé A : stat invalide (attaque, défense, vitesse, maîtrise ou PV max).');
  if (!sb) errors.push('Spé B : stat invalide (attaque, défense, vitesse, maîtrise ou PV max).');
  if (!bonus) errors.push('Bonus compétence I : choix invalide (ATQ, DEF ou VITESSE sur soi).');

  return errors;
}
