/**
 * Builder / validation des unités Custom : états des nœuds, preview, règles d’équilibrage.
 */
import {
  getAllCustomTreeNodes,
  getNodesByRole,
  getNodeByKey,
  CUSTOM_ELEMENTS,
  CUSTOM_ROLES
} from '../data/customUnitDefinitions.js';
import {
  buildCustomSkillData,
  buildCustomSkillDataFromConfig,
  buildStatPreview
} from './customUnitSkillFactory.js';
import { computePowerBudget } from './customUnitPowerBudget.js';
import { validateGlobalRules } from './customUnitBalanceRules.js';
import { validateCustomUnitBudget } from './customUnitBudgetValidator.js';
import { isSkill2Enabled } from './customUnitConfigMapper.js';

function toSet(keys) {
  return new Set((Array.isArray(keys) ? keys : []).map((k) => String(k).trim()).filter(Boolean));
}

function meetsRequiresAll(selected, requiresAll) {
  if (!requiresAll || requiresAll.length === 0) return true;
  return requiresAll.every((k) => selected.has(k));
}

/** requiresOneOf: [ [a,b,c], [x,y] ] => (au moins un de abc) OU (au moins un de xy) — ici on n’utilise qu’un seul groupe interne. */
function meetsRequiresOneOf(selected, requiresOneOf) {
  if (!requiresOneOf || requiresOneOf.length === 0) return true;
  return requiresOneOf.some((group) => Array.isArray(group) && group.some((k) => selected.has(k)));
}

/** Règles spéciales : retourne raison FR si le nœud ne doit pas être sélectionnable / valide. */
export function evaluateRule(ruleId, selectedKeys, nodeKey) {
  const sel = toSet(selectedKeys);
  const has = (k) => sel.has(k);

  switch (ruleId) {
    case 'no_cd_red_on_aoe_hp': {
      if (nodeKey !== 'dps_s1_s3_CD_REDUCTION') return null;
      const badType =
        has('dps_s1_s1_AOE_CD3') ||
        has('dps_s1_s1_AOE_HP_PERCENT_CD4') ||
        has('dps_s1_s1_SINGLE_TARGET_HP_PERCENT_CD3');
      if (badType) return 'Réduction de recharge indisponible sur cette compétence (AoE ou % PV max).';
      return null;
    }
    default:
      return null;
  }
}

function collectWarnings(selectedKeys, role) {
  const sel = toSet(selectedKeys);
  const warnings = [];
  if (role === 'dps') {
    if (sel.has('dps_s2_act_ATB_UP') && sel.has('dps_s2_pas_ATB_ON_HIT')) {
      warnings.push('ATB sur coup limité à 1 déclenchement par action ; évitez de cumuler trop de sources d’ATB.');
    }
    if (sel.has('dps_s2_act_ATB_UP') && sel.has('dps_s2_pas_ATB_ON_KILL')) {
      warnings.push('Plusieurs sources d’ATB : l’équilibrage privilégie le rythme, pas le double tour.');
    }
  }
  if (role === 'assassin') {
    if (sel.has('assassin_s1_s4_RESET_CD_ON_KILL')) {
      warnings.push('Reset de CD au KO : usage limité et encadré pour éviter les enchaînements abusifs.');
    }
    if (sel.has('assassin_s1_s4_BIG_ATB_GAIN')) {
      warnings.push('Pas de double tour réel : le gain d’ATB remplace une action bonus explicite.');
    }
  }
  return warnings;
}

/**
 * @param {string} role
 * @param {string[]} selectedKeys
 * @returns {{ nodeKey: string, state: 'selected'|'available'|'locked'|'excluded', reason?: string }[]}
 */
