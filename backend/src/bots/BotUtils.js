/**
 * BotUtils.js
 * Utilitaires purs partagés par tous les modules du système de bots.
 */

/**
 * Retourne ms ± (variance * ms) — aléatoire uniforme.
 * Permet de simuler un comportement non-mécanique.
 * @param {number} ms - durée de base en millisecondes
 * @param {number} [variance=0.25] - fraction de ms à ajouter/soustraire
 */
export function jitter(ms, variance = 0.25) {
  const delta = ms * variance;
  return Math.max(0, Math.round(ms + (Math.random() * 2 - 1) * delta));
}

/** Entier aléatoire dans [min, max] inclus. */
export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Choix aléatoire uniforme dans un tableau. */
export function randomChoice(arr) {
  if (!arr?.length) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Choix pondéré depuis un objet { clé: poids }.
 * Retourne la clé gagnante, ou null si l'objet est vide.
 */
export function weightedChoice(weightsObj) {
  const entries = Object.entries(weightsObj).filter(([, w]) => w > 0);
  if (!entries.length) return null;
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [key, w] of entries) {
    r -= w;
    if (r <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

/** Mélange un tableau en place (Fisher-Yates). */
export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Log structuré pour les bots (préfixé [BOT:<id>]). */
export function botLog(botUserId, action, data = {}) {
  console.log(`[BOT:${botUserId}] ${new Date().toISOString()} ${action}`, data);
}

/** Retourne une Date dans `ms` ms à partir de maintenant. */
export function msFromNow(ms) {
  return new Date(Date.now() + ms);
}

/** Parse une DATETIME MySQL comme UTC (évite les dérives de timezone). */
export function parseSqlDateUtc(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const s = String(value).trim();
  if (!s.includes('T')) return new Date(`${s.replace(' ', 'T')}Z`);
  if (!/[zZ]|[+\-]\d{2}:?\d{2}$/.test(s)) return new Date(`${s}Z`);
  return new Date(s);
}

/** Parse JSON sans lever d'exception. Retourne `fallback` en cas d'erreur. */
export function parseJsonSafe(v, fallback = null) {
  if (v == null) return fallback;
  if (typeof v === 'object') return v;
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
}

/** Formate une Date en DATETIME MySQL (UTC). */
export function toMysqlDatetime(date) {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}
