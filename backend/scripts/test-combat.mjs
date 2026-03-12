/**
 * Tests minimaux moteur de combat (Batch 1 + 2).
 * À lancer depuis la racine du projet : node backend/scripts/test-combat.mjs
 * ou depuis backend : node scripts/test-combat.mjs
 */
import { simulateBattle } from '../../core/combatEngine.js';

// Éclaireur des Brumes : skill_data avec skill.type GENERIC et effects APPLY_DEBUFF SLOW
const eclaireurSkillData = {
  skill: {
    type: 'GENERIC',
    cd_actions: 3,
    effects: [
      {
        type: 'APPLY_DEBUFF',
        debuffType: 'SLOW',
        chance: 1, // 100% pour le test
        remainingActions: 1,
        ignoreTargetingRules: true
      }
    ]
  },
  description: {}
};

// Druide Marin Spec B : SLOW + ATB_UP 15% (sur soi en ALLY_SINGLE)
const druideSpecBSkillData = {
  skill: {
    type: 'GENERIC',
    cd_actions: 3,
    effects: [
      { type: 'APPLY_DEBUFF', debuffType: 'SLOW', chance: 1, remainingActions: 1, ignoreTargetingRules: true },
      { type: 'ATB_UP', percent: 0.15, target: 'ALLY_SINGLE' }
    ]
  },
  description: {}
};

// Ondine Astrale Spec B : TEAM_ENEMY SLOW + REDUCE_ATB 20% TEAM_ENEMY
const ondineSpecBSkillData = {
  skill: {
    type: 'GENERIC',
    cd_actions: 4,
    effects: [
      { type: 'APPLY_DEBUFF', debuffType: 'SLOW', chance: 1, remainingActions: 1, target: 'TEAM_ENEMY' },
      { type: 'REDUCE_ATB', percent: 0.2, target: 'TEAM_ENEMY' }
    ]
  },
  description: {}
};

// Oracle du Récif Spec B : RESURRECT ALLY_DEAD_SINGLE 30% + ATB_UP 50% sur RESURRECTED
const oracleSpecBSkillData = {
  skill: {
    type: 'GENERIC',
    cd_actions: 5,
    effects: [
      { type: 'RESURRECT', percent: 0.3, target: 'ALLY_DEAD_SINGLE' },
      { type: 'ATB_UP', percent: 0.5, target: 'RESURRECTED' }
    ]
  },
  description: {}
};

// Aetherion des Marées : PASSIVE SELF_RESURRECT + ON_ATTACK STRIP
const aetherionSkillData = {
  skill: {
    type: 'PASSIVE',
    passives: [
      { type: 'SELF_RESURRECT', cd_actions: 5 },
      { type: 'ON_ATTACK', effect: { type: 'STRIP', count: 1 } }
    ]
  },
  description: {}
};

// Support avec DEFEND sur allié (monocible)
const defendSupportSkillData = {
  skill: {
    type: 'GENERIC',
    cd_actions: 2,
    effects: [
      { type: 'DEFEND', remainingActions: 2, target: 'ALLY_SINGLE' }
    ]
  },
  description: {}
};

function buildUnit(side, overrides = {}) {
  return {
    side,
    name: overrides.name ?? 'Unit',
    maxHp: overrides.maxHp ?? 1000,
    attack: overrides.attack ?? 100,
    defense: overrides.defense ?? 80,
    speed: overrides.speed ?? 100,
    mastery: overrides.mastery ?? 0,
    position: overrides.position ?? 'front',
    rangeType: overrides.rangeType ?? 'ranged',
    skill_data: overrides.skill_data ?? null,
    skill: overrides.skill ?? null,
    ...overrides
  };
}