export function getCustomUnitTree(role, selectedKeys) {
  const r = String(role || '').toLowerCase();
  const nodes = getNodesByRole(r);
  const sel = toSet(selectedKeys);
  const out = [];

  for (const node of nodes) {
    if (sel.has(node.nodeKey)) {
      out.push({ nodeKey: node.nodeKey, state: 'selected' });
      continue;
    }

    const otherInGroup = nodes.some(
      (n) => n.groupId === node.groupId && n.nodeKey !== node.nodeKey && sel.has(n.nodeKey)
    );
    if (otherInGroup) {
      out.push({
        nodeKey: node.nodeKey,
        state: 'excluded',
        reason: 'Une autre option de ce groupe est déjà choisie.'
      });
      continue;
    }

    let ruleReason = null;
    for (const rid of node.ruleIds || []) {
      const msg = evaluateRule(rid, selectedKeys, node.nodeKey);
      if (msg) ruleReason = msg;
    }
    if (ruleReason) {
      out.push({ nodeKey: node.nodeKey, state: 'excluded', reason: ruleReason });
      continue;
    }

    if (!meetsRequiresAll(sel, node.requiresAll)) {
      out.push({ nodeKey: node.nodeKey, state: 'locked', reason: 'Prérequis manquants.' });
      continue;
    }

    if (node.requiresOneOf && node.requiresOneOf.length > 0) {
      const satisfied = meetsRequiresOneOf(sel, node.requiresOneOf);
      if (!satisfied) {
        let branchBlocked = false;
        for (const group of node.requiresOneOf) {
          for (const reqKey of group) {
            const reqNode = getNodeByKey(reqKey);
            if (!reqNode) continue;
            const sibs = nodes.filter(
              (n) => n.groupId === reqNode.groupId && n.nodeKey !== reqKey
            );
            if (sibs.some((s) => sel.has(s.nodeKey))) {
              branchBlocked = true;
              break;
            }
          }
        }
        if (branchBlocked) {
          out.push({
            nodeKey: node.nodeKey,
            state: 'excluded',
            reason: 'Incompatible avec la branche déjà choisie.'
          });
        } else {
          out.push({
            nodeKey: node.nodeKey,
            state: 'locked',
            reason: 'Complétez d’abord l’étape précédente.'
          });
        }
        continue;
      }
    }

    out.push({ nodeKey: node.nodeKey, state: 'available' });
  }

  return out;
}

export function requiredGroupsForRole(role) {
  const r = String(role || '').toLowerCase();
  if (r === 'dps') {
    return [
      'dps_s1_s1',
      'dps_s1_s2',
      'dps_s1_s3',
      'dps_s2_mode',
      'dps_s2_pick'
    ];
  }
  if (r === 'tank') {
    return ['tank_s1_s1', 'tank_s1_s2', 'tank_s1_s3', 'tank_s1_s4', 'tank_s2_mode', 'tank_s2_pick'];
  }
  if (r === 'support') {
    return ['support_s1_s1', 'support_s1_s2', 'support_s1_s3', 'support_s1_s4', 'support_s2_mode', 'support_s2_pick'];
  }
  if (r === 'assassin') {
    return ['assassin_s1_s1', 'assassin_s1_s2', 'assassin_s1_s3', 'assassin_s1_s4', 'assassin_s2_mode', 'assassin_s2_pick'];
  }
  return [];
}

