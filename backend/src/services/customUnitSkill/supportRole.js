import { active, passive } from './enginePrimitives.js';

function pick(keys, prefix) {
  return [...keys].find((k) => k.startsWith(prefix))?.replace(prefix, '') || null;
}

function fragSupS1(s1, stats, mult) {
  switch (s1) {
    case 'HEAL_AOE':
      return [{ type: 'HEAL', percentMaxHp: 0.11, target: 'TEAM_ALLY' }];
    case 'ATB_BOOST':
      return [
        { type: 'ATB_UP', percent: 0.14, target: 'ALLY_SINGLE' },
        { type: 'HEAL', percentMaxHp: 0.06, target: 'ALLY_SINGLE' }
      ];
    case 'CONTROL':
      return [
        { type: 'APPLY_DEBUFF', debuffType: 'STUN', remainingActions: 1, target: 'ENEMY_SINGLE', chance: 0.55 },
        { type: 'HEAL', percentMaxHp: 0.06, target: 'ALLY_SINGLE' }
      ];
    case 'HEAL_SINGLE':
    default:
      return [
        { type: 'HEAL', percentMaxHp: 0.2, target: 'ALLY_SINGLE' },
        { type: 'ATB_UP', percent: 0.08, target: 'ALLY_SINGLE' }
      ];
  }
}

function fragSupS2(s2, stats, mult) {
  switch (s2) {
    case 'CONTROL_BR':
      return [{ type: 'APPLY_DEBUFF', debuffType: 'SILENCE', remainingActions: 1, target: 'ENEMY_SINGLE', chance: 0.6 }];
    case 'BUFF':
      return [{ type: 'APPLY_BUFF', buffType: 'ATK_UP', remainingActions: 2, target: 'ALLY_SINGLE' }];
    case 'SUSTAIN':
    default:
      return [{ type: 'HEAL', percentMaxHp: 0.05, target: 'TEAM_ALLY' }];
  }
}

function fragSupS3(s3, s2branch) {
  if (s2branch === 'SUSTAIN') {
    if (s3 === 'STRONGER_AOE_HEAL') {
      return [{ type: 'HEAL', percentMaxHp: 0.04, target: 'TEAM_ALLY' }];
    }
    return [{ type: 'HEAL', percentMaxHp: 0.08, target: 'ALLY_SINGLE' }];
  }
  if (s2branch === 'CONTROL_BR') {
    if (s3 === 'MULTI_TARGET') {
      return [{ type: 'APPLY_DEBUFF', debuffType: 'SLOW', remainingActions: 2, target: 'TEAM_ENEMY', chance: 0.5 }];
    }
    return [{ type: 'APPLY_DEBUFF', debuffType: 'STUN', remainingActions: 1, target: 'ENEMY_SINGLE', chance: 0.72 }];
  }
  if (s2branch === 'BUFF') {
    if (s3 === 'BUFF_EXTRA_AREA') {
      return [{ type: 'APPLY_BUFF', buffType: 'DEF_UP', remainingActions: 2, target: 'TEAM_ALLY' }];
    }
    return [{ type: 'APPLY_BUFF', buffType: 'SPEED_UP', remainingActions: 2, target: 'ALLY_SINGLE' }];
  }
  return [];
}

function fragSupS4(s4, stats) {
  switch (s4) {
    case 'FULL_CLEANSE':
      return [{ type: 'CLEANSE', count: 4, target: 'ALLY_SINGLE' }];
    case 'ALLY_CD_MINUS_1':
      return [{ type: 'CD_DOWN', value: 1, target: 'ALLY_SINGLE' }];
    case 'AOE_IMMUNITY':
      return [{ type: 'APPLY_BUFF', buffType: 'IMMUNITY', remainingActions: 1, target: 'TEAM_ALLY' }];
    case 'DOUBLE_BUFF':
      return [
        { type: 'APPLY_BUFF', buffType: 'ATK_UP', remainingActions: 2, target: 'ALLY_SINGLE' },
        { type: 'APPLY_BUFF', buffType: 'DEF_UP', remainingActions: 2, target: 'ALLY_SINGLE' }
      ];
    default:
      return [];
  }
}

/**
 * @returns {{ skill: object, tags: string[] }}
 */
