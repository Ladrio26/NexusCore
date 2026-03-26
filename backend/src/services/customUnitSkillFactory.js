/**
 * Point d’entrée Skill Factory V2 — réexporte modules spécialisés (rétro-compat import paths).
 */
export { normalizeEffects } from './customUnitSkill/normalizeEffects.js';
export {
  finalizeCustomSkills,
  getSkillMetaFromSkills,
  buildCustomSkillData,
  buildCustomSkillDataFromConfig,
  buildStatPreview,
  computePowerRating
} from './customUnitSkill/factory.js';
export {
  assembleSkillsForRole,
  filterKeysForSkillSlot,
  buildSkillFromNodes,
  buildSkill1,
  buildSkill2,
  buildDpsSkill1,
  buildDpsSkill2,
  buildTankSkill1,
  buildTankSkill2,
  buildSupportSkill1,
  buildSupportSkill2,
  buildAssassinSkill1,
  buildAssassinSkill2
} from './customUnitSkill/assembleRoleSkills.js';
export { generateSkillSummary, buildGameplayPitch } from './customUnitSkill/skillSummaries.js';
export { active, passive } from './customUnitSkill/enginePrimitives.js';