export function validateCustomUnitChoices(role, element, selectedKeys) {
  const structuralErrors = [];
  const r = String(role || '').toLowerCase();
  const el = String(element || '').toLowerCase();

  if (!CUSTOM_ROLES.includes(r)) structuralErrors.push(`Rôle invalide : ${role}`);
  if (!CUSTOM_ELEMENTS.includes(el)) structuralErrors.push(`Élément invalide : ${element}`);

  const nodes = getNodesByRole(r);
  const sel = toSet(selectedKeys);
  const groups = requiredGroupsForRole(r);

  for (const g of groups) {
    const inGroup = nodes.filter((n) => n.groupId === g);
    const picked = inGroup.filter((n) => sel.has(n.nodeKey));
    if (picked.length === 0) structuralErrors.push(`Choix manquant pour le groupe ${g}.`);
    if (picked.length > 1) structuralErrors.push(`Trop de choix pour le groupe ${g}.`);
  }

  for (const node of nodes) {
    if (!sel.has(node.nodeKey)) continue;
    for (const rid of node.ruleIds || []) {
      const msg = evaluateRule(rid, selectedKeys, node.nodeKey);
      if (msg) structuralErrors.push(msg);
    }
  }

  const groupMap = new Map();
  for (const node of nodes) {
    if (!sel.has(node.nodeKey)) continue;
    const prev = groupMap.get(node.groupId);
    if (prev && prev !== node.nodeKey) {
      structuralErrors.push(`Conflit dans le groupe ${node.groupId}.`);
    }
    groupMap.set(node.groupId, node.nodeKey);
  }

  const modePairs = [
    ['dps', 'dps_s2_mode_active', 'dps_s2_mode_passive', 'dps_s2_act_', 'dps_s2_pas_'],
    ['tank', 'tank_s2_mode_active', 'tank_s2_mode_passive', 'tank_s2_act_', 'tank_s2_pas_'],
    ['support', 'support_s2_mode_active', 'support_s2_mode_passive', 'support_s2_act_', 'support_s2_pas_'],
    ['assassin', 'assassin_s2_mode_active', 'assassin_s2_mode_passive', 'assassin_s2_act_', 'assassin_s2_pas_']
  ];
  for (const [roleKey, ak, pk, prefAct, prefPas] of modePairs) {
    if (r !== roleKey) continue;
    const hasA = sel.has(ak);
    const hasP = sel.has(pk);
    if (hasA && [...sel].some((k) => k.startsWith(prefPas))) {
      structuralErrors.push('Compétence 2 : les options passives ne s’appliquent pas au mode actif.');
    }
    if (hasP && [...sel].some((k) => k.startsWith(prefAct))) {
      structuralErrors.push('Compétence 2 : les options actives ne s’appliquent pas au mode passif.');
    }
  }

  const errors = [...structuralErrors];
  const pb = computePowerBudget(selectedKeys);
  if (pb.isOverBudget) {
    errors.push(`Budget de puissance dépassé (${pb.totalPower}/${pb.maxPower}).`);
  }

  if (structuralErrors.length === 0) {
    const skillData = buildCustomSkillData(role, element, selectedKeys, pb);
    const s1 = skillData.skills?.find((s) => Number(s.priority) === 1);
    const s2 =
      skillData.skills?.find((s) => Number(s.priority) === 2) ??
      skillData.skills?.find((s) => String(s.type).toUpperCase() === 'PASSIVE');
    const gr = validateGlobalRules(s1, s2, selectedKeys);
    errors.push(...gr.errors);
  }

  return { valid: errors.length === 0, errors };
}

export function buildCustomUnitStats(role, element, selectedKeys) {
  return buildStatPreview(role, element, selectedKeys);
}

export function buildCustomSkill1(role, element, selectedKeys) {
  const pb = computePowerBudget(selectedKeys);
  const skillData = buildCustomSkillData(role, element, selectedKeys, pb);
  const skills = skillData.skills || [];
  const s1 = skills.find((s) => s && Number(s.priority) === 1) || skills[0];
  return s1 || null;
}

export function buildCustomSkill2(role, element, selectedKeys) {
  const pb = computePowerBudget(selectedKeys);
  const skillData = buildCustomSkillData(role, element, selectedKeys, pb);
  const skills = skillData.skills || [];
  const s2 = skills.find((s) => s && Number(s.priority) === 2);
  return s2 || null;
}

