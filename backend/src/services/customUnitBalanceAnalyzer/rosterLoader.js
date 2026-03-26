/**
 * Chargement lecture seule du catalogue unités (aucune modification).
 */
import { query } from '../../config/db.js';

/**
 * @param {{ excludeCustom?: boolean, excludeBoss?: boolean }} opts
 */
export async function loadRosterUnitsForBalance(opts = {}) {
  const excludeCustom = opts.excludeCustom !== false;
  const excludeBoss = opts.excludeBoss !== false;
  let sql = `SELECT id, code, name, rarity, role, attack_type, element, archetype,
      base_hp, base_attack, base_defense, base_speed, mastery, skill_data
    FROM units WHERE 1=1`;
  if (excludeBoss) sql += ' AND COALESCE(is_boss, 0) = 0';
  if (excludeCustom) sql += " AND code NOT LIKE 'CUSTOM_%'";
  sql += ' ORDER BY id';
  return query(sql);
}
