import { active, passive } from './enginePrimitives.js';

function pick(keys, prefix) {
  return [...keys].find((k) => k.startsWith(prefix))?.replace(prefix, '') || null;
}

function fragS1(s1, stats, mult) {
  switch (s1) {
    case 'PROVOKE':
      return [
        { type: 'APPLY_DEBUFF', debuffType: 'PROVOKE', remainingActions: 2, target: 'TEAM_ENEMY', chance: 0.92 },
        { type: 'APPLY_BUFF', buffType: 'SHIELD', value: Math.round(stats.hp * 0.08), remainingActions: 2, target: 'SELF' }
      ];
    case 'AOE_CONTROL':
      return [
        { type: 'DAMAGE', mult: mult * 0.62, target: 'TEAM_ENEMY' },
        { type: 'APPLY_DEBUFF', debuffType: 'SLOW', remainingActions: 2, target: 'TEAM_ENEMY', chance: 0.85 }
      ];
    case 'REGEN':
      return [{ type: 'APPLY_BUFF', buffType: 'REGEN', remainingActions: 3, target: 'SELF' }];
    case 'SHIELD':
    default:
      return [{ type: 'APPLY_BUFF', buffType: 'SHIELD', value: Math.round(stats.hp * 0.15), remainingActions: 2, target: 'SELF' }];
  }
}

function fragS2(s2, stats, mult) {
  switch (s2) {
    case 'CONTROL':
      return [
        { type: 'APPLY_DEBUFF', debuffType: 'PROVOKE', remainingActions: 2, target: 'TEAM_ENEMY', chance: 0.88 },
        { type: 'APPLY_DEBUFF', debuffType: 'SLOW', remainingActions: 1, target: 'TEAM_ENEMY', chance: 0.55 }
      ];
    case 'SUSTAIN':
      return [
        { type: 'HEAL', percentMaxHp: 0.07, target: 'SELF' },
        { type: 'APPLY_BUFF', buffType: 'REGEN', remainingActions: 2, target: 'SELF' }
      ];
    case 'PURE_TANK':
    default:
      return [
        { type: 'APPLY_BUFF', buffType: 'DEF_UP', remainingActions: 2, target: 'SELF' },
        { type: 'APPLY_BUFF', buffType: 'SHIELD', value: Math.round(stats.hp * 0.06), remainingActions: 2, target: 'SELF' }
      ];
  }
}

function fragS3(s3, stats, mult, s2branch) {
  if (s2branch === 'PURE_TANK') {
    if (s3 === 'BONUS_DEF') {
      return [{ type: 'APPLY_BUFF', buffType: 'DEF_UP', remainingActions: 3, target: 'SELF' }];
    }
    return [{ type: 'APPLY_BUFF', buffType: 'SHIELD', value: Math.round(stats.hp * 0.2), remainingActions: 2, target: 'SELF' }];
  }
  if (s2branch === 'CONTROL') {
    if (s3 === 'AOE_PROVOKE') {
      return [{ type: 'APPLY_DEBUFF', debuffType: 'PROVOKE', remainingActions: 2, target: 'TEAM_ENEMY', chance: 0.9 }];
    }
    if (s3 === 'AOE_SLOW') {
      return [{ type: 'APPLY_DEBUFF', debuffType: 'SLOW', remainingActions: 3, target: 'TEAM_ENEMY', chance: 0.82 }];
    }
    return [{ type: 'APPLY_DEBUFF', debuffType: 'SILENCE', remainingActions: 1, target: 'TEAM_ENEMY', chance: 0.65 }];
  }
  if (s2branch === 'SUSTAIN') {
    if (s3 === 'REGEN_PERCENT') {
      return [{ type: 'APPLY_BUFF', buffType: 'REGEN', remainingActions: 4, target: 'SELF' }];
    }
    if (s3 === 'HEAL_ON_HIT') {
      return [{ type: 'HEAL', percentMaxHp: 0.06, target: 'SELF' }];
    }
    return [{ type: 'HEAL', percentMaxHp: 0.12, target: 'ALLY_SINGLE' }];
  }
  return [];
}

