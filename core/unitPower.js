export const MAX_POWER_LEVEL = 5;
export const MAX_POWER_OPENINGS = 15;

const OPENINGS_BY_LEVEL = Object.freeze({
  1: 1,
  2: 3,
  3: 6,
  4: 10,
  5: 15
});

export function normalizePowerOpenings(value) {
  const openings = Number(value);
  if (!Number.isFinite(openings) || openings < 1) return 1;
  return Math.floor(openings);
}

export function getPowerLevelFromOpenings(value) {
  const openings = normalizePowerOpenings(value);
  if (openings >= OPENINGS_BY_LEVEL[5]) return 5;
  if (openings >= OPENINGS_BY_LEVEL[4]) return 4;
  if (openings >= OPENINGS_BY_LEVEL[3]) return 3;
  if (openings >= OPENINGS_BY_LEVEL[2]) return 2;
  return 1;
}

export function getPowerStatMultiplier(value) {
  const level = Math.max(1, Math.min(MAX_POWER_LEVEL, Number(value) || 1));
  return 1 + (level - 1) * 0.05;
}

export function getPowerBonusPercent(value) {
  return Math.round((getPowerStatMultiplier(value) - 1) * 100);
}

export function getOpeningsRequiredForPowerLevel(level) {
  const normalizedLevel = Math.max(1, Math.min(MAX_POWER_LEVEL, Number(level) || 1));
  return OPENINGS_BY_LEVEL[normalizedLevel];
}

export function getPowerProgress(value) {
  const openings = normalizePowerOpenings(value);
  const powerLevel = getPowerLevelFromOpenings(openings);
  const currentThreshold = getOpeningsRequiredForPowerLevel(powerLevel);
  const nextLevel = powerLevel >= MAX_POWER_LEVEL ? null : powerLevel + 1;
  const nextThreshold = nextLevel ? getOpeningsRequiredForPowerLevel(nextLevel) : null;

  return {
    powerLevel,
    openings,
    isMax: powerLevel >= MAX_POWER_LEVEL,
    currentThreshold,
    nextLevel,
    nextThreshold,
    progressInCurrentTier: nextThreshold == null ? 0 : Math.max(0, openings - currentThreshold),
    requiredInCurrentTier: nextThreshold == null ? 0 : nextThreshold - currentThreshold
  };
}
