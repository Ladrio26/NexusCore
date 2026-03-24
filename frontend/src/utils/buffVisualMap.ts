/**
 * Mapping visuel des buffs/debuffs pour le combat viewer.
 * Chaque type → icône (emoji/caractère), couleur, et optionnellement une classe d'anneau.
 */
export type BuffVisual = {
  icon: string;
  color: string;
  ringClass?: string;
};

const MAP: Record<string, BuffVisual> = {
  // Buffs
  DMG: { icon: '⚔', color: '#ff4444' },
  HEAL: { icon: '💚', color: '#22c55e', ringClass: 'heal-flash' },
  ATK_UP: { icon: '⚔', color: '#ef4444' },
  DEF_UP: { icon: '🛡', color: '#eab308' },
  SPEED: { icon: '⚡', color: '#3b82f6' },
  SPEED_UP: { icon: '⚡', color: '#3b82f6' },
  CRIT_UP: { icon: '💥', color: '#f59e0b' },
  REGEN: { icon: '💚', color: '#22c55e', ringClass: 'regen-ring' },
  HEAL_OVER_TIME: { icon: '💚', color: '#22c55e' },
  SHIELD: { icon: '🛡', color: '#38bdf8', ringClass: 'shield-ring' },
  DEFEND: { icon: '🛡', color: '#64748b' },
  LIFESTEAL: { icon: '🩸', color: '#991b1b', ringClass: 'lifesteal-ring' },
  STAT_STEAL_BUFF: { icon: '🧲', color: '#14b8a6', ringClass: 'stat-steal-buff-ring' },
  IMMUNITY: { icon: '✨', color: '#f8fafc', ringClass: 'immunity-ring' },
  INVINCIBILITY: { icon: '○', color: '#fff', ringClass: 'invincible-ring' },
  COUNTER_ATTACK: { icon: '⚔⚔', color: '#f97316', ringClass: 'counter-ring' },
  COUNTER: { icon: '⚔⚔', color: '#f97316', ringClass: 'counter-ring' },
  ATB_UP: { icon: '↑', color: '#3b82f6' },
  RESURRECT: { icon: '✟', color: '#e2e8f0', ringClass: 'resurrect-light' },
  ATK_DOWN: { icon: '⚔', color: '#78716c' },
  DEF_DOWN: { icon: '🛡', color: '#78716c' },
  SLOW: { icon: '⏳', color: '#64748b' },
  SILENCE: { icon: '🔇', color: '#475569' },
  STUN: { icon: '★', color: '#eab308', ringClass: 'stun-ring' },
  BLIND: { icon: '☁', color: '#1e293b' },
  PROVOKE: { icon: '🎯', color: '#dc2626' },
  ANTI_HEAL: { icon: '💔', color: '#b91c1c' },
  ANTI_SHIELD: { icon: '🛡', color: '#7f1d1d' },
  ANTI_BUFF: { icon: '✕', color: '#991b1b' },
  DOT: { icon: '🔥', color: '#dc2626' },
  STAT_STEAL_DEBUFF: { icon: '🧲', color: '#0f766e', ringClass: 'stat-steal-debuff-ring' },
  CLEANSE: { icon: '✨', color: '#a78bfa' },
  STRIP: { icon: '⬇', color: '#f59e0b' },
  CD_UP: { icon: '⏱', color: '#b45309' },
  CD_DOWN: { icon: '⏩', color: '#0d9488' },
  REDUCE_ATB: { icon: '↓', color: '#ef4444' },
  ATB_DOWN: { icon: '↓', color: '#ef4444' },
  BUFF_APPLY: { icon: '↑', color: '#a78bfa' },
  DEBUFF_APPLY: { icon: '↓', color: '#94a3b8' }
};

function normalizeKey(type: string | undefined): string {
  if (!type) return '';
  return String(type).toUpperCase().replace(/\s/g, '_');
}

export function getBuffVisual(
  type: string | undefined,
  isDebuff: boolean
): BuffVisual {
  const key = normalizeKey(type);
  if (MAP[key]) return MAP[key];
  if (key.endsWith('_UP')) return { icon: '↑', color: '#22c55e' };
  if (key.endsWith('_DOWN')) return { icon: '↓', color: '#94a3b8' };
  return isDebuff
    ? { icon: '•', color: '#94a3b8' }
    : { icon: '•', color: '#38bdf8' };
}

export function getRingClassForType(type: string | undefined): string | null {
  const key = normalizeKey(type);
  const v = MAP[key];
  return v?.ringClass ?? null;
}