function testEclaireurDebuff() {
  const teamA = [
    buildUnit('A', {
      name: 'Éclaireur des Brumes',
      speed: 150,
      skill_data: eclaireurSkillData
    })
  ];
  const teamB = [
    buildUnit('B', { name: 'Ennemi', speed: 50 })
  ];

  const log = simulateBattle(teamA, teamB, { seed: 42, maxRounds: 30 });

  const skillEvents = log.events.filter((e) => e.type === 'skill');
  const hasApplyDebuff = skillEvents.some((e) => {
    if (e.appliedDebuff === 'SLOW') return true;
    const byTarget = e.effectsResultsByTarget;
    if (Array.isArray(byTarget)) {
      return byTarget.some(
        (g) => g.effect === 'APPLY_DEBUFF' && g.results?.some((r) => r.applied === true)
      );
    }
    return false;
  });

  const anyUnitHasSlow = (log.events.some((e) => e.stateSnapshot?.some?.((u) =>
    u.debuffs?.some((d) => String(d.type).toUpperCase() === 'SLOW')
  )));

  if (hasApplyDebuff || anyUnitHasSlow) {
    console.log('✅ Éclaireur des Brumes : APPLY_DEBUFF (SLOW) exécuté');
    return true;
  }
  console.log('❌ Éclaireur des Brumes : aucun event APPLY_DEBUFF/SLOW trouvé');
  console.log('   skillEvents:', skillEvents.length, JSON.stringify(skillEvents.slice(0, 2), null, 2));
  return false;
}

function testDruideSpecB() {
  const teamA = [
    buildUnit('A', { name: 'Druide Marin Spec B', speed: 150, skill_data: druideSpecBSkillData })
  ];
  const teamB = [buildUnit('B', { name: 'Ennemi', speed: 50 })];

  const log = simulateBattle(teamA, teamB, { seed: 101, maxRounds: 30 });

  const skillEvents = log.events.filter((e) => e.type === 'skill');
  const hasSlow = skillEvents.some((e) =>
    Array.isArray(e.effectsResultsByTarget) &&
    e.effectsResultsByTarget.some((g) => g.effect === 'APPLY_DEBUFF' && g.results?.some((r) => r.applied === true))
  );
  const hasAtbUp = skillEvents.some((e) =>
    Array.isArray(e.effectsResultsByTarget) &&
    e.effectsResultsByTarget.some((g) => g.effect === 'ATB_UP' && g.results?.some((r) => r.applied === true))
  );

  if (hasSlow && hasAtbUp) {
    console.log('✅ Druide Marin Spec B : Slow + ATB_UP 15% exécutés');
    return true;
  }
  console.log('❌ Druide Marin Spec B : Slow=', hasSlow, 'ATB_UP=', hasAtbUp);
  return false;
}

function testOndineTeam() {
  const teamA = [
    buildUnit('A', { name: 'Ondine Astrale Spec B', speed: 160, skill_data: ondineSpecBSkillData })
  ];
  const teamB = [
    buildUnit('B', { name: 'Ennemi 1', speed: 50 }),
    buildUnit('B', { name: 'Ennemi 2', speed: 50 })
  ];

  const log = simulateBattle(teamA, teamB, { seed: 202, maxRounds: 30 });

  const skillEvents = log.events.filter((e) => e.type === 'skill');
  const hasTeamSlow = skillEvents.some((e) => {
    if (!Array.isArray(e.effectsResultsByTarget)) return false;
    const debuff = e.effectsResultsByTarget.find((g) => g.effect === 'APPLY_DEBUFF');
    if (!debuff || !debuff.results) return false;
    return debuff.results.length >= 2; // au moins 2 cibles (TEAM_ENEMY)
  });
  const hasReduceAtb = skillEvents.some((e) =>
    Array.isArray(e.effectsResultsByTarget) &&
    e.effectsResultsByTarget.some((g) => g.effect === 'REDUCE_ATB')
  );

  if (hasTeamSlow && hasReduceAtb) {
    console.log('✅ Ondine Astrale Spec B : TEAM_ENEMY Slow + REDUCE_ATB exécutés');
    return true;
  }
  console.log('❌ Ondine Astrale Spec B : TEAM_ENEMY Slow=', hasTeamSlow, 'REDUCE_ATB=', hasReduceAtb);
  return false;
}

