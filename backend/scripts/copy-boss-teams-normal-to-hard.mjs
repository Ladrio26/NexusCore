/**
 * Duplique toutes les équipes boss mode Normal vers Hard (même composition, ordre, fixed_chapter).
 * Remplace les équipes Hard existantes : supprime les affectations boss Hard puis les anciennes équipes Hard.
 *
 * Usage : node backend/scripts/copy-boss-teams-normal-to-hard.mjs
 */
import { getPool } from '../src/config/db.js';

async function main() {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [normRows] = await conn.execute(
      `SELECT COUNT(*) AS n FROM campaign_boss_teams WHERE mode = 'normal'`
    );
    const n = Number(normRows[0]?.n ?? 0);
    if (n === 0) {
      console.error('Aucune équipe boss en mode normal.');
      process.exitCode = 1;
      await conn.rollback();
      return;
    }

    await conn.execute(`DELETE FROM campaign_boss_assignments WHERE mode = 'hard'`);
    await conn.execute(`DELETE FROM campaign_boss_teams WHERE mode = 'hard'`);

    const [result] = await conn.execute(
      `INSERT INTO campaign_boss_teams (mode, name, sort_order, active, notes, composition, fixed_chapter)
       SELECT 'hard', name, sort_order, active, notes, composition, fixed_chapter
       FROM campaign_boss_teams WHERE mode = 'normal'
       ORDER BY sort_order ASC, id ASC`
    );

    await conn.commit();
    console.log(`OK : ${result.affectedRows} équipe(s) boss copiée(s) Normal → Hard (anciennes Hard supprimées).`);
    console.log('Pense à régénérer la campagne du mois (admin) si tu veux recalculer les affectations Hard.');
  } catch (e) {
    await conn.rollback();
    console.error(e);
    process.exitCode = 1;
  } finally {
    conn.release();
    await pool.end();
  }
}

main();
