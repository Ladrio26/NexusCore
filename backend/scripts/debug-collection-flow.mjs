#!/usr/bin/env node
/**
 * Simule exactement le flux handleCollection pour user Ladrio (id=3)
 * et vérifie si fatigue_last_update est bien dans le SELECT et utilisé.
 */
import { query } from '../src/config/db.js';
import { computeCurrentFatigue } from '../src/utils/fatigueUtils.js';

const BASE_SELECT_FULL = `SELECT uu.id AS user_unit_id,
              uu.level,
              uu.xp,
              uu.specialization,
              uu.power_level,
              uu.power_openings,
              uu.ascension_count,
              uu.fatigue,
              uu.injury_level,
              uu.is_injured,
              uu.basic_targeting,
              uu.skill_targeting,
              u.id AS unit_id,
              u.code,
              u.name,
              u.rarity,
              u.role,
              u.attack_type,
              u.element,
              u.archetype,
              u.base_hp,
              u.base_attack,
              u.base_defense,
              u.base_speed,
              u.mastery,
              u.image_url,
              u.traits,
              u.skill_data,
              u.synergy_tag,
              u.core_type,
              u.specA_bonus_stat,
              u.specB_bonus_stat
       FROM user_units uu
       JOIN units u ON u.id = uu.unit_id
       WHERE uu.user_id = ?`;

async function main() {
  const userId = 3; // Ladrio

  const selectWithFatigueUpdate = BASE_SELECT_FULL.replace(
    'uu.fatigue,\n              uu.injury_level',
    'uu.fatigue,\n              uu.fatigue_last_update,\n              UNIX_TIMESTAMP(uu.fatigue_last_update) AS fatigue_last_update_ts,\n              uu.injury_level'
  );

  const replaceHappened = selectWithFatigueUpdate !== BASE_SELECT_FULL;
  console.log('Replace a fonctionné:', replaceHappened);
  console.log('SELECT contient fatigue_last_update:', selectWithFatigueUpdate.includes('fatigue_last_update'));
  console.log('SELECT contient fatigue_last_update_ts:', selectWithFatigueUpdate.includes('fatigue_last_update_ts'));
  console.log('');

  const rows = await query(selectWithFatigueUpdate, [userId]);
  console.log('Nombre de lignes:', rows.length);

  const melyre = rows.find((r) => (r.name || '').includes('Melyre') || (r.name || '').includes('Colosse'));
  if (!melyre) {
    console.log('Melyre non trouvé dans les rows');
    process.exit(1);
  }

  console.log('\n--- Row Melyre (champs fatigue) ---');
  console.log('user_unit_id:', melyre.user_unit_id);
  console.log('name:', melyre.name);
  console.log('fatigue:', melyre.fatigue);
  console.log('fatigue_last_update:', melyre.fatigue_last_update);
  console.log('fatigue_last_update_ts:', melyre.fatigue_last_update_ts);
  console.log('fatigue_last_update_ts type:', typeof melyre.fatigue_last_update_ts);

  const computed = computeCurrentFatigue({
    fatigue: melyre.fatigue ?? 0,
    fatigue_last_update: melyre.fatigue_last_update,
    fatigue_last_update_ts: melyre.fatigue_last_update_ts
  });

  console.log('\n--- computeCurrentFatigue résultat ---');
  console.log('fatigue:', computed.fatigue);
  console.log('minutesPassed:', computed.minutesPassed);

  if (computed.minutesPassed > 0) {
    console.log('\n>>> Le UPDATE devrait s exécuter. Simulation...');
    await query('UPDATE user_units SET fatigue=?, fatigue_last_update=NOW() WHERE id=?', [
      computed.fatigue,
      melyre.user_unit_id
    ]);
    console.log('>>> UPDATE exécuté ! fatigue mise à', computed.fatigue);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