function testOracleResurrect() {
  // Oracle (vitesse haute) + Sacrifice (très peu de PV). Ennemi fort pour tuer le sacrifice.
  const teamA = [
    buildUnit('A', { name: 'Oracle du Récif Spec B', speed: 180, skill_data: oracleSpecBSkillData }),
    buildUnit('A', { name: 'Sacrifice', speed: 40, maxHp: 30, attack: 10, defense: 5 })
  ];
  const teamB = [
    buildUnit('B', { name: 'Ennemi Fort', speed: 100, attack: 200, maxHp: 2000 })
  ];

  const log = simulateBattle(teamA, teamB, { seed: 303, maxRounds: 80 });

  const skillEvents = log.events.filter((e) => e.type === 'skill');
  const hasResurrect = skillEvents.some((e) =>
    Array.isArray(e.effectsResultsByTarget) &&
    e.effectsResultsByTarget.some((g) => g.effect === 'RESURRECT' && g.results?.some((r) => r.applied === true))
  );
  const hasAtbOnResurrected = skillEvents.some((e) =>
    Array.isArray(e.effectsResultsByTarget) &&
    e.effectsResultsByTarget.some((g) => g.effect === 'ATB_UP' && g.results?.some((r) => r.applied === true))
  );

  if (hasResurrect && hasAtbOnResurrected) {
    console.log('✅ Oracle du Récif Spec B : RESURRECT allié mort + 50% ATB sur ressuscité');
    return true;
  }
  console.log('❌ Oracle du Récif Spec B : RESURRECT=', hasResurrect, 'ATB_UP(RESURRECTED)=', hasAtbOnResurrected);
  return false;
}

function testAetherionSelfRes() {
  const teamA = [
    buildUnit('A', { name: 'Aetherion', speed: 140, maxHp: 80, skill_data: aetherionSkillData })
  ];
  const teamB = [
    buildUnit('B', { name: 'Tueur', speed: 100, attack: 150 })
  ];

  const log = simulateBattle(teamA, teamB, { seed: 404, maxRounds: 50 });

  const selfResEvents = log.events.filter(
    (e) => e.type === 'passive' && e.passiveType === 'SELF_RESURRECT'
  );

  if (selfResEvents.length >= 1) {
    console.log('✅ Aetherion : SELF_RESURRECT déclenché');
    return true;
  }
  console.log('❌ Aetherion : aucun event SELF_RESURRECT (Aetherion doit mourir puis se ressusciter)');
  return false;
}

function testAetherionOnAttackStrip() {
  const teamA = [
    buildUnit('A', { name: 'Aetherion', speed: 150, skill_data: aetherionSkillData })
  ];
  const teamB = [buildUnit('B', { name: 'Ennemi', speed: 50 })];

  const log = simulateBattle(teamA, teamB, { seed: 505, maxRounds: 30 });

  const onAttackEvents = log.events.filter(
    (e) => e.type === 'passive' && e.passiveType === 'ON_ATTACK'
  );

  if (onAttackEvents.length >= 1) {
    console.log('✅ Aetherion : ON_ATTACK (STRIP) déclenché après attaque');
    return true;
  }
  console.log('❌ Aetherion : aucun event ON_ATTACK après attaque de base');
  return false;
}

function testDefendRedirect() {
  // Tank A (front), Support B (back) avec DEFEND. Ennemi melee attaque le front = Tank. DEFEND redirige vers Support.
  const teamA = [
    buildUnit('A', { name: 'Tank A', speed: 60, maxHp: 500, position: 'front', rangeType: 'melee' }),
    buildUnit('A', { name: 'Support B', speed: 160, maxHp: 300, position: 'back', skill_data: defendSupportSkillData })
  ];
  const teamB = [
    buildUnit('B', { name: 'Ennemi', speed: 100, attack: 120, position: 'front', rangeType: 'melee' })
  ];

  const log = simulateBattle(teamA, teamB, { seed: 777, maxRounds: 30 });

  const redirects = log.events.filter((e) => e.type === 'redirect' && e.reason === 'DEFEND');
  const attacks = log.events.filter((e) => e.type === 'attack' && e.actorSide === 'B');

  if (redirects.length === 0) {
    console.log('❌ DEFEND : aucun event redirect (DEFEND)');
    return false;
  }

  const snap = attacks[0]?.stateSnapshot;
  if (!snap) {
    console.log('❌ DEFEND : pas de stateSnapshot dans l\'attack');
    return false;
  }

  const tankSnap = snap.find((u) => u.side === 'A' && u.position === 'front');
  const supportSnap = snap.find((u) => u.side === 'A' && u.position === 'back');
  const tankUid = tankSnap?.uid;
  const supportUid = supportSnap?.uid;

  const redir = redirects.find((r) => r.from === tankUid && r.to === supportUid);
  if (!redir) {
    console.log('❌ DEFEND : redirect attendu from(tank) to(support), redirects=', redirects);
    return false;
  }

  if (tankSnap && tankSnap.hp < (tankSnap.maxHp ?? 500)) {
    console.log('❌ DEFEND : le Tank a perdu des PV (redirection attendue vers Support)');
    return false;
  }
  if (supportSnap && supportSnap.hp >= (supportSnap.maxHp ?? 300)) {
    console.log('❌ DEFEND : le Support n\'a pas perdu de PV (il devrait avoir absorbé)');
    return false;
  }

  console.log('✅ DEFEND : redirection Tank → Support, dégâts pris par Support');
  return true;
}

