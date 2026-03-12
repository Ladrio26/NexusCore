export const ARTIFACT_STAT_KEYS = Object.freeze(['attack', 'defense', 'speed', 'maxHp', 'mastery']);

export const ARTIFACT_STAT_LABELS_FR = Object.freeze({
  attack: 'ATQ',
  defense: 'DEF',
  speed: 'Vitesse',
  maxHp: 'HP',
  mastery: 'Maitrise'
});

export function isValidArtifactStatKey(statKey) {
  return ARTIFACT_STAT_KEYS.includes(String(statKey || ''));
}

export function getArtifactBaseBonus(statKey) {
  if (String(statKey) === 'maxHp') return 50;
  return String(statKey) === 'mastery' ? 20 : 10;
}

export function getArtifactBonusValue(statKey, level = 0) {
  const normalizedLevel = Math.max(0, Number(level) || 0);
  const base = getArtifactBaseBonus(statKey);
  return base + normalizedLevel * base;
}

export function getArtifactUpgradeCost(level = 0) {
  const normalizedLevel = Math.max(0, Number(level) || 0);
  return Math.round(1000 * Math.pow(1.5, normalizedLevel));
}

export function getArtifactUpgradeSuccessChance(level = 0) {
  const normalizedLevel = Math.max(0, Number(level) || 0);
  return Math.max(1, 100 - normalizedLevel * 10);
}

export function chooseRandomArtifactStat(rng = Math.random) {
  const roll = typeof rng === 'function' ? rng() : Math.random();
  const index = Math.max(0, Math.min(ARTIFACT_STAT_KEYS.length - 1, Math.floor(roll * ARTIFACT_STAT_KEYS.length)));
  return ARTIFACT_STAT_KEYS[index];
}

export function applyArtifactBonusesToUnit(unit, artifacts) {
  if (!unit || !Array.isArray(artifacts) || artifacts.length === 0) return;
  for (const artifact of artifacts) {
    const statKey = String(artifact?.stat_key || artifact?.statKey || '');
    if (!isValidArtifactStatKey(statKey)) continue;
    const bonus = getArtifactBonusValue(statKey, artifact?.level ?? 0);
    if (typeof unit[statKey] !== 'number') continue;
    unit[statKey] += bonus;
  }
}

export function formatArtifactModifierFr(statKey, level = 0) {
  const label = ARTIFACT_STAT_LABELS_FR[String(statKey)] || statKey;
  return `+${getArtifactBonusValue(statKey, level)} ${label}`;
}
