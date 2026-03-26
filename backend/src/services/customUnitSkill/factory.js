import { ROLE_BASE_STATS } from '../../data/customUnitDefinitions.js';
import { sanitizeCustomUnitConfigForRole } from '../../data/customUnitRoleRules.js';
import { describeBasicAttackFr, buildRichSkillDescriptionFr } from '../customUnitSkillDescriptions.js';
import { deriveCustomSpecializations } from '../customUnitSpecializations.js';
import { assembleSkillsForRole } from './assembleRoleSkills.js';
import { assembleSkillsFromUnitConfig } from '../customUnitConfigMapper.js';
import { generateSkillSummary, buildGameplayPitch } from './skillSummaries.js';

/**
 * Attribue des id stables (custom_s1, custom_p1…) et descriptions FR depuis les effets.
 * @param {object[]} skills
 */
export function finalizeCustomSkills(skills) {
  if (!Array.isArray(skills)) return;
  const actives = skills
    .filter((s) => String(s.type).toUpperCase() === 'ACTIVE')
    .sort((a, b) => Number(a.priority) - Number(b.priority));
  const passives = skills
    .filter((s) => String(s.type).toUpperCase() === 'PASSIVE')
    .sort((a, b) => Number(a.priority) - Number(b.priority));
  let ai = 0;
  for (const s of actives) {
    ai += 1;
    s.id = `custom_s${ai}`;
  }
  let pi = 0;
  for (const s of passives) {
    pi += 1;
    s.id = `custom_p${pi}`;
  }
  for (const s of skills) {
    const st = String(s.type || '').toUpperCase();
    if (st === 'ACTIVE' || st === 'PASSIVE') {
      s.description = buildRichSkillDescriptionFr(s);
    }
    if (st === 'ACTIVE' && s.cd_actions != null) {
      s.cooldown = Number(s.cd_actions);
    }
  }
}

/**
 * @param {object[]} skills
 * @returns {{ skill1Cd: number, skill2Cd: number, skill2IsPassive: boolean, firstActiveId: string | null, skill2ActiveId: string | null }}
 */
export function getSkillMetaFromSkills(skills) {
  const list = Array.isArray(skills) ? skills : [];
  const actives = list
    .filter((s) => String(s.type).toUpperCase() === 'ACTIVE')
    .sort((a, b) => Number(a.priority) - Number(b.priority));
  const passives = list.filter((s) => String(s.type).toUpperCase() === 'PASSIVE');
  const s1 = actives[0];
  const s2 = actives[1];
  const p1 = passives[0];
  const skill1Cd = Number(s1?.cd_actions ?? 0);
  const skill2IsPassive = Boolean(!s2 && p1);
  const skill2Cd = Number(s2?.cd_actions ?? p1?.cooldown ?? 0);
  return {
    skill1Cd,
    skill2Cd,
    skill2IsPassive,
    firstActiveId: s1?.id ?? null,
    skill2ActiveId: s2?.id ?? null
  };
}

function atkMultForRole(_role) {
  return 1;
}

const ROLE_FR_LABEL = {
  dps: 'DPS',
  tank: 'Tank',
  support: 'Support',
  assassin: 'Assassin'
};

export function buildStatPreview(role, element, selectedKeys) {
  const r = String(role).toLowerCase();
  const base = ROLE_BASE_STATS[r];
  if (!base) {
    return {
      hp: 1000,
      attack: 80,
      defense: 80,
      speed: 80,
      mastery: 50,
      element: String(element || 'fire').toLowerCase(),
      attack_type: 'ranged',
      archetype: '—',
      role: 'unknown',
      role_fr: '—'
    };
  }
  const keys = new Set(selectedKeys || []);
  let hp = base.base_hp;
  let atk = base.base_attack;
  let def = base.base_defense;
  let spd = base.base_speed;
  let mast = base.mastery;

  if (keys.has('dps_s1_s2_BURST')) atk = Math.round(atk * 1.03);
  if (keys.has('tank_s1_s2_PURE_TANK')) {
    hp = Math.round(hp * 1.05);
    def = Math.round(def * 1.04);
  }
  if (keys.has('support_s1_s2_SUSTAIN')) hp = Math.round(hp * 1.02);
  if (keys.has('assassin_s1_s2_SURVIVE')) def = Math.round(def * 1.03);

  return {
    hp,
    attack: atk,
    defense: def,
    speed: spd,
    mastery: mast,
    element: String(element || 'fire').toLowerCase(),
    attack_type: base.attack_type,
    archetype: base.archetype,
    role: base.role,
    role_fr: ROLE_FR_LABEL[r] || r
  };
}

