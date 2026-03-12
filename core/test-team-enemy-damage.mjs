/**
 * Vérifie qu'un skill DAMAGE avec cible TEAM_ENEMY applique bien des dégâts
 * à toute l'équipe ennemie (y compris back line pour un unité melee).
 * Exécuter : node core/test-team-enemy-damage.mjs (depuis nexuscore.goodloss.fr)
 */
import { simulateBattle } from './combatEngine.js';

const skillAoe = {
  id: 'aoe_skill',
  type: 'ACTIVE',
  cd_actions: 0,
  effects: [
    { type: 'DAMAGE', target: 'TEAM_ENEMY', mult: 1.5 }
  ]
};

const unitAttacker = {
  name: 'Attaquant AoE',
  base_hp: 2000,
  base_attack: 100,
  base_defense: 50,
  base_speed: 500,
  level: 1,
  mastery: 0,
  element: 'fire',
  archetype: 'CAC_TANK',
  position: 'front',
  attack_type: 'melee',
  rangeType: 'melee',
  skill_data: { skills: [skillAoe] }
};

const enemy1 = {
  name: 'Ennemi1',
  base_hp: 1000,
  base_attack: 10,
  base_defense: 50,
  base_speed: 1,
  level: 1,
  element: 'fire',
  position: 'front',
  skill_data: null
};
const enemy2 = {
  name: 'Ennemi2',
  base_hp: 1000,
  base_attack: 10,
  base_defense: 50,
  base_speed: 1,
  level: 1,
  element: 'water',
  position: 'front',
  skill_data: null
};
const enemy3 = {
  name: 'Ennemi3',
  base_hp: 1000,
  base_attack: 10,
  base_defense: 50,
  base_speed: 1,
  level: 1,
  element: 'plant',
  position: 'back',
  skill_data: null
};

const log = simulateBattle(
  [unitAttacker],
  [enemy1, enemy2, enemy3],
  { seed: 123, maxRounds: 2, maxActions: 5 }
);

const skillEvents = (log?.events || []).filter((e) => e.type === 'skill');
const firstSkill = skillEvents[0];
if (!firstSkill) {
  console.error('Aucun événement skill trouvé.');
  process.exit(1);
}

const targetsHit = firstSkill?.targets ?? [];
const uniqueTargets = [...new Set(targetsHit)];
const resultsByTarget = firstSkill?.effectsResultsByTarget || [];
const damageResults = resultsByTarget.flatMap((r) => r.results || []).filter((r) => r.effectiveDamage != null && r.effectiveDamage > 0);

console.log('Événement skill:', firstSkill?.targets?.length, 'cibles touchées');
console.log('Cibles uniques:', uniqueTargets.length);
console.log('Résultats de dégâts (effectiveDamage > 0):', damageResults.length);

const expectedEnemies = 3;
if (uniqueTargets.length >= expectedEnemies && damageResults.length >= expectedEnemies) {
  console.log('OK: Le skill TEAM_ENEMY a bien appliqué des dégâts à toute l\'équipe ennemie (' + expectedEnemies + ' cibles, dont back line).');
} else {
  console.error(
    'ÉCHEC: Attendu au moins',
    expectedEnemies,
    'cibles avec dégâts. Reçu:',
    uniqueTargets.length,
    'cibles uniques,',
    damageResults.length,
    'résultats de dégâts.'
  );
  process.exit(1);
}
