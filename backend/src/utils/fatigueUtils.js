/**
 * Calcul de la fatigue actuelle à partir de la dernière mise à jour.
 * -1 fatigue par minute réelle écoulée depuis fatigue_last_update.
 * Utilise Unix timestamp pour éviter tout souci de fuseau horaire.
 *
 * @param {{ fatigue: number, fatigue_last_update?: Date|string|null, fatigue_last_update_ts?: number|null }} unit
 *   - fatigue_last_update_ts : préféré si fourni (Unix secondes, de UNIX_TIMESTAMP())
 *   - fatigue_last_update : fallback (Date ou string)
 * @param {{ fatigueRecoveryPerMinute?: number }} [options] — défaut 1 ; Centre de repos = 2 (×2 récupération).
 * @returns {{ fatigue: number, minutesPassed: number }}
 */
export function computeCurrentFatigue(unit, options = {}) {
  const perMinute = Math.max(0, Number(options.fatigueRecoveryPerMinute ?? 1)) || 1;
  const nowSeconds = Math.floor(Date.now() / 1000);
  let lastSeconds = null;

  if (unit.fatigue_last_update_ts != null && Number.isFinite(Number(unit.fatigue_last_update_ts))) {
    lastSeconds = Math.floor(Number(unit.fatigue_last_update_ts));
  } else if (unit.fatigue_last_update != null) {
    const d = new Date(unit.fatigue_last_update);
    if (!Number.isNaN(d.getTime())) lastSeconds = Math.floor(d.getTime() / 1000);
  }

  if (lastSeconds == null) {
    const fatigue = Math.max(0, Number(unit.fatigue) || 0);
    return { fatigue, minutesPassed: 0 };
  }

  const minutesPassed = Math.floor((nowSeconds - lastSeconds) / 60);

  if (minutesPassed <= 0) {
    const fatigue = Math.max(0, Number(unit.fatigue) || 0);
    return { fatigue, minutesPassed: 0 };
  }

  const previous = Math.max(0, Number(unit.fatigue) || 0);
  const decremented = minutesPassed * perMinute;
  const newFatigue = Math.max(0, previous - decremented);
  return { fatigue: newFatigue, minutesPassed };
}
