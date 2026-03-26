import { active, passive } from './enginePrimitives.js';

function pick(keys, prefix) {
  return [...keys].find((k) => k.startsWith(prefix))?.replace(prefix, '') || null;
}

/**
 * @param {Set<string>} keys
 * @param {object} stats
 * @param {number} mult
 * @param {string} _element
 * @returns {{ skill: object, tags: string[] }}
 */
export function buildDpsSkill1(keys, stats, mult, _element) {
  const s1Type = pick(keys, 'dps_s1_s1_') || 'SINGLE_TARGET_CD2';
  const s1Mod = pick(keys, 'dps_s1_s2_') || 'BURST';
  const s1Spec = pick(keys, 'dps_s1_s3_') || 'MORE_DAMAGE';

  let cd1 = 2;
  let isAoe = false;
  if (s1Type === 'SINGLE_TARGET_HP_PERCENT_CD3') {
    cd1 = 3;
  } else if (s1Type === 'AOE_CD3' || s1Type === 'DOT_CD3') {
    cd1 = 3;
    isAoe = true;
  } else if (s1Type === 'AOE_HP_PERCENT_CD4') {
    cd1 = 4;
    isAoe = true;
  }

  let multSkill = mult * 1.15;
  if (s1Mod === 'BURST') multSkill *= 1.2;
  const effects = [];

  if (s1Type.includes('HP_PERCENT') || s1Type === 'SINGLE_TARGET_HP_PERCENT_CD3') {
    effects.push({
      type: 'DAMAGE',
      percentMaxHp: 0.12,
      target: isAoe ? 'TEAM_ENEMY' : 'ENEMY_SINGLE'
    });
  } else {
    effects.push({
      type: 'DAMAGE',
      mult: multSkill,
      target: isAoe ? 'TEAM_ENEMY' : 'ENEMY_SINGLE'
    });
  }

  if (s1Mod === 'DEBUFF') {
    effects.push({
      type: 'APPLY_DEBUFF',
      debuffType: keys.has('dps_s1_s3_IGNORE_RESIST') ? 'DEF_DOWN' : 'ATK_DOWN',
      remainingActions: keys.has('dps_s1_s3_EXTRA_DURATION') ? 3 : 2,
      chance: keys.has('dps_s1_s3_IGNORE_RESIST') ? 0.95 : 0.85,
      target: isAoe ? 'TEAM_ENEMY' : 'ENEMY_SINGLE'
    });
  } else if (s1Mod === 'TEMPO') {
    effects.push({
      type: 'APPLY_DEBUFF',
      debuffType: 'SLOW',
      remainingActions: keys.has('dps_s1_s3_EXTRA_SLOW_DURATION') ? 3 : 2,
      target: isAoe ? 'TEAM_ENEMY' : 'ENEMY_SINGLE'
    });
    if (keys.has('dps_s1_s3_SELF_ATB_UP')) {
      effects.push({ type: 'ATB_UP', percent: 0.12, target: 'SELF' });
    }
  }

  if (
    s1Mod === 'BURST' &&
    s1Spec === 'CD_REDUCTION' &&
    !keys.has('dps_s1_s1_AOE_CD3') &&
    !keys.has('dps_s1_s1_AOE_HP_PERCENT_CD4') &&
    !keys.has('dps_s1_s1_SINGLE_TARGET_HP_PERCENT_CD3')
  ) {
    cd1 = Math.max(1, cd1 - 1);
  }

  const tags = [s1Mod, s1Type.includes('DOT') ? 'DoT' : 'Burst'].filter(Boolean);

  return {
    skill: active('Frappe personnalisée', cd1, 1, effects),
    tags
  };
}

/**
 * @returns {{ skill: object | null, tags: string[] }}
 */
export function buildDpsSkill2(keys, stats, mult, _element) {
  const tags = [];
  if (keys.has('dps_s2_mode_active')) {
    if (keys.has('dps_s2_act_ATK_BUFF')) {
      tags.push('Buff');
      return {
        skill: active('Amplificateur', 4, 2, [
          {
            type: 'APPLY_BUFF',
            buffType: 'ATK_UP',
            remainingActions: 2,
            target: 'ALLY_SINGLE'
          }
        ]),
        tags
      };
    }
    if (keys.has('dps_s2_act_ATB_UP')) {
      tags.push('Tempo');
      return {
        skill: active('Pulsation', 3, 2, [{ type: 'ATB_UP', percent: 0.18, target: 'ALLY_SINGLE' }]),
        tags
      };
    }
    if (keys.has('dps_s2_act_SPEED_BUFF')) {
      tags.push('Tempo');
      return {
        skill: active('Hâte', 4, 2, [
          {
            type: 'APPLY_BUFF',
            buffType: 'SPEED_UP',
            remainingActions: 2,
            target: 'ALLY_SINGLE'
          }
        ]),
        tags
      };
    }
  } else if (keys.has('dps_s2_mode_passive')) {
    if (keys.has('dps_s2_pas_LIFESTEAL')) {
      tags.push('Sustain');
      return {
        skill: passive(
          'ON_DEAL_DAMAGE',
          [
            {
              type: 'HEAL',
              percentMaxHpCaster: 0.08,
              target: 'SELF'
            }
          ],
          { name: 'Soif de combat', description: '', priority: 3 }
        ),
        tags
      };
    }
    if (keys.has('dps_s2_pas_ATB_ON_HIT')) {
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
    if (keys.has('dps_s2_pas_ATB_ON_KILL')) {
      tags.push('Tempo');
      return {
        skill: passive('ON_KILL', [{ type: 'ATB_UP', percent: 0.2, target: 'SELF' }], {
          name: 'Coup de grâce',
          description: '',
          priority: 3
        }),
        tags
      };
    }
  }
  return { skill: null, tags };
}
