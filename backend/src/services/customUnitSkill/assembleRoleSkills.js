import { buildDpsSkill1, buildDpsSkill2 } from './dpsRole.js';
import { buildTankSkill1, buildTankSkill2 } from './tankRole.js';
import { buildSupportSkill1, buildSupportSkill2 } from './supportRole.js';
import { buildAssassinSkill1, buildAssassinSkill2 } from './assassinRole.js';

function atkMultForRole(role) {
  const r = String(role || '').toLowerCase();
  if (r === 'tank') return 0.35;
  if (r === 'support') return 0.32;
  return 0.42;
}

/**
 * Filtre les clés d’arbre pour un slot de compétence (ex. dps_s1_*, dps_s2_*).
 * @param {string} role
 * @param {1|2} skillSlot
 * @param {Iterable<string>} selectedKeys
 */
export function filterKeysForSkillSlot(role, skillSlot, selectedKeys) {
  const prefix = `${String(role).toLowerCase()}_s${skillSlot}_`;
  return new Set([...selectedKeys].filter((k) => String(k).startsWith(prefix)));
}

/**
 * @param {string} role
 * @param {1|2} skillSlot
 * @param {string[]} selectedKeys
 * @param {object} stats — preview stats
 * @param {string} element
 * @returns {{ skill: object | null, tags: string[] }}
 */
/** Alias API : compétence 1 (slot 1). */
export function buildSkill1(role, selectedKeys, stats, element) {
  return buildSkillFromNodes(role, 1, selectedKeys, stats, element);
}

/** Alias API : compétence 2 (slot 2). */
export function buildSkill2(role, selectedKeys, stats, element) {
  return buildSkillFromNodes(role, 2, selectedKeys, stats, element);
}

export function buildSkillFromNodes(role, skillSlot, selectedKeys, stats, element) {
  const r = String(role).toLowerCase();
  const keys = new Set(selectedKeys);
  const mult = atkMultForRole(r);

  if (skillSlot === 1) {
    if (r === 'dps') return buildDpsSkill1(keys, stats, mult, element);
    if (r === 'tank') return buildTankSkill1(keys, stats, mult, element);
    if (r === 'support') return buildSupportSkill1(keys, stats, mult, element);
    if (r === 'assassin') return buildAssassinSkill1(keys, stats, mult, element);
    return { skill: null, tags: [] };
  }
  if (skillSlot === 2) {
    if (r === 'dps') return buildDpsSkill2(keys, stats, mult, element);
    if (r === 'tank') return buildTankSkill2(keys, stats, mult, element);
    if (r === 'support') return buildSupportSkill2(keys, stats, mult, element);
    if (r === 'assassin') return buildAssassinSkill2(keys, stats, mult, element);
    return { skill: null, tags: [] };
  }
  return { skill: null, tags: [] };
}

/**
 * @returns {{ skills: object[], tags: string[] }}
 */
export function assembleSkillsForRole(role, selectedKeys, stats, element) {
  const r = String(role).toLowerCase();
  const keys = new Set(selectedKeys);
  const mult = atkMultForRole(r);

  const builders = {
    dps: () => {
      const a = buildDpsSkill1(keys, stats, mult, element);
      const b = buildDpsSkill2(keys, stats, mult, element);
      const skills = [a.skill];
      if (b.skill) skills.push(b.skill);
      return { skills, tags: [...a.tags, ...b.tags] };
    },
    tank: () => {
      const a = buildTankSkill1(keys, stats, mult, element);
      const b = buildTankSkill2(keys, stats, mult, element);
      const skills = [a.skill];
      if (b.skill) skills.push(b.skill);
      return { skills, tags: [...a.tags, ...b.tags] };
    },
    support: () => {
      const a = buildSupportSkill1(keys, stats, mult, element);
      const b = buildSupportSkill2(keys, stats, mult, element);
      const skills = [a.skill];
      if (b.skill) skills.push(b.skill);
      return { skills, tags: [...a.tags, ...b.tags] };
    },
    assassin: () => {
      const a = buildAssassinSkill1(keys, stats, mult, element);
      const b = buildAssassinSkill2(keys, stats, mult, element);
      const skills = [a.skill];
      if (b.skill) skills.push(b.skill);
      return { skills, tags: [...a.tags, ...b.tags] };
    }
  };

  const fn = builders[r];
  if (!fn) return { skills: [], tags: [] };
  const out = fn();
  return { skills: out.skills.filter(Boolean), tags: [...new Set(out.tags)] };
}

// Réexport des builders nommés (API Skill Factory V2)
export { buildDpsSkill1, buildDpsSkill2 } from './dpsRole.js';
export { buildTankSkill1, buildTankSkill2 } from './tankRole.js';
export { buildSupportSkill1, buildSupportSkill2 } from './supportRole.js';
export { buildAssassinSkill1, buildAssassinSkill2 } from './assassinRole.js';
