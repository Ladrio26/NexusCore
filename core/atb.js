// Gestion de l'ATB type "Summoners-like", déterministe.
// La vitesse effective (avec SLOW / SPEED) est utilisée pour l'ordre de jeu.
//
// Règles :
// - Initialisation :
//     spd_eff_i = speed_i * speedMul (buffs/debuffs)
//     spd_max = max(spd_eff_i)
//     atb_i = 100 * spd_eff_i / spd_max
// - Boucle : idem avec spd_eff_i
// - Sélection acteur : overflow, puis vitesse effective, puis orderIndex

import { getEffectiveCombatStats } from './effects.js';

function getEffectiveSpeed(unit) {
  return getEffectiveCombatStats(unit).speed;
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
  const waiting = alive.filter((u) => u.atb < 100);

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
  const alive = units.filter((u) => u.alive === true && u.atb >= 100);
  if (!alive.length) return null;

  alive.sort((a, b) => {
    const overflowA = a.atb - 100;
    const overflowB = b.atb - 100;
    if (overflowB !== overflowA) return overflowB - overflowA;
    const spdA = getEffectiveSpeed(a);
    const spdB = getEffectiveSpeed(b);
    if (spdB !== spdA) return spdB - spdA;
    return a.orderIndex - b.orderIndex;
  });

  return alive[0];
}

