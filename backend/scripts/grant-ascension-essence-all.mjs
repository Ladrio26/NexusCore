/**
 * Crédite +N essence d'ascension à tous les utilisateurs ayant un portefeuille,
 * et crée un portefeuille avec N essences pour les comptes sans ligne user_wallet.
 *
 * Usage : node backend/scripts/grant-ascension-essence-all.mjs [montant]
 * Défaut montant = 10
 */
import { query, getPool } from '../src/config/db.js';

const amount = Math.max(0, Math.floor(Number(process.argv[2] ?? 10)));

async function main() {
  if (!Number.isFinite(amount)) {
    console.error('Montant invalide.');
    process.exit(1);
  }
  console.log(`Attribution de ${amount} essence(s) d'ascension à tous les utilisateurs…`);

  const upd = await query(
    'UPDATE user_wallet SET ascension_essence = ascension_essence + ?',
    [amount]
  );
  const updatedRows = upd?.affectedRows ?? 0;

  const ins = await query(
    `INSERT INTO user_wallet (user_id, credits, cores, fragments, ascension_essence, gold, divine_cores, divine_credits, divine_fragments)
     SELECT u.id, 0, 0, 0, ?, 0, 0, 0, 0
     FROM users u
     LEFT JOIN user_wallet w ON w.user_id = u.id
     WHERE w.user_id IS NULL`,
    [amount]
  );
  const insertedRows = ins?.affectedRows ?? 0;

  console.log(`OK — portefeuilles mis à jour : ${updatedRows}, portefeuilles créés : ${insertedRows}`);

  const pool = getPool();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