export function buildCustomUnitPreview(role, element, selectedKeys) {
  const validation = validateCustomUnitChoices(role, element, selectedKeys);
  const tree = getCustomUnitTree(role, selectedKeys);
  const pb = computePowerBudget(selectedKeys);
  const r = String(role || '').toLowerCase();
  const skillData =
    CUSTOM_ROLES.includes(r) && CUSTOM_ELEMENTS.includes(String(element || '').toLowerCase())
      ? buildCustomSkillData(role, element, selectedKeys, pb)
      : null;
  const stats = buildStatPreview(role, element, selectedKeys);
  const baseWarnings = collectWarnings(selectedKeys, r);

  const s1 = skillData?.skills?.find((s) => Number(s.priority) === 1);
  const s2 =
    skillData?.skills?.find((s) => Number(s.priority) === 2) ??
    skillData?.skills?.find((s) => String(s.type).toUpperCase() === 'PASSIVE');
  const globalRules = validateGlobalRules(s1 ?? null, s2 ?? null, selectedKeys);

  const summaryParts = [];
  if (skillData?.__summary) {
    summaryParts.push(skillData.__summary.basicAttack);
    summaryParts.push(skillData.__summary.skill1);
    summaryParts.push(skillData.__summary.skill2);
  }

  const warnings = [...baseWarnings];

  return {
    valid: validation.valid,
    errors: validation.errors,
    tree,
    warnings,
    balanceWarnings: globalRules.warnings,
    totalPower: pb.totalPower,
    maxPower: pb.maxPower,
    isOverBudget: pb.isOverBudget,
    powerRating: skillData?.__powerRating ?? 'LOW',
    gameplayTags: skillData?.__gameplayTags ?? [],
    gameplayPitch: skillData?.__summary?.pitch ?? '',
    skill1Gameplay: skillData?.__summary?.skill1Gameplay ?? '',
    skill2Gameplay: skillData?.__summary?.skill2Gameplay ?? '',
    finalStats: stats,
    finalSkill1: skillData?.skills?.find((s) => Number(s.priority) === 1) ?? null,
    finalSkill2: skillData?.skills?.find((s) => Number(s.priority) === 2) ?? null,
    finalPassive:
      skillData?.skills?.find((s) => String(s.type).toUpperCase() === 'PASSIVE' && Number(s.priority) === 3) ??
      skillData?.skills?.find((s) => String(s.type).toUpperCase() === 'PASSIVE') ??
      null,
    skillDataPreview: skillData,
    summary: summaryParts.filter(Boolean),
    tags: skillData?.__tags ?? [],
    selectedNodes: [...toSet(selectedKeys)]
  };
}

export { getAllCustomTreeNodes, getNodesByRole } from '../data/customUnitDefinitions.js';
export { validateCustomUnitBudget } from './customUnitBudgetValidator.js';

/**
 * Preview pour le modèle budget (sans nœuds).
 * @param {string} role
 * @param {string} element
 * @param {object} config — { skill1, skill2 }
 */
export function buildCustomUnitPreviewFromConfig(role, element, config) {
  const budget = validateCustomUnitBudget({ ...config, role, element });
  const skillData = buildCustomSkillDataFromConfig(role, element, config, budget);
  const s1 = skillData?.skills?.find((s) => Number(s.priority) === 1);
  const s2 =
    skillData?.skills?.find((s) => Number(s.priority) === 2) ??
    skillData?.skills?.find((s) => String(s.type).toUpperCase() === 'PASSIVE');
  const globalRules = validateGlobalRules(s1 ?? null, s2 ?? null, []);
  const errors = [...budget.errors, ...globalRules.errors];

  const summaryParts = [];
  if (skillData?.__summary) {
    summaryParts.push(skillData.__summary.basicAttack);
    summaryParts.push(skillData.__summary.skill1);
    summaryParts.push(skillData.__summary.skill2);
  }

  return {
    hasSkill2: isSkill2Enabled(config),
    valid: errors.length === 0,
    errors,
    budget,
    warnings: globalRules.warnings,
    balanceWarnings: globalRules.warnings,
    finalStats: buildStatPreview(role, element, []),
    finalSkill1: s1 ?? null,
    finalSkill2: s2 ?? null,
    finalPassive:
      skillData?.skills?.find((s) => String(s.type).toUpperCase() === 'PASSIVE' && Number(s.priority) === 3) ??
      skillData?.skills?.find((s) => String(s.type).toUpperCase() === 'PASSIVE') ??
      null,
    skillDataPreview: skillData,
    summary: summaryParts.filter(Boolean),
    tags: skillData?.__tags ?? [],
    gameplayPitch: skillData?.__summary?.pitch ?? '',
    skill1Gameplay: skillData?.__summary?.skill1Gameplay ?? '',
    skill2Gameplay: skillData?.__summary?.skill2Gameplay ?? '',
    gameplayTags: skillData?.__gameplayTags ?? [],
    powerRating: skillData?.__powerRating ?? 'LOW',
    totalPower: budget.totalCost,
    maxPower: budget.maxBudget,
    isOverBudget: budget.remainingPoints < 0
  };
}
