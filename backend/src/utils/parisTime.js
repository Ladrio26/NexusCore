/**
 * Utilitaires pour le fuseau horaire Europe/Paris.
 * Utilisé pour les guerres de guilde (00:00 et 12:00 Paris).
 */
export const PARIS_TIME_ZONE = 'Europe/Paris';

const parisDateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: PARIS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

const parisHourFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: PARIS_TIME_ZONE,
  hour: '2-digit',
  hour12: false
});

const parisMinuteFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: PARIS_TIME_ZONE,
  minute: '2-digit'
});

/** Heure actuelle à Paris (0-23). */
export function getParisHour(date = new Date()) {
  return parseInt(parisHourFmt.format(date), 10);
}

/** Minute actuelle à Paris (0-59). */
export function getParisMinute(date = new Date()) {
  return parseInt(parisMinuteFmt.format(date), 10);
}

/** Clé date Paris YYYY-MM-DD. */
export function getParisDateKey(date = new Date()) {
  const parts = parisDateFmt.formatToParts(date);
  const vals = Object.fromEntries(parts.filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]));
  return `${vals.year}-${vals.month}-${vals.day}`;
}

/** Retourne le Date (UTC) correspondant à minuit Paris pour la date Paris donnée. */
export function getParisMidnightDate(date = new Date()) {
  const parts = parisDateFmt.formatToParts(date);
  const vals = Object.fromEntries(parts.filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]));
  const year = parseInt(vals.year, 10);
  const month = parseInt(vals.month, 10) - 1;
  const day = parseInt(vals.day, 10);

  // Paris midnight ≈ UTC midnight - 1h (winter) ou -2h (summer)
  const utcMidnight = Date.UTC(year, month, day, 0, 0, 0);
  for (const offsetHours of [1, 2]) {
    const candidate = new Date(utcMidnight - offsetHours * 60 * 60 * 1000);
    const h = getParisHour(candidate);
    const k = getParisDateKey(candidate);
    if (h === 0 && k === `${vals.year}-${vals.month}-${vals.day}`) {
      return candidate;
    }
  }
  return new Date(utcMidnight - 60 * 60 * 1000);
}

/** Retourne le Date (UTC) correspondant à midi Paris pour la date Paris donnée. */
export function getParisNoonDate(date = new Date()) {
  const parts = parisDateFmt.formatToParts(date);
  const vals = Object.fromEntries(parts.filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]));
  const year = parseInt(vals.year, 10);
  const month = parseInt(vals.month, 10) - 1;
  const day = parseInt(vals.day, 10);

  const utcNoon = Date.UTC(year, month, day, 12, 0, 0);
  for (const offsetHours of [1, 2]) {
    const candidate = new Date(utcNoon - offsetHours * 60 * 60 * 1000);
    const h = getParisHour(candidate);
    const k = getParisDateKey(candidate);
    if (h === 12 && k === `${vals.year}-${vals.month}-${vals.day}`) {
      return candidate;
    }
  }
  return new Date(utcNoon - 60 * 60 * 1000);
}

/** Prochain minuit Paris (pour schedule). */
export function getNextParisMidnight(date = new Date()) {
  const todayMidnight = getParisMidnightDate(date);
  if (date < todayMidnight) return todayMidnight;
  const tomorrow = new Date(date.getTime() + 24 * 60 * 60 * 1000);
  return getParisMidnightDate(tomorrow);
}

/** Prochain midi Paris. */
export function getNextParisNoon(date = new Date()) {
  const todayNoon = getParisNoonDate(date);
  if (date < todayNoon) return todayNoon;
  const tomorrow = new Date(date.getTime() + 24 * 60 * 60 * 1000);
  return getParisNoonDate(tomorrow);
}