/**
 * @param {{ totalPower?: number, maxPower?: number, tags?: string[], skills?: object[] }} opts
 * @returns {'LOW'|'MEDIUM'|'HIGH'}
 */
export function computePowerRating(opts = {}) {
  const tp = Number(opts.totalPower ?? 0);
  const tags = opts.tags || [];
  const safeTp = Number.isFinite(tp) ? tp : 0;
  const skills = opts.skills || [];
  let score = safeTp * 1.15 + tags.length * 0.45;
  for (const s of skills) {
    for (const e of s?.effects || []) {
      if (String(e?.target || '').toUpperCase() === 'TEAM_ENEMY' && e?.type === 'DAMAGE') score += 0.8;
    }
  }
  if (score >= 11) return 'HIGH';
  if (score >= 7) return 'MEDIUM';
  return 'LOW';
}

/**
 * @returns {object} skill_data avec __summary enrichi, __tags, __specializations
 */
export function buildCustomSkillData(role, element, selectedKeys, powerBudget = {}) {
  const r = String(role || '').toLowerCase();
  const keys = new Set(selectedKeys || []);
  const stats = buildStatPreview(role, element, selectedKeys);
  const mult = atkMultForRole(r);
  const basicPct = Math.round(mult * 100);

  const built = assembleSkillsForRole(r, selectedKeys, stats, element);
  if (!built.skills.length) {
    return {
      skills: [],
      __summary: {
        basicAttack: describeBasicAttackFr(`${basicPct}% ATQ`),
        skill1: '',
        skill2: '',
        skill1Gameplay: '',
        skill2Gameplay: '',
        pitch: buildGameplayPitch(r, [], powerBudget)
      },
      __tags: [],
      __gameplayTags: [],
      __powerRating: 'LOW',
      __specializations: deriveCustomSpecializations(r, [...keys], {
        skill1Cd: 0,
        skill2Cd: 0,
        skill2IsPassive: true,
        firstActiveId: null,
        skill2ActiveId: null
      })
    };
  }
  finalizeCustomSkills(built.skills);
  const meta = getSkillMetaFromSkills(built.skills);
  const specs = deriveCustomSpecializations(r, [...keys], meta);

  const actives = built.skills
    .filter((s) => String(s.type).toUpperCase() === 'ACTIVE')
    .sort((a, b) => Number(a.priority) - Number(b.priority));
  const passives = built.skills.filter((s) => String(s.type).toUpperCase() === 'PASSIVE');

  const s1 = actives[0];
  const s2Active = actives[1];
  const s2Passive = passives[0];

  const sum1 = generateSkillSummary(s1, { role: r, slot: 1 });
  const sum2 = generateSkillSummary(s2Active || s2Passive, { role: r, slot: 2 });

  const gameplayTags = [...new Set([...built.tags, ...sum1.tags, ...sum2.tags])];
  const powerRating = computePowerRating({
    totalPower: powerBudget.totalPower,
    maxPower: powerBudget.maxPower,
    tags: gameplayTags,
    skills: built.skills
  });

  const pitch = buildGameplayPitch(r, gameplayTags, powerBudget);

  return {
    skills: built.skills,
    __summary: {
      basicAttack: describeBasicAttackFr(`${basicPct}% ATQ`),
      skill1: s1?.description || '',
      skill2: (s2Active || s2Passive)?.description || '',
      skill1Gameplay: sum1.gameplayHint,
      skill2Gameplay: sum2.gameplayHint,
      pitch
    },
    __tags: built.tags,
    __gameplayTags: gameplayTags,
    __powerRating: powerRating,
    __specializations: specs
  };
}

