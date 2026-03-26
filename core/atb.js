// Gestion de l'ATB type "Summoners-like", déterministe.
// La vitesse effective (avec SLOW / SPEED) est utilisée pour l'ordre de jeu.
//
// Règles :
// - Initialisation :
//     spd_eff_i = speed_i * speedMul (buffs/debuffs)
//     spd_max = max(spd_eff_i)
//     atb_i = 100 * spd_eff_i / spd_max
// - Boucle : idem avec spd_eff_i
// - Sélection acteur : parmi les unités « prêtes » (ATB ≥ 100 − ε), celle avec la **plus grande**
//   valeur d’ATB joue en premier ; après son action on retire 100 (overflow conservé).
// - La jauge **logique** peut dépasser 100 (boosts, synergie) ; l’UI peut plafonner l’affichage à 100 %.
//
// Tolérance flottante : une jauge peut rester à 99.999… alors que l’UI affiche 100 %.

import { getEffectiveCombatStats } from './effects.js';

/** Seuil « prêt à l’action » (évite les bugs 99.99999999999999 < 100). */
export const ATB_READY_EPS = 1e-6;

function getEffectiveSpeed(unit) {
  return getEffectiveCombatStats(unit).speed;
}

export function isAtbReady(unit) {
  const a = Number(unit?.atb);
  return Number.isFinite(a) && a >= 100 - ATB_READY_EPS;
}

export function isAtbWaiting(unit) {
  const a = Number(unit?.atb);
  return Number.isFinite(a) && a < 100 - ATB_READY_EPS;
}

/**
 * Consomme 100 points de jauge après une action (overflow conservé : 180 → 80).
 * Si « prête » par epsilon mais a &lt; 100 (flottants), on traite comme 100 avant −100.
 */
export function consumeAtbAfterAction(actor) {
  if (!actor) return 0;
  let a = Number(actor.atb);
  if (!Number.isFinite(a)) {
    actor.atb = 0;
    return 0;
  }
  if (!isAtbReady(actor)) {
    actor.atb = Math.max(0, a);
    return a;
  }
  if (a < 100) a = 100;
  actor.atb = Math.max(0, a - 100);
  return actor.atb;
}

export function initializeAtb(units) {
  const alive = units.filter((u) => u.alive === true);
  const maxSpeed = alive.reduce((max, u) => {
    const spd = getEffectiveSpeed(u);
    return spd > max ? spd : max;
  }, 1);
  for (const u of units) {
    if (u.alive !== true) {
      u.atb = 0;
      continue;
    }
    const spd = getEffectiveSpeed(u);
    u.atb = (100 * spd) / maxSpeed;
  }
}

export function advanceAtb(units) {
  const alive = units.filter((u) => u.alive === true);
  const waiting = alive.filter((u) => isAtbWaiting(u));

  if (waiting.length === 0) {
    return;
  }

  let t = Infinity;
  for (const u of waiting) {
    const spd = getEffectiveSpeed(u);
    const remaining = 100 - u.atb;
    const ti = remaining / spd;
    if (ti < t) t = ti;
  }

  if (!Number.isFinite(t) || t <= 0) {
    return;
  }

  for (const u of units) {
    if (u.alive !== true) continue;
    const spd = getEffectiveSpeed(u);
    u.atb += spd * t;
  }
}

export function pickNextActor(units) {
  const alive = units.filter((u) => u.alive === true && isAtbReady(u));
  if (!alive.length) return null;

  alive.sort((a, b) => {
    const atbA = Number(a.atb) || 0;
    const atbB = Number(b.atb) || 0;
    if (atbB !== atbA) return atbB - atbA;
    const spdA = getEffectiveSpeed(a);
    const spdB = getEffectiveSpeed(b);
    if (spdB !== spdA) return spdB - spdA;
    return a.orderIndex - b.orderIndex;
  });

  return alive[0];
}