function fragS4(s4, stats, mult) {
  switch (s4) {
    case 'MASSIVE_AOE_SHIELD':
      return [{ type: 'APPLY_BUFF', buffType: 'SHIELD', value: Math.round(stats.hp * 0.1), remainingActions: 2, target: 'TEAM_ALLY' }];
    case 'LIGHT_REVIVE':
      return [{ type: 'RESURRECT', percentHp: 0.28, target: 'ALLY_DEAD_SINGLE' }];
    case 'BIG_DAMAGE_REDUCTION_1T':
    default:
      return [
        { type: 'APPLY_BUFF', buffType: 'DEF_UP', remainingActions: 1, target: 'SELF' },
        { type: 'APPLY_BUFF', buffType: 'IMMUNITY', remainingActions: 1, target: 'SELF' }
      ];
  }
}

/**
 * @returns {{ skill: object, tags: string[] }}
 */
export function buildTankSkill1(keys, stats, mult, _element) {
  const s1 = pick(keys, 'tank_s1_s1_') || 'SHIELD';
  const s2 = pick(keys, 'tank_s1_s2_') || 'PURE_TANK';
  const s3 = pick(keys, 'tank_s1_s3_') || 'SHIELD_HP_SCALING';
  const s4 = pick(keys, 'tank_s1_s4_') || 'BIG_DAMAGE_REDUCTION_1T';

  let cd = 3;
  if (s4 === 'LIGHT_REVIVE') cd = 5;
  else if (s4 === 'MASSIVE_AOE_SHIELD') cd = 4;

  const effects = [
    ...fragS1(s1, stats, mult),
    ...fragS2(s2, stats, mult),
    ...fragS3(s3, stats, mult, s2),
    ...fragS4(s4, stats, mult)
  ];

  const tags = ['Tank', 'Control'];
  if (s2 === 'PURE_TANK' || s4 === 'MASSIVE_AOE_SHIELD') tags.push('Protection');
  if (s2 === 'SUSTAIN' || s1 === 'REGEN') tags.push('Sustain');

  return { skill: active('Garde du front', cd, 1, effects), tags: [...new Set(tags)] };
}

/**
 * @returns {{ skill: object | null, tags: string[] }}
 */
export function buildTankSkill2(keys, stats, mult, _element) {
  const tags = ['Tank'];
  if (keys.has('tank_s2_mode_active')) {
    if (keys.has('tank_s2_act_ALLY_SHIELD')) {
      tags.push('Protection');
      return {
        skill: active('Mur allié', 4, 2, [
          { type: 'APPLY_BUFF', buffType: 'SHIELD', value: Math.round(stats.hp * 0.12), remainingActions: 2, target: 'ALLY_SINGLE' }
        ]),
        tags
      };
    }
    if (keys.has('tank_s2_act_CLEANSE')) {
      tags.push('Support');
      return {
        skill: active('Purifier', 4, 2, [{ type: 'CLEANSE', count: 2, target: 'ALLY_SINGLE' }]),
        tags
      };
    }
    if (keys.has('tank_s2_act_AOE_HEAL')) {
      tags.push('Sustain');
      return {
        skill: active('Réconfort', 5, 2, [{ type: 'HEAL', percentMaxHp: 0.1, target: 'TEAM_ALLY' }]),
        tags
      };
    }
    if (keys.has('tank_s2_act_ANTI_BUFF')) {
      tags.push('Control');
      return {
        skill: active('Brise-fortune', 4, 2, [
          { type: 'APPLY_DEBUFF', debuffType: 'ANTI_BUFF', remainingActions: 2, target: 'ENEMY_SINGLE' }
        ]),
        tags
      };
    }
  } else if (keys.has('tank_s2_mode_passive')) {
    if (keys.has('tank_s2_pas_ATB_ON_ALLY_DEATH')) {
      tags.push('Tempo');
      return {
        skill: passive(
          'ON_ALLY_KO',
          [{ type: 'ATB_UP', percent: 0.15, target: 'SELF' }],
          { name: 'Deuil de fer', description: '', priority: 3 }
        ),
        tags
      };
    }
    return {
      skill: passive('ON_RECEIVE_DAMAGE', [{ type: 'ATB_UP', percent: 0.05, target: 'SELF' }], {
        name: 'Endurance',
        description: '',
        priority: 3
      }),
      tags
    };
  }
  return { skill: null, tags };
}
