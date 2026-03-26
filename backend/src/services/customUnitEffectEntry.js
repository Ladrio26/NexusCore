/**
 * Normalisation des entrées d’effet : chaque effet a sa propre cible et ses modificateurs.
 * Rétrocompat : `effects: ['DAMAGE']` + `skill.target` / `skill.modifiers` sur le 1ᵉʳ effet.
 */

import { sanitizeModifiersForEffect } from '../data/customUnitTargetRules.js';

const TARGET_ALIASES = { TEAM: 'TEAM_ENEMY' };

function normalizeTargetString(t) {
  let u = String(t || '')
    .toUpperCase()
    .trim();
  if (TARGET_ALIASES[u]) u = TARGET_ALIASES[u];
  return u;
}

/**
 * @param {unknown} entry
 * @param {{ target?: string }} skillFallback — cible par défaut si absente sur l’entrée
 * @returns {{ id: string, target: string, modifiers: string[] } | null}
 */
export function normalizeEffectEntry(entry, skillFallback = {}) {
  const fallbackTarget = normalizeTargetString(skillFallback?.target || 'ENEMY_SINGLE');

  if (typeof entry === 'string') {
    const id = entry.trim().toUpperCase();
    return id ? { id, target: fallbackTarget, modifiers: [] } : null;
  }

  if (entry && typeof entry === 'object' && entry.id != null) {
    const id = String(entry.id).trim().toUpperCase();
    if (!id) return null;
    const tgt = normalizeTargetString(entry.target || fallbackTarget);
    const mods = Array.isArray(entry.modifiers)
      ? entry.modifiers
          .map((m) => String(m).toUpperCase().trim())
          .filter(Boolean)
          .filter((m) => m !== 'CD_MINUS_1')
      : [];
    return { id, target: tgt || fallbackTarget, modifiers: mods };
  }

  return null;
}

/**
 * @param {object} skill
 * @param {string} [defaultTarget='ENEMY_SINGLE']
 * @returns {{ id: string, target: string, modifiers: string[] }[]}
 */
export function normalizeSkillEffectEntries(skill, defaultTarget = 'ENEMY_SINGLE') {
  const fb = { ...skill, target: skill?.target || defaultTarget };
  const raw = Array.isArray(skill?.effects) ? skill.effects : [];
  const legacyMods = Array.isArray(skill?.modifiers) ? skill.modifiers.map((m) => String(m).toUpperCase()) : [];

  const out = [];
  for (let i = 0; i < raw.length; i++) {
    const n = normalizeEffectEntry(raw[i], fb);
    if (!n) continue;
    if (i === 0 && legacyMods.length && typeof raw[i] === 'string') {
      n.modifiers = [...new Set([...n.modifiers, ...legacyMods])];
    }
    n.modifiers = n.modifiers.filter((m) => m !== 'CD_MINUS_1');
    n.modifiers = sanitizeModifiersForEffect(n.id, n.modifiers, n.target);
    out.push(n);
  }
  return out;
}
