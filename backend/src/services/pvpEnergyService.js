/**
 * Compteur PvP (0–10) : se réinitialise à 10 à chaque changement d’heure UTC (pile).
 * Un combat consomme 1 point au lancement (start-battle).
 */
import { query } from '../config/db.js';

export const PVP_ENERGY_MAX = 10;

/** Clé d’heure UTC « YYYY-MM-DDTHH » pour détecter le reset pile. */
export function getCurrentUtcHourKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}T${String(d.getUTCHours()).padStart(2, '0')}`;
}

/**
 * Si l’heure UTC a changé depuis le dernier enregistrement, repasse l’énergie à 10.
 * Retourne la valeur courante 0..10 (affichage / GET /pvp/me).
 */
export async function syncPvpEnergyForDisplay(userId) {
  const hourKey = getCurrentUtcHourKey();
  await query(
    `UPDATE users SET pvp_energy = ?, pvp_energy_hour_key = ? WHERE id = ? AND (pvp_energy_hour_key IS NULL OR pvp_energy_hour_key != ?)`,
    [PVP_ENERGY_MAX, hourKey, userId, hourKey]
  );
  const rows = await query('SELECT pvp_energy FROM users WHERE id = ?', [userId]);
  return Math.min(PVP_ENERGY_MAX, Math.max(0, Number(rows[0]?.pvp_energy ?? PVP_ENERGY_MAX)));
}

/**
 * En transaction : reset d’heure si besoin, puis −1 si énergie > 0.
 * @throws {Error} err.code === 'PVP_NO_ENERGY'
 */
export async function assertPvpEnergyAndConsumeTx(userId, tx) {
  const hourKey = getCurrentUtcHourKey();
  const rows = await tx.query(
    'SELECT pvp_energy, pvp_energy_hour_key FROM users WHERE id = ? FOR UPDATE',
    [userId]
  );
  const r = rows[0];
  let energy = Number(r?.pvp_energy ?? PVP_ENERGY_MAX);
  const stored = r?.pvp_energy_hour_key ?? null;
  if (stored !== hourKey) {
    energy = PVP_ENERGY_MAX;
    await tx.query('UPDATE users SET pvp_energy = ?, pvp_energy_hour_key = ? WHERE id = ?', [
      PVP_ENERGY_MAX,
      hourKey,
      userId
    ]);
  }
  if (energy <= 0) {
    const err = new Error(
      "Plus de combats PvP disponibles. Le compteur se réinitialise à chaque heure pile (UTC)."
    );
    err.code = 'PVP_NO_ENERGY';
    throw err;
  }
  await tx.query('UPDATE users SET pvp_energy = ? WHERE id = ?', [energy - 1, userId]);
}