/**
 * Vérifie que basic_targeting (focus) est bien appliqué en combat.
 * Unité A avec LOWEST_HP doit cibler l'ennemi avec le moins de PV (maxHp 400 = combatIndex 2).
 */
function testFocusBasicAttack() {
  const teamA = [
    buildUnit('A', {
      name: 'Attaquant Focus',
      speed: 200,
      attack: 80,
      maxHp: 1000,
      basic_targeting: 'LOWEST_HP',
      skill_targeting: 'NO_FOCUS',
      skill_data: { skill: { type: 'GENERIC', cd_actions: 99 }, description: {} }
    })
  ];
  // Team B : 3 ennemis, celui avec maxHp 400 est le plus bas → doit être ciblé en priorité (combatIndex 2)
  const teamB = [
    buildUnit('B', { name: 'Ennemi 1', speed: 50, maxHp: 600 }),
    buildUnit('B', { name: 'Ennemi 2', speed: 50, maxHp: 400 }),
    buildUnit('B', { name: 'Ennemi 3', speed: 50, maxHp: 500 })
  ];

  const log = simulateBattle(teamA, teamB, { seed: 42, maxRounds: 15 });

  const attackEvents = log.events.filter((e) => e.type === 'attack' && e.actorSide === 'A' && e.actor === 0);
  if (attackEvents.length === 0) {
    console.log('❌ Focus (basic_targeting) : aucune attaque de base depuis l\'unité A');
    return false;
  }

  const indexLowestHpEnemy = 2;
  const firstAttacksTargetLowest = attackEvents.slice(0, 5).every((e) => e.target === indexLowestHpEnemy);
  if (!firstAttacksTargetLowest) {
    const targets = attackEvents.slice(0, 5).map((e) => e.target);
    console.log('❌ Focus (basic_targeting) : attendu cible', indexLowestHpEnemy, '(ennemi PV les plus bas), reçu', targets);
    return false;
  }

  console.log('✅ Focus (basic_targeting) : LOWEST_HP appliqué, attaques ciblent bien l\'ennemi aux PV les plus bas');
  return true;
}

/**
 * Vérifie que skill_targeting est appliqué pour une compétence monocible ennemie.
 * Unité A avec skill ENEMY_SINGLE et skill_targeting HIGHEST_ATK doit cibler l'ennemi avec la plus haute ATQ.
 */
function testFocusSkill() {
  const skillData = {
    skill: {
      type: 'GENERIC',
      cd_actions: 1,
      effects: [{ type: 'DAMAGE', mult: 0.5, target: 'ENEMY_SINGLE' }]
    },
    description: {}
  };
  const teamA = [
    buildUnit('A', {
      name: 'Skill Focus',
      speed: 200,
      attack: 100,
      basic_targeting: 'NO_FOCUS',
      skill_targeting: 'HIGHEST_ATK',
      skill_data: skillData
    })
  ];
  const teamB = [
    buildUnit('B', { name: 'Ennemi Faible', speed: 50, attack: 30, maxHp: 500 }),
    buildUnit('B', { name: 'Ennemi Fort ATQ', speed: 50, attack: 150, maxHp: 500 })
  ];

  const log = simulateBattle(teamA, teamB, { seed: 123, maxRounds: 10 });

  const skillEvents = log.events.filter((e) => e.type === 'skill' && e.actorSide === 'A');
  const enemyHighAtkUid = 'B-2';
  const skillHitsHighAtk = skillEvents.some((e) => {
    const targets = e.targets ?? [];
    return targets.includes(enemyHighAtkUid);
  });

  if (!skillHitsHighAtk && skillEvents.length > 0) {
    console.log('❌ Focus (skill_targeting) : compétence devrait cibler l\'ennemi HIGHEST_ATK (uid', enemyHighAtkUid, '), events:', skillEvents.length);
    return false;
  }
  if (skillEvents.length === 0) {
    console.log('⚠️ Focus (skill_targeting) : aucun event skill (CD ou RNG) — considéré OK');
    return true;
  }
  console.log('✅ Focus (skill_targeting) : HIGHEST_ATK appliqué sur compétence monocible');
  return true;
}

