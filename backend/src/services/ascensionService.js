import { query, getPool } from '../config/db.js';

const REQUIRED_LEVEL = 50;
const ASCENSION_ESSENCE_COST = 1;
const VALID_SPEC = ['A', 'B'];

/**
 * Ascension : spécialisation définitive (spec A ou B).
 * Prérequis : level 50, specialization IS NULL, ascension_essence >= 1.
 * Après : specialization = specChoice, level = 1, xp = 0, ascension_count += 1.
 */
export async function ascendUnit(userId, userUnitId, specChoice) {
  const spec = String(specChoice).toUpperCase();
  if (!VALID_SPEC.includes(spec)) {
    return { success: false, error: 'INVALID_SPEC', message: 'specChoice doit être "A" ou "B".' };
  }

  const uuRows = await query(
    'SELECT id, user_id, unit_id, level, specialization, ascension_count FROM user_units WHERE id = ?',
    [userUnitId]
  );
  if (!uuRows.length) {
    return { success: false, error: 'USER_UNIT_NOT_FOUND' };
  }
  const uu = uuRows[0];
  if (Number(uu.user_id) !== Number(userId)) {
    return { success: false, error: 'FORBIDDEN', message: "L'unité ne vous appartient pas." };
  }
  if (Number(uu.level) !== REQUIRED_LEVEL) {
    return { success: false, error: 'LEVEL_REQUIRED', message: `Niveau 50 requis (actuel: ${uu.level}).` };
  }
  if (uu.specialization != null && String(uu.specialization).trim() !== '') {
    return { success: false, error: 'ALREADY_ASCENDED', message: 'Unité déjà spécialisée.' };
  }

  let walletRows = await query(
    'SELECT user_id, ascension_essence FROM user_wallet WHERE user_id = ?',
    [userId]
  );
  let wallet = walletRows[0];
  if (!wallet) {
    await query('INSERT INTO user_wallet (user_id, credits, cores, ascension_essence) VALUES (?, 0, 0, 0)', [userId]);
    wallet = { user_id: userId, ascension_essence: 0 };
  }
  const essence = Number(wallet.ascension_essence ?? 0);
  if (essence < ASCENSION_ESSENCE_COST) {
    return { success: false, error: 'INSUFFICIENT_ESSENCE', message: "Pas assez d'essence d'ascension (1 requis)." };
  }

  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      'UPDATE user_wallet SET ascension_essence = ascension_essence - ? WHERE user_id = ?',
      [ASCENSION_ESSENCE_COST, userId]
    );
    await conn.execute(
      'UPDATE user_units SET specialization = ?, level = 1, xp = 0, ascension_count = ascension_count + 1 WHERE id = ?',
      [spec, userUnitId]
    );
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }

  const updated = await query(
    'SELECT id, level, xp, specialization, ascension_count FROM user_units WHERE id = ?',
    [userUnitId]
  );

  return {
    success: true,
    userUnit: updated[0],
    message: `Spécialisation ${spec} appliquée. Niveau réinitialisé à 1.`
  };
}