export function buildSupportSkill1(keys, stats, mult, _element) {
  const s1 = pick(keys, 'support_s1_s1_') || 'HEAL_SINGLE';
  const s2 = pick(keys, 'support_s1_s2_') || 'SUSTAIN';
  const s3 = pick(keys, 'support_s1_s3_') || 'STRONGER_SINGLE_HEAL';
  const s4 = pick(keys, 'support_s1_s4_') || 'FULL_CLEANSE';

  let cd = 3;
  if (s4 === 'AOE_IMMUNITY' || s4 === 'DOUBLE_BUFF') cd = 4;

  const s2branch = s2;
  const effects = [
    ...fragSupS1(s1, stats, mult),
    ...fragSupS2(s2, stats, mult),
    ...fragSupS3(s3, s2branch),
    ...fragSupS4(s4, stats)
  ];

  const tags = ['Support', 'Sustain'];
  if (s2 === 'CONTROL_BR' || s1 === 'CONTROL') tags.push('Control');
  if (s2 === 'BUFF' || s4 === 'DOUBLE_BUFF') tags.push('Buff');

  return { skill: active('Soutien tactique', cd, 1, effects), tags: [...new Set(tags)] };
}

/**
 * @returns {{ skill: object | null, tags: string[] }}
 */
export function buildSupportSkill2(keys, stats, mult, _element) {
  const tags = ['Support'];
  if (keys.has('support_s2_mode_active')) {
    if (keys.has('support_s2_act_HEAL')) {
      tags.push('Sustain');
      return {
        skill: active('Second souffle', 4, 2, [{ type: 'HEAL', percentMaxHp: 0.14, target: 'TEAM_ALLY' }]),
        tags
      };
    }
    if (keys.has('support_s2_act_BUFF')) {
      tags.push('Buff');
      return {
        skill: active('Inspiration', 4, 2, [
          { type: 'APPLY_BUFF', buffType: 'ATK_UP', remainingActions: 2, target: 'TEAM_ALLY' }
        ]),
        tags
      };
    }
    if (keys.has('support_s2_act_CLEANSE')) {
      return {
        skill: active('Purification', 4, 2, [{ type: 'CLEANSE', count: 3, target: 'ALLY_SINGLE' }]),
        tags
      };
    }
    if (keys.has('support_s2_act_SHIELD')) {
      tags.push('Protection');
      return {
        skill: active('Barrière', 4, 2, [
          { type: 'APPLY_BUFF', buffType: 'SHIELD', value: Math.round(stats.hp * 0.1), remainingActions: 2, target: 'ALLY_SINGLE' }
        ]),
        tags
      };
    }
  } else if (keys.has('support_s2_mode_passive')) {
    if (keys.has('support_s2_pas_SPEED_AURA')) {
      tags.push('Tempo');
      return {
        skill: passive(
          'ON_COMBAT_START',
          [{ type: 'APPLY_BUFF', buffType: 'SPEED_UP', remainingActions: 3, target: 'TEAM_ALLY' }],
          { name: 'Aura véloce', description: '', priority: 3 }
        ),
        tags
      };
    }
    if (keys.has('support_s2_pas_HEAL_AURA')) {
      tags.push('Sustain');
      return {
        skill: passive(
          'ON_COMBAT_START',
          [{ type: 'HEAL', percentMaxHp: 0.04, target: 'TEAM_ALLY' }],
          { name: 'Aura curative', description: '', priority: 3 }
        ),
        tags
      };
    }
    if (keys.has('support_s2_pas_DEBUFF_RESIST_AURA')) {
      return {
        skill: passive(
          'ON_COMBAT_START',
          [{ type: 'APPLY_BUFF', buffType: 'IMMUNITY', remainingActions: 1, target: 'TEAM_ALLY' }],
          { name: 'Voile', description: '', priority: 3 }
        ),
        tags
      };
    }
    if (keys.has('support_s2_pas_PASSIVE_ATB_GAIN')) {
      tags.push('Tempo');
      return {
        skill: passive('ON_HIT', [{ type: 'ATB_UP', percent: 0.05, target: 'SELF' }], {
          name: 'Rythme',
          description: '',
          priority: 3
        }),
        tags
      };
    }
  }
  return { skill: null, tags };
}