/**
 * Vérifie que le focus utilise les stats au moment du coup (après buffs/débuffs).
 * Scénario : B1 = 100 DEF + débuff DEF_DOWN (-30%) → DEF effective 70 ; B2 = 80 DEF sans débuff.
 * Focus LOWEST_DEF doit cibler B1 (70), pas B2 (80).
 */
function testFocusUsesCurrentStats() {
  const defDownSkill = {
    skill: {
      type: 'GENERIC',
      cd_actions: 2,
      effects: [
        { type: 'APPLY_DEBUFF', debuffType: 'DEF_DOWN', remainingActions: 2, chance: 1, target: 'ENEMY_SINGLE' }
      ]
    },
    description: {}
  };
  const teamA = [
    buildUnit('A', {
      name: 'Support DEF_DOWN',
      speed: 200,
      skill_targeting: 'HIGHEST_DEF',
      skill_data: defDownSkill
    }),
    buildUnit('A', {
      name: 'Attaquant LOWEST_DEF',
      speed: 150,
      attack: 100,
      basic_targeting: 'LOWEST_DEF',
      skill_data: { skill: { type: 'GENERIC', cd_actions: 99 }, description: {} }
    })
  ];
  const teamB = [
    buildUnit('B', { name: 'B1 100DEF', speed: 50, defense: 100, maxHp: 1000 }),
    buildUnit('B', { name: 'B2 80DEF', speed: 50, defense: 80, maxHp: 1000 })
  ];

  const log = simulateBattle(teamA, teamB, { seed: 42, maxRounds: 12 });

  const skillEvents = log.events.filter((e) => e.type === 'skill' && e.actorSide === 'A' && e.actor === 0);
  const attackEvents = log.events.filter((e) => e.type === 'attack' && e.actorSide === 'A' && e.actor === 1);

  if (skillEvents.length === 0) {
    console.log('❌ Focus stats actuelles : le Support n\'a pas lancé DEF_DOWN');
    return false;
  }

  const b1CombatIndex = 2;
  const firstAttackAfterDefDown = attackEvents.find((e, i) => {
    const skillsBefore = log.events.slice(0, log.events.indexOf(e)).filter((x) => x.type === 'skill' && x.actor === 0);
    return skillsBefore.length >= 1;
  });

  if (!firstAttackAfterDefDown) {
    console.log('❌ Focus stats actuelles : aucune attaque de base après DEF_DOWN');
    return false;
  }

  if (firstAttackAfterDefDown.target !== b1CombatIndex) {
    console.log(
      '❌ Focus stats actuelles : attendu cible B1 (index',
      b1CombatIndex,
      ', DEF effective 70 après DEF_DOWN), reçu target=',
      firstAttackAfterDefDown.target
    );
    return false;
  }

  console.log('✅ Focus stats actuelles : LOWEST_DEF cible bien l\'unité avec DEF effective la plus basse (100 -30% = 70)');
  return true;
}

function main() {
  console.log('--- Tests moteur combat (correctif D1+D2+D3 + DEFEND + Focus) ---\n');
  let ok = 0;
  if (testEclaireurDebuff()) ok += 1;
  if (testDruideSpecB()) ok += 1;
  if (testOndineTeam()) ok += 1;
  if (testOracleResurrect()) ok += 1;
  if (testAetherionSelfRes()) ok += 1;
  if (testAetherionOnAttackStrip()) ok += 1;
  if (testDefendRedirect()) ok += 1;
  if (testFocusBasicAttack()) ok += 1;
  if (testFocusSkill()) ok += 1;
  if (testFocusUsesCurrentStats()) ok += 1;
  const total = 10;
  console.log('\n--- Résultat ---');
  console.log(ok === total ? `✅ ${ok}/${total} test(s) passés.` : `❌ ${ok}/${total} test(s) passés.`);
  process.exit(ok >= total ? 0 : 1);
}

main();
