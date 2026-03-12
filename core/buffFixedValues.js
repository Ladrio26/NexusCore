/**
 * Valeurs fixes par type de buff (équilibrage centralisé).
 * Partagé par le moteur de combat et le backend (validation / schema).
 * Pour les buffs listés, toute value envoyée est ignorée et remplacée par celle-ci.
 */
export const BUFF_FIXED_VALUES = {
  ATK_UP: 0.5,
  DEF_UP: 0.5,
  SPEED_UP: 0.3
};
