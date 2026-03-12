/**
 * Calcul de la fatigue actuelle à partir de la dernière mise à jour.
 * -1 fatigue par minute réelle écoulée depuis fatigue_last_update.
 * Pas de cron : toujours calculer à la volée.
 * Fuseau : fatigue_last_update (DATETIME en BDD) et new Date() utilisent le même "now"
 * (MySQL NOW() = session timezone ; s'assurer que le serveur a une timezone cohérente).
 *
 * @param {{ fatigue: number, fatigue_last_update?: Date|string|null }} unit - Unité avec fatigue et fatigue_last_update (DB ou déjà parsée)
 * @returns {{ fatigue: number, minutesPassed: number }}
 */
export function computeCurrentFatigue(unit) {
  const now = new Date();
  const raw = unit.fatigue_last_update;
  if (raw == null) {
    const fatigue = Math.max(0, Number(unit.fatigue) || 0);
    return { fatigue, minutesPassed: 0 };
  }
  const last = new Date(raw);
  const minutesPassed = Math.floor((now - last) / 60000);

  if (minutesPassed <= 0) {
    const fatigue = Math.max(0, Number(unit.fatigue) || 0);
    return { fatigue, minutesPassed: 0 };
  }

  const previous = Math.max(0, Number(unit.fatigue) || 0);
  const newFatigue = Math.max(0, previous - minutesPassed);
  return { fatigue: newFatigue, minutesPassed };
}
