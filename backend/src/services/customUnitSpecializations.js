import { normalizeSpecBonusStat } from '../data/customUnitSpecializationConfig.js';

/**
 * Spé A / Spé B dérivées des choix d’arbre (stats + modificateurs légers sur compétences).
 * Les joueurs choisissent A ou B en jeu comme pour les autres unités.
 */

/**
 * @param {string} role
 * @param {string[]} selectedKeys
 * @param {{ skill1Cd: number, skill2Cd: number, skill2IsPassive: boolean, firstActiveId?: string | null, skill2ActiveId?: string | null }} skillMeta
 * @param {{ specA_bonus_stat?: string, specB_bonus_stat?: string }} [specializationOptions]
 * @returns {{
 *   specA_bonus_stat: string,
 *   specB_bonus_stat: string,
 *   specA_skill_modifier: object | null,
 *   specB_skill_modifier: object | null,
 *   specA_passive: object | null,
 *   specB_passive: object | null
 * }}
 */
export function deriveCustomSpecializations(role, selectedKeys, skillMeta, specializationOptions = {}) {
  const keys = new Set(selectedKeys || []);
  const r = String(role || '').toLowerCase();
  const opt = specializationOptions || {};
  const oa = normalizeSpecBonusStat(opt.specA_bonus_stat);
  const ob = normalizeSpecBonusStat(opt.specB_bonus_stat);
  if (oa && ob) {
    const { skill1Cd, skill2Cd, skill2IsPassive, firstActiveId, skill2ActiveId } = skillMeta;
    const specAmod =
      skill1Cd > 1 && firstActiveId
        ? {
            targetSkillId: firstActiveId,
            modify: { cd_actions: Math.max(1, skill1Cd - 1) }
          }
        : null;
    let specBmod = null;
    if (!skill2IsPassive && skill2Cd > 1 && skill2ActiveId) {
      specBmod = {
        targetSkillId: skill2ActiveId,
        modify: { cd_actions: Math.max(1, skill2Cd - 1) }
      };
    }
    return {
      specA_bonus_stat: oa,
      specB_bonus_stat: ob,
      specA_skill_modifier: specAmod,
      specB_skill_modifier: specBmod,
      specA_passive: null,
      specB_passive: null
    };
  }

  let specA = 'attack';
  let specB = 'defense';

  if (r === 'dps') {
    if (keys.has('dps_s1_s2_BURST')) specA = 'attack';
    else if (keys.has('dps_s1_s2_DEBUFF')) specA = 'mastery';
    else if (keys.has('dps_s1_s2_TEMPO')) specA = 'speed';
    if (keys.has('dps_s2_act_ATK_BUFF') || keys.has('dps_s2_pas_LIFESTEAL')) specB = 'attack';
    else if (keys.has('dps_s2_act_SPEED_BUFF') || keys.has('dps_s2_pas_ATB_ON_HIT')) specB = 'speed';
    else specB = 'mastery';
  } else if (r === 'tank') {
    specA = keys.has('tank_s1_s2_PURE_TANK') ? 'defense' : 'maxHp';
    specB = keys.has('tank_s2_act_AOE_HEAL') ? 'mastery' : 'defense';
    if (keys.has('tank_s1_s2_CONTROL')) specA = 'mastery';
  } else if (r === 'support') {
    specA = 'mastery';
    specB = keys.has('support_s1_s2_BUFF') ? 'defense' : 'speed';
    if (keys.has('support_s1_s2_SUSTAIN')) specA = 'maxHp';
  } else if (r === 'assassin') {
    specA = keys.has('assassin_s1_s2_BURST') ? 'attack' : 'speed';
    specB = keys.has('assassin_s2_pas_BONUS_SPEED') ? 'speed' : 'defense';
    if (keys.has('assassin_s1_s2_CONTROL')) specA = 'mastery';
  }

  const { skill1Cd, skill2Cd, skill2IsPassive, firstActiveId, skill2ActiveId } = skillMeta;

  /** Spé A : légère réduction de CD sur la compétence 1. */
  const specAmod =
    skill1Cd > 1 && firstActiveId
      ? {
          targetSkillId: firstActiveId,
          modify: { cd_actions: Math.max(1, skill1Cd - 1) }
        }
      : null;

  /** Spé B : même logique sur la 2e compétence active (si elle existe). */
  let specBmod = null;
  if (!skill2IsPassive && skill2Cd > 1 && skill2ActiveId) {
    specBmod = {
      targetSkillId: skill2ActiveId,
      modify: { cd_actions: Math.max(1, skill2Cd - 1) }
    };
  }

  return {
    specA_bonus_stat: specA,
    specB_bonus_stat: specB,
    specA_skill_modifier: specAmod,
    specB_skill_modifier: specBmod,
    specA_passive: null,
    specB_passive: null
  };
}
