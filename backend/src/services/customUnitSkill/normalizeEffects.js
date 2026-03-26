/**
 * Homogénéise les effets (cibles, types) pour limiter les incohérences data-driven.
 * @param {object[]} effects
 * @returns {object[]}
 */
export function normalizeEffects(effects) {
  if (!Array.isArray(effects)) return [];
  return effects
    .filter((e) => e && typeof e === 'object')
    .map((e) => {
      const o = { ...e };
      if (o.type != null) o.type = String(o.type).toUpperCase();
      if (o.target != null) o.target = String(o.target).toUpperCase();
      if (o.buffType != null) o.buffType = String(o.buffType).toUpperCase();
      if (o.debuffType != null) o.debuffType = String(o.debuffType).toUpperCase();
      return o;
    });
}
