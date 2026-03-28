import { query } from '../config/db.js';
import { computeScaledStats } from '../../../core/combatEngine.js';
import { applyUnitSpecializationToSkillData } from './battleTeamService.js';
import { getSkillDescriptionForTooltip } from '../utils/skillDescription.js';
import { createPendingBattle, serializePendingBattle } from './pendingBattleService.js';

export const TUTORIAL_BATTLE_SEED = 9001337;

function parseJson(v) {
  if (v == null) return null;
  if (typeof v === 'object') return v;
  if (typeof v !== 'string') return null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

function buildUnitForCombat(unitRow, multiplier, index, levelOverride) {
  const level = levelOverride ?? 12;
  const specialization = null;
  const skillData = parseJson(unitRow.skill_data);
  const unit = {
    id: unitRow.id,
    name: unitRow.name,
    code: unitRow.code,
    rarity: (unitRow.rarity || 'common').toLowerCase(),
    image_url: unitRow.image_url ?? null,
    element: unitRow.element,
    archetype: unitRow.archetype,
    role: unitRow.role,
    base_hp: unitRow.base_hp,
    base_attack: unitRow.base_attack,
    base_defense: unitRow.base_defense,
    base_speed: unitRow.base_speed,
    mastery: unitRow.mastery ?? 0,
    level,
    specialization,
    fatigue: 0,
    traits: parseJson(unitRow.traits) ?? unitRow.traits,
    skill_data: skillData,
    skillData,
    specA_bonus_stat: unitRow.specA_bonus_stat ?? null,
    specB_bonus_stat: unitRow.specB_bonus_stat ?? null,
    specA_skill_modifier: parseJson(unitRow.specA_skill_modifier) ?? null,
    specB_skill_modifier: parseJson(unitRow.specB_skill_modifier) ?? null,
    specA_passive: parseJson(unitRow.specA_passive) ?? unitRow.specA_passive ?? null,
    specB_passive: parseJson(unitRow.specB_passive) ?? unitRow.specB_passive ?? null,
    rangeType: unitRow.attack_type === 'melee' ? 'melee' : 'ranged',
    position: 'front'
  };
  applyUnitSpecializationToSkillData(unit, { npcCombat: true });
  const stats = computeScaledStats(unit, { level, specialization });
  unit.maxHp = Math.round(stats.maxHp * multiplier);
  unit.attack = Math.round(stats.attack * multiplier);
  unit.defense = Math.round(stats.defense * multiplier);
  unit.speed = Math.round(stats.speed * multiplier);
  unit.mastery = Math.round(stats.mastery * multiplier);
  return unit;
}

const UNIT_SELECT = `id, code, name, rarity, role, attack_type, element, archetype,
            base_hp, base_attack, base_defense, base_speed, mastery, traits, skill_data, image_url,
            specA_bonus_stat, specB_bonus_stat,
            specA_skill_modifier, specB_skill_modifier, specA_passive, specB_passive`;

async function fetchTwoUnitsByAttackType(attackType) {
  return query(
    `SELECT ${UNIT_SELECT} FROM units WHERE attack_type = ? ORDER BY id ASC LIMIT 2`,
    [attackType]
  );
}

export function getCombatTutorialScript() {
  return [
    {
      id: 'intro',
      type: 'message',
      text: "Voici un combat. Ton objectif est de battre l'équipe ennemie."
    },
    {
      id: 'atb',
      type: 'highlight',
      target: 'atb_bar',
      text:
        "L'ATB (arc jaune autour du portrait) détermine l'ordre de jeu. Plus une unité est rapide, plus elle joue souvent."
    },
    {
      id: 'active_unit',
      type: 'highlight',
      target: 'active_unit',
      text: "L'unité entourée d'une aura jaune est celle qui joue actuellement."
    },
    {
      id: 'targeting',
      type: 'highlight',
      target: 'targeting',
      text:
        "Les unités au corps à corps ne peuvent cibler que la ligne adverse au CAC. Les unités à distance peuvent cibler tout le monde. Les cibles valides sont indiquées par un surlignage."
    },
    {
      id: 'force_basic',
      type: 'action',
      allowedActions: ['basic_attack'],
      text: "Utilise l'attaque de base pour cette action (la compétence est bloquée pour l'exemple)."
    },
    {
      id: 'skills',
      type: 'highlight',
      target: 'skills_panel',
      text:
        'Chaque unité possède plusieurs compétences. Certaines ont un temps de recharge (cooldown) avant réutilisation.'
    },
    {
      id: 'cooldown',
      type: 'highlight',
      target: 'skills_panel',
      text: "Une compétence grisée ou marquée CD ne peut pas être utilisée tant que le cooldown n'est pas écoulé."
    },
    {
      id: 'buffs',
      type: 'highlight',
      target: 'buff_icons',
      text:
        'Les buffs (positifs) et debuffs (négatifs) apparaissent autour du portrait. Leur durée diminue au fil des tours.'
    },
    {
      id: 'free_play',
      type: 'free',
      text: 'À toi : termine le combat comme tu veux. Bonne chance !'
    },
    {
      id: 'victory',
      type: 'message',
      requireVictory: true,
      text: 'Bravo ! Tu es prêt à combattre.'
    }
  ];
}

/**
 * Construit les équipes factices (2v2 : CAC + distance) à partir du catalogue `units`.
 */
export async function buildTutorialCombatTeams() {
  const meleeRows = await fetchTwoUnitsByAttackType('melee');
  const rangedRows = await fetchTwoUnitsByAttackType('ranged');
  const meleeA = meleeRows[0];
  const meleeB = meleeRows[1] || meleeRows[0];
  const rangedA = rangedRows[0];
  const rangedB = rangedRows[1] || rangedRows[0];
  if (!meleeA || !rangedA || !meleeB || !rangedB) {
    const err = new Error('TUTORIAL_UNITS_MISSING');
    err.code = 'TUTORIAL_UNITS_MISSING';
    throw err;
  }

  const allyFront = buildUnitForCombat(meleeA, 1.15, 1, 12);
  allyFront.position = 'front';
  const allyBack = buildUnitForCombat(rangedA, 1.1, 2, 12);
  allyBack.position = 'back';

  const foeFront = buildUnitForCombat(meleeB, 0.85, 1, 11);
  foeFront.position = 'front';
  const foeBack = buildUnitForCombat(rangedB, 0.8, 2, 11);
  foeBack.position = 'back';

  const playerTeam = [allyFront, allyBack];
  const enemyTeam = [foeFront, foeBack];

  const initialUnits = [
    ...playerTeam.map((u, i) => ({
      id: `A-${i}`,
      name: u.name ?? `Allié ${i + 1}`,
      image_url: u.image_url ?? null,
      maxHp: u.maxHp ?? 100,
      element: (u.element || 'neutral').toUpperCase(),
      side: 'A',
      position: u.position === 'back' ? 'back' : 'front',
      level: u.level,
      attack: u.attack,
      defense: u.defense,
      speed: u.speed,
      traits: Array.isArray(u.traits) ? u.traits : [],
      skillDescription: getSkillDescriptionForTooltip(u),
      rarity: (u.rarity || 'common').toLowerCase(),
      archetype: u.archetype ?? null,
      role: u.role ?? null
    })),
    ...enemyTeam.map((u, i) => ({
      id: `B-${i}`,
      name: u.name ?? `Ennemi ${i + 1}`,
      image_url: u.image_url ?? null,
      maxHp: u.maxHp ?? 100,
      element: (u.element || 'neutral').toUpperCase(),
      side: 'B',
      position: u.position === 'back' ? 'back' : 'front',
      level: u.level,
      attack: u.attack,
      defense: u.defense,
      speed: u.speed,
      traits: Array.isArray(u.traits) ? u.traits : [],
      skillDescription: getSkillDescriptionForTooltip(u),
      rarity: (u.rarity || 'common').toLowerCase(),
      archetype: u.archetype ?? null,
      role: u.role ?? null
    }))
  ];

  return { playerTeam, enemyTeam, initialUnits };
}

export async function startCombatTutorialForUser(userId) {
  const { playerTeam, enemyTeam, initialUnits } = await buildTutorialCombatTeams();
  const tutorialScript = getCombatTutorialScript();

  const pendingBattle = await createPendingBattle(userId, 'tutorial', {
    title: 'Tutoriel de combat',
    enemyTeamLabel: 'Équipe PNJ (entraînement)',
    result: null,
    success: null,
    initialUnits,
    tutorialScript,
    interactiveSession: {
      seed: TUTORIAL_BATTLE_SEED,
      isTutorial: true,
      teamA: playerTeam,
      teamB: enemyTeam,
      decisions: []
    },
    finalizeData: { tutorial: true }
  });

  return serializePendingBattle(pendingBattle);
}

export async function markCombatTutorialCompleted(userId) {
  await query('UPDATE users SET combat_tutorial_completed = 1 WHERE id = ?', [userId]);
}

export async function getCombatTutorialCompleted(userId) {
  const rows = await query(
    'SELECT combat_tutorial_completed FROM users WHERE id = ?',
    [userId]
  );
  if (!rows.length) return true;
  return Number(rows[0].combat_tutorial_completed) === 1;
}
