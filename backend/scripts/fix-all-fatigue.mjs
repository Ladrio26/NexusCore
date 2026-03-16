#!/usr/bin/env node
/**
 * Recalcule et persiste la fatigue de TOUTES les unités en base.
 * -1 fatigue par minute écoulée depuis fatigue_last_update.
 * Usage: node scripts/fix-all-fatigue.mjs
 */
import { query } from '../src/config/db.js';
import { computeCurrentFatigue } from '../src/utils/fatigueUtils.js';

async function main() {
  console.log('=== Fix fatigue : toutes les unités ===\n');

  const rows = await query(
    `SELECT id, fatigue, fatigue_last_update,
            UNIX_TIMESTAMP(fatigue_last_update) AS fatigue_last_update_ts
     FROM user_units`
  );

  console.log('Unités trouvées:', rows.length);

  let updated = 0;
  let initialized = 0;

  for (const r of rows) {
    const computed = computeCurrentFatigue({
      fatigue: r.fatigue ?? 0,
      fatigue_last_update: r.fatigue_last_update,
      fatigue_last_update_ts: r.fatigue_last_update_ts
    });

    if (r.fatigue_last_update == null) {
      await query('UPDATE user_units SET fatigue_last_update = NOW() WHERE id = ?', [r.id]);
      initialized++;
      if (initialized <= 5) console.log('  Init fatigue_last_update:', r.id);
    } else if (computed.minutesPassed > 0) {
      await query('UPDATE user_units SET fatigue = ?, fatigue_last_update = NOW() WHERE id = ?', [
        computed.fatigue,
        r.id
      ]);
      updated++;
      if (updated <= 5) {
        console.log('  Recalc:', r.id, 'fatigue', r.fatigue, '->', computed.fatigue, '( -' + computed.minutesPassed + ' min)');
      }
    }
  }

  console.log('\nRésultat:', updated, 'recalculées,', initialized, 'initialisées (fatigue_last_update était NULL)');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