/**
 * Compétences depuis le nouveau modèle `config` (budget de points, sans nœuds).
 * @param {string} role
 * @param {string} element
 * @param {object} config — { skill1, skill2 }
 * @param {{ totalCost?: number, maxBudget?: number }} pointBudget — résultat validateCustomUnitBudget
 * @returns {object} skill_data
 */
export function buildCustomSkillDataFromConfig(role, element, config, pointBudget = {}) {
  const r = String(role || '').toLowerCase();
  const keys = new Set();
  const stats = buildStatPreview(role, element, []);
  const mult = atkMultForRole(r);
  const basicPct = Math.round(mult * 100);

  const safeConfig = sanitizeCustomUnitConfigForRole(config || {}, r);
  const built = assembleSkillsFromUnitConfig(r, safeConfig);
  if (!built.skills.length) {
    return {
      skills: [],
      __summary: {
        basicAttack: describeBasicAttackFr(`${basicPct}% ATQ`),
        skill1: '',
        skill2: '',
        skill1Gameplay: '',
        skill2Gameplay: '',
        pitch: buildGameplayPitch(r, [], {
          totalPower: pointBudget.totalCost,
          maxPower: pointBudget.maxBudget
        })
      },
      __tags: [],
      __gameplayTags: [],
      __powerRating: 'LOW',
      __specializations: deriveCustomSpecializations(
        r,
        [],
        {
          skill1Cd: 0,
          skill2Cd: 0,
          skill2IsPassive: true,
          firstActiveId: null,
          skill2ActiveId: null
        },
        {
          specA_bonus_stat: safeConfig?.specAStat,
          specB_bonus_stat: safeConfig?.specBStat
        }
      )
    };
  }
  finalizeCustomSkills(built.skills);
  const meta = getSkillMetaFromSkills(built.skills);
  const specs = deriveCustomSpecializations(r, [...keys], meta, {
    specA_bonus_stat: safeConfig?.specAStat,
    specB_bonus_stat: safeConfig?.specBStat
  });

  const actives = built.skills
    .filter((s) => String(s.type).toUpperCase() === 'ACTIVE')
    .sort((a, b) => Number(a.priority) - Number(b.priority));
  const passives = built.skills.filter((s) => String(s.type).toUpperCase() === 'PASSIVE');

  const s1 = actives[0];
  const s2Active = actives[1];
  const s2Passive = passives[0];

  const sum1 = generateSkillSummary(s1, { role: r, slot: 1 });
  const sum2 =
    s2Active || s2Passive
      ? generateSkillSummary(s2Active || s2Passive, { role: r, slot: 2 })
      : { technical: '', gameplayHint: '', tags: [] };

  const gameplayTags = [...new Set([...built.tags, ...sum1.tags, ...sum2.tags])];
  const powerRating = computePowerRating({
    totalPower: pointBudget.totalCost,
    maxPower: pointBudget.maxBudget,
    tags: gameplayTags,
    skills: built.skills
  });

  const pitch = buildGameplayPitch(r, gameplayTags, {
    totalPower: pointBudget.totalCost,
    maxPower: pointBudget.maxBudget
  });

  return {
    skills: built.skills,
    __summary: {
      basicAttack: describeBasicAttackFr(`${basicPct}% ATQ`),
      skill1: s1?.description || '',
      skill2: (s2Active || s2Passive)?.description || '',
      skill1Gameplay: sum1.gameplayHint,
      skill2Gameplay: sum2.gameplayHint,
      pitch
    },
    __tags: built.tags,
    __gameplayTags: gameplayTags,
    __powerRating: powerRating,
    __specializations: specs
  };
}
