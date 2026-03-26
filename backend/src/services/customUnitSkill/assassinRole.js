import { active, passive } from './enginePrimitives.js';

function pick(keys, prefix) {
  return [...keys].find((k) => k.startsWith(prefix))?.replace(prefix, '') || null;
}

/**
 * @returns {{ skill: object, tags: string[] }}
 */
export function buildAssassinSkill1(keys, stats, mult, _element) {
  const s1 = pick(keys, 'assassin_s1_s1_') || 'MONO_BURST';
  const s2 = pick(keys, 'assassin_s1_s2_') || 'BURST';
  const s3 = pick(keys, 'assassin_s1_s3_') || 'EXTREME_DAMAGE';
  const s4 = pick(keys, 'assassin_s1_s4_') || 'BONUS_ATB';

  let dmgMult = mult * 1.35;
  if (s1 === 'HIT_PLUS_TANK') dmgMult *= 1.08;
  if (s1 === 'HIT_PLUS_SPEED') dmgMult *= 1.06;

  const effects = [{ type: 'DAMAGE', mult: dmgMult, target: 'ENEMY_SINGLE' }];

  if (s2 === 'BURST') {
    if (s3 === 'EXTREME_DAMAGE') effects[0].mult = dmgMult * 1.12;
    else if (s3 === 'REDUCE_DEF') {
      effects.push({
        type: 'APPLY_DEBUFF',
        debuffType: 'DEF_DOWN',
        remainingActions: 2,
        target: 'ENEMY_SINGLE',
        chance: 0.88
      });
    } else if (s3 === 'LIGHT_SPLASH_DAMAGE') {
      effects.push({ type: 'DAMAGE', mult: mult * 0.35, target: 'TEAM_ENEMY' });
    }
  } else if (s2 === 'CONTROL') {
    if (s3 === 'SILENCE') {
      effects.push({
        type: 'APPLY_DEBUFF',
        debuffType: 'SILENCE',
        remainingActions: 1,
        target: 'ENEMY_SINGLE',
        chance: 0.75
      });
    } else if (s3 === 'STUN') {
      effects.push({
        type: 'APPLY_DEBUFF',
        debuffType: 'STUN',
        remainingActions: 1,
        target: 'ENEMY_SINGLE',
        chance: 0.45
      });
    } else {
      effects.push({
        type: 'APPLY_DEBUFF',
        debuffType: 'ANTI_BUFF',
        remainingActions: 2,
        target: 'ENEMY_SINGLE',
        chance: 0.7
      });
    }
  } else if (s2 === 'SURVIVE') {
    if (s3 === 'SELF_HEAL') {
      effects.push({ type: 'HEAL', percentMaxHp: 0.1, target: 'SELF' });
    } else if (s3 === 'SELF_SHIELD') {
      effects.push({
        type: 'APPLY_BUFF',
        buffType: 'SHIELD',
        value: Math.round(stats.hp * 0.12),
        remainingActions: 2,
        target: 'SELF'
      });
    } else {
      effects.push({ type: 'APPLY_BUFF', buffType: 'DEF_UP', remainingActions: 2, target: 'SELF' });
    }
  }

  if (s4 === 'RESET_CD_ON_KILL') {
    effects.push({ type: 'ATB_UP', percent: 0.12, target: 'SELF' });
  } else if (s4 === 'BIG_ATB_GAIN') {
    effects.push({ type: 'ATB_UP', percent: 0.22, target: 'SELF' });
  } else if (s4 === 'BONUS_ATB') {
    effects.push({ type: 'ATB_UP', percent: 0.1, target: 'SELF' });
  }

  let cd = 3;
  if (s2 === 'CONTROL' && s3 === 'STUN') cd = 4;

  const tags = ['Burst', 'Assassin'];
  if (s2 === 'CONTROL') tags.push('Control');
  if (s2 === 'SURVIVE') tags.push('Sustain');

  return { skill: active('Entaille', cd, 1, effects), tags: [...new Set(tags)] };
}

/**
 * @returns {{ skill: object | null, tags: string[] }}
 */
export function buildAssassinSkill2(keys, stats, mult, _element) {
  const tags = ['Burst'];
  if (keys.has('assassin_s2_mode_active')) {
    if (keys.has('assassin_s2_act_DAMAGE')) {
      return {
        skill: active('Couperet', 4, 2, [{ type: 'DAMAGE', mult: mult * 1.55, target: 'ENEMY_SINGLE' }]),
        tags
      };
    }
    if (keys.has('assassin_s2_act_TANK')) {
      tags.push('Control');
      return {
        skill: active('Couperet', 4, 2, [
          { type: 'DAMAGE', mult: mult * 1.15, target: 'ENEMY_SINGLE' },
          { type: 'APPLY_DEBUFF', debuffType: 'DEF_DOWN', remainingActions: 2, target: 'ENEMY_SINGLE', chance: 0.9 }
        ]),
        tags
      };
    }
    if (keys.has('assassin_s2_act_SILENCE')) {
      tags.push('Control');
      return {
        skill: active('Couperet', 4, 2, [
          { type: 'DAMAGE', mult: mult * 1.05, target: 'ENEMY_SINGLE' },
          { type: 'APPLY_DEBUFF', debuffType: 'SILENCE', remainingActions: 1, target: 'ENEMY_SINGLE' }
        ]),
        tags
      };
    }
    return {
      skill: active('Couperet', 4, 2, [
        { type: 'DAMAGE', mult: mult * 1.1, target: 'ENEMY_SINGLE' },
        { type: 'APPLY_DEBUFF', debuffType: 'ANTI_HEAL', remainingActions: 2, target: 'ENEMY_SINGLE' }
      ]),
      tags
    };
  }
  if (keys.has('assassin_s2_mode_passive')) {
    if (keys.has('assassin_s2_pas_BONUS_ATB')) {
      tags.push('Tempo');
      return {
        skill: passive('ON_HIT', [{ type: 'ATB_UP', percent: 0.06, target: 'SELF' }], {
          name: 'Rythme',
          description: '',
          priority: 3
        }),
        tags
      };
    }
    if (keys.has('assassin_s2_pas_CD_REDUCTION')) {
      tags.push('Tempo');
      return {
        skill: passive('ON_HIT', [{ type: 'ATB_UP', percent: 0.04, target: 'SELF' }], {
          name: 'Fluidité',
          description: '',
          priority: 3
        }),
        tags
      };
    }
    return {
      skill: passive(
        'ON_ATTACK',
        [{ type: 'APPLY_BUFF', buffType: 'SPEED_UP', remainingActions: 1, target: 'SELF' }],
        { name: 'Furtivité', description: '', priority: 3 }
      ),
      tags
    };
  }
  return { skill: null, tags };
}
