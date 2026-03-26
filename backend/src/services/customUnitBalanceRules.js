/**
 * Règles d’équilibrage cross-compétences / arbre (data-driven).
 * @param {object | null} skill1
 * @param {object | null} skill2 — active ou passif
 * @param {string[]} selectedKeys
 * @returns {{ isValid: boolean, errors: string[], warnings: string[] }}
 */
export function validateGlobalRules(skill1, skill2, selectedKeys) {
  const errors = [];
  const warnings = [];
  const keys = new Set(selectedKeys || []);

  const collectEffects = (sk) => {
    if (!sk || !Array.isArray(sk.effects)) return [];
    return sk.effects;
  };
  const allEffects = [...collectEffects(skill1), ...collectEffects(skill2)];

  const hasTeamEnemyDamage = allEffects.some(
    (e) => e?.type === 'DAMAGE' && String(e.target || '').toUpperCase() === 'TEAM_ENEMY'
  );
  const hasLifestealPassive = keys.has('dps_s2_pas_LIFESTEAL');
  if (hasTeamEnemyDamage && hasLifestealPassive) {
    errors.push('Combinaison interdite : dégâts de zone + vol de vie passif.');
  }

  const hasPercentHpDamage = allEffects.some(
    (e) => e?.type === 'DAMAGE' && e.percentMaxHp != null && Number(e.percentMaxHp) > 0
  );
  if (hasPercentHpDamage && keys.has('dps_s1_s3_CD_REDUCTION')) {
    errors.push('Réduction de recharge incompatible avec les dégâts % PV max sur la compétence 1.');
  }

  let atbSum = 0;
  for (const e of allEffects) {
    if (String(e?.type || '').toUpperCase() === 'ATB_UP' && e.percent != null) {
      atbSum += Number(e.percent);
    }
  }
  if (atbSum > 0.45) {
    warnings.push('Gain d’ATB cumulé élevé : tempo très agressif (surveillez les interactions en combat).');
  }

  const burstProfile =
    keys.has('dps_s1_s2_BURST') ||
    keys.has('assassin_s1_s2_BURST') ||
    keys.has('assassin_s1_s3_EXTREME_DAMAGE');
  const sustainProfile =
    keys.has('dps_s2_pas_LIFESTEAL') ||
    keys.has('assassin_s1_s2_SURVIVE') ||
    keys.has('tank_s1_s2_SUSTAIN');
  if (burstProfile && sustainProfile) {
    warnings.push('Mélange burst + sustain : build polyvalent — vérifiez la cohérence en jeu.');
  }

  if (keys.has('dps_s2_act_ATB_UP') && keys.has('dps_s2_pas_ATB_ON_HIT')) {
    warnings.push('Plusieurs sources d’ATB sur la compétence 2 : effets soumis à plafonds en combat.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}
