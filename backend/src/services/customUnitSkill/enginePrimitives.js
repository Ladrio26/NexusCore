import { normalizeEffects } from './normalizeEffects.js';

/**
 * Compétence active — format moteur : `cd_actions` + alias `cooldown` (non destructeur).
 */
export function active(name, cd, priority, effects) {
  const c = Math.max(1, Number(cd) || 1);
  return {
    type: 'ACTIVE',
    name,
    cd_actions: c,
    cooldown: c,
    priority,
    effects: normalizeEffects(effects),
    description: ''
  };
}

export function passive(trigger, effects, opts = {}) {
  return {
    type: 'PASSIVE',
    trigger,
    effects: normalizeEffects(effects),
    priority: opts.priority ?? 3,
    name: opts.name ?? 'Passif',
    description: opts.description ?? ''
  };
}
