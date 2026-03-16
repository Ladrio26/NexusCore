#!/usr/bin/env node
/**
 * Script de debug pour investiguer la fatigue d'une unité spécifique.
 * Usage: node scripts/debug-fatigue.mjs
 */
import { query } from '../src/config/db.js';
import { computeCurrentFatigue } from '../src/utils/fatigueUtils.js';

async function main() {
  console.log('=== Debug fatigue : Melyre (Le Colosse Ardent), user Ladrio ===\n');

  // 1. Trouver user Ladrio
  const users = await query('SELECT id, display_name FROM users WHERE display_name LIKE ?', ['%Ladrio%']);
  if (!users.length) {
    console.log('User Ladrio non trouvé');
    process.exit(1);
  }
  const userId = users[0].id;
  console.log('User:', users[0].display_name, 'ID:', userId);

  // 2. Trouver unit Melyre / Colosse Ardent
  const units = await query(
    "SELECT id, name, code FROM units WHERE name LIKE '%Melyre%' OR name LIKE '%Colosse Ardent%'"
  );
  if (!units.length) {
    console.log('Unit Melyre non trouvé');
    process.exit(1);
  }
  const unitId = units[0].id;
  console.log('Unit:', units[0].name, 'ID:', unitId);

  // 3. Récupérer user_units avec toutes les colonnes pertinentes
  const rows = await query(
    `SELECT uu.id, uu.user_id, uu.unit_id, uu.fatigue, uu.fatigue_last_update,
            UNIX_TIMESTAMP(uu.fatigue_last_update) AS fatigue_last_update_ts,
            UNIX_TIMESTAMP() AS mysql_now_ts
     FROM user_units uu
     JOIN units u ON u.id = uu.unit_id
     WHERE uu.user_id = ? AND uu.unit_id = ?`,
    [userId, unitId]
  );

  if (!rows.length) {
    console.log('user_units non trouvé pour cette combinaison');
    process.exit(1);
  }

  const r = rows[0];
  console.log('\n--- Données brutes (user_units) ---');
  console.log('id:', r.id);
  console.log('fatigue:', r.fatigue, '(type:', typeof r.fatigue, ')');
  console.log('fatigue_last_update:', r.fatigue_last_update, '(type:', typeof r.fatigue_last_update, ')');
  console.log('fatigue_last_update_ts (UNIX_TIMESTAMP):', r.fatigue_last_update_ts, '(type:', typeof r.fatigue_last_update_ts, ')');
  console.log('mysql_now_ts (UNIX_TIMESTAMP()):', r.mysql_now_ts);

  // 4. Calcul côté Node
  const nowSeconds = Math.floor(Date.now() / 1000);
  console.log('\n--- Calcul Node.js ---');
  console.log('Date.now():', Date.now());
  console.log('nowSeconds (Node):', nowSeconds);

  if (r.fatigue_last_update_ts != null) {
    const diffSeconds = nowSeconds - Number(r.fatigue_last_update_ts);
    const minutesPassed = Math.floor(diffSeconds / 60);
    console.log('Différence (now - last_ts):', diffSeconds, 'secondes');
    console.log('minutesPassed:', minutesPassed);
  }

  // 5. Appel computeCurrentFatigue comme le fait le backend
  const computed = computeCurrentFatigue({
    fatigue: r.fatigue ?? 0,
    fatigue_last_update: r.fatigue_last_update,
    fatigue_last_update_ts: r.fatigue_last_update_ts
  });

  console.log('\n--- computeCurrentFatigue() ---');
  console.log('fatigue retournée:', computed.fatigue);
  console.log('minutesPassed:', computed.minutesPassed);

  if (computed.minutesPassed <= 0) {
    console.log('\n>>> PROBLÈME: minutesPassed <= 0, donc pas de décrément !');
    if (r.fatigue_last_update_ts == null) {
      console.log('>>> Cause: fatigue_last_update_ts est NULL - la colonne fatigue_last_update était vide');
    } else {
      const diff = nowSeconds - Number(r.fatigue_last_update_ts);
      console.log('>>> Cause: différence temps =', diff, 'secondes (< 60?)');
      console.log('>>> fatigue_last_update pourrait être dans le FUTUR (fuseau horaire?)');
    }
  } else {
    console.log('\n>>> OK: La fatigue devrait décroître de', computed.minutesPassed);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
