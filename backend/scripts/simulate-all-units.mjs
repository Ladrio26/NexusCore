/**
 * Simule un combat pour chaque unité (hors BOSS) avec règles avancées.
 * - Exclut PASSIVE, skills sans effets actifs, triggers onAttack/onDeath.
 * - 3v3 pour DAMAGE_MULTI / count > 1.
 * - STRIP : buff factice sur cible avant test.
 * - HEAL : PV du caster diminués avant test (ennemi frappe d'abord).
 * - SHIELD : vérifie shieldAmount > 0 puis absorption à l'attaque.
 * - DAMAGE mult < 1 : dummy à DEF basse.
 *
 * Génère : SIMULATION_REPORT.md et SIMULATION_REPORT_ADVANCED.md
 */

import { query } from '../src/config/db.js';
import { simulateBattle } from '../../core/combatEngine.js';
import { writeFileSync } from 'fs';
import { join } from 'path';

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

function getSkillObject(skillData) {
  if (!skillData || typeof skillData !== 'object') return null;
  const raw = skillData.skill ?? skillData;
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw && typeof raw === 'object' ? raw : null;
}

/** Un effet a un trigger onAttack / onDeath ? */
function effectHasTrigger(eff, triggerList = ['ON_ATTACK', 'ON_DEATH', 'onAttack', 'onDeath']) {
  const t = (eff?.trigger ?? '').toString().toUpperCase();
  return triggerList.some((x) => x.toUpperCase() === t);
}

/** Le skill doit-il être exclu du test actif (PASSIVE, sans effets actifs, ou trigger onAttack/onDeath) ? */
function shouldExcludeFromActiveTest(skill) {
  if (!skill) return true;
  const type = (skill.type ?? '').toString().toUpperCase();
  if (type === 'PASSIVE') return true;
  const effects = Array.isArray(skill.effects) ? skill.effects : [];
  if (effects.length === 0) return true;
  const hasTriggeredEffect = effects.some((e) => effectHasTrigger(e));
  if (hasTriggeredEffect) return true;
  const passives = Array.isArray(skill.passives) ? skill.passives : [];
  const passiveHasTrigger = passives.some(
    (p) => (p?.type ?? p?.trigger ?? '').toString().toUpperCase() === 'ON_ATTACK' ||
      (p?.type ?? p?.trigger ?? '').toString().toUpperCase() === 'ON_DEATH'
  );
  if (passiveHasTrigger) return true;
  return false;
}

/** Le skill est-il DAMAGE_MULTI ou a un effet DAMAGE avec count > 1 ? */
function needsMultiTargetSimulation(skill) {
  const type = (skill?.type ?? '').toString().toUpperCase();
  if (type === 'DAMAGE_MULTI') return true;
  const effects = Array.isArray(skill?.effects) ? skill.effects : [];
  return effects.some((e) => {
    const t = (e?.type ?? '').toString().toUpperCase();
    if (t !== 'DAMAGE') return false;
    const c = e.count ?? ((e.target ?? '').toString().toUpperCase() === 'TEAM_ENEMY' ? 2 : 0);
    return Number(c) > 1;
  });
}

/** Le skill contient un effet STRIP ? */
function hasStripEffect(skill) {
  const effects = Array.isArray(skill?.effects) ? skill.effects : [];
  return effects.some((e) => (e?.type ?? '').toString().toUpperCase() === 'STRIP');
}

/** Le skill contient un effet HEAL ? */
function hasHealEffect(skill) {
  const effects = Array.isArray(skill?.effects) ? skill.effects : [];
  return effects.some((e) => (e?.type ?? '').toString().toUpperCase() === 'HEAL');
}

/** Le skill contient un effet SHIELD ? */
function hasShieldEffect(skill) {
  const effects = Array.isArray(skill?.effects) ? skill.effects : [];
  return effects.some((e) => (e?.type ?? '').toString().toUpperCase() === 'SHIELD');
}

/** Le skill a un effet DAMAGE avec mult < 1 ? */
function hasLowMultDamage(skill) {
  const effects = Array.isArray(skill?.effects) ? skill.effects : [];
  return effects.some((e) => {
    if ((e?.type ?? '').toString().toUpperCase() !== 'DAMAGE') return false;
    const m = e.mult ?? 1;
    return Number(m) < 1;
  });
}

/** Dummy ennemi. Options: lowDef, highSpeed, highAttack */
function createDummyEnemy(opts = {}) {
  const { lowDef = false, highSpeed = false, highAttack = false } = opts;
  return {
    code: 'DUMMY',
    name: 'Dummy',
    base_hp: 500,
    base_attack: highAttack ? 80 : 5,
    base_defense: lowDef ? 2 : 5,
    base_speed: highSpeed ? 600 : 1,
    level: 1,
    mastery: 0,
    element: 'fire',
    archetype: 'CAC_DPS',
    position: 'front',
    attack_type: 'melee',
    traits: [],
    skill_data: null
  };
}

/** Unité buffer ennemie : applique un buff à son équipe (TEAM_ALLY) pour que le dummy ait un buff à strip. */
function createEnemyBuffer() {
  return {
    code: 'BUF',
    name: 'Buffer',
    base_hp: 300,
    base_attack: 5,
    base_defense: 5,
    base_speed: 600,
    level: 1,
    mastery: 0,
    element: 'fire',
    archetype: 'CAC_DPS',
    position: 'front',
    attack_type: 'melee',
    traits: [],
    skill_data: {
      skill: {
        type: 'GENERIC',
        cd_actions: 1,
        effects: [
          { type: 'APPLY_BUFF', buffType: 'DEF_UP', remainingActions: 2, target: 'TEAM_ALLY' }
        ]
      }
    }
  };
}

/** Filler allié (pour 3v3). */
function createFillerAlly() {
  return {
    code: 'FILL',
    name: 'Filler',
    base_hp: 400,
    base_attack: 10,
    base_defense: 10,
    base_speed: 1,
    level: 1,
    mastery: 0,
    element: 'fire',
    archetype: 'CAC_DPS',
    position: 'front',
    attack_type: 'melee',
    traits: [],
    skill_data: null
  };
}

function buildUnitForSimulation(row, overrides = {}) {
  const skillData = parseJson(row.skill_data);
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    base_hp: row.base_hp,
    base_attack: row.base_attack,
    base_defense: row.base_defense,
    base_speed: overrides.speed ?? 500,
    level: 1,
    mastery: row.mastery ?? 0,
    element: row.element ?? 'fire',
    archetype: row.archetype ?? 'CAC_TANK',
    position: 'front',
    attack_type: row.attack_type || 'melee',
    traits: parseJson(row.traits) || [],
    skill_data: skillData,
    skillData: skillData,
    ...overrides
  };
}

function isResultMeaningful(effectType, r) {
  if (r.applied === true) return true;
  const heal = r.healAmount ?? r.heal ?? 0;
  if (heal > 0) return true;
  const shield = r.shieldAmount ?? r.shield ?? 0;
  if (shield > 0) return true;
  const dmg = r.effectiveDamage ?? r.damage ?? 0;
  if (dmg > 0) return true;
  const strip = r.removed ?? 0;
  if (strip > 0) return true;
  const hpRestored = r.hpRestored ?? 0;
  if (hpRestored > 0) return true;
  return false;
}

function hasValidResults(effectsResultsByTarget, options = {}) {
  const { checkShieldAmount = false } = options;
  if (!Array.isArray(effectsResultsByTarget) || effectsResultsByTarget.length === 0) {
    return { ok: false, reason: 'effectsResultsByTarget vide ou absent' };
  }
  let totalTargets = 0;
  let hasMeaningful = false;
  let shieldAmountOk = true;
  for (const group of effectsResultsByTarget) {
    const results = group.results ?? [];
    totalTargets += results.length;
    const effType = (group.effect ?? '').toString().toUpperCase();
    for (const r of results) {
      if (isResultMeaningful(effType, r)) hasMeaningful = true;
      if (checkShieldAmount && effType === 'SHIELD') {
        const amt = r.shieldAmount ?? r.shield ?? 0;
        if (amt <= 0) shieldAmountOk = false;
      }
    }
  }
  if (totalTargets === 0) {
    return { ok: false, reason: 'Aucune cible (0 résultat dans tous les effets)' };
  }
  if (!hasMeaningful) {
    return { ok: false, reason: 'Résultats présents mais tous à 0 ou non appliqués' };
  }
  if (checkShieldAmount && !shieldAmountOk) {
    return { ok: false, reason: 'SHIELD appliqué mais shieldAmount <= 0' };
  }
  return { ok: true, reason: null };
}

/** Vérifie qu'une attaque a bien touché un shield (absorption). */
function hasShieldAbsorptionInEvents(events, firstSkillActorIndex) {
  const skillEv = events.find((e) => e.type === 'skill' && (e.actor === firstSkillActorIndex || e.actorId === firstSkillActorIndex));
  if (!skillEv) return false;
  const skillIdx = events.indexOf(skillEv);
  const after = events.slice(skillIdx + 1);
  return after.some((e) => e.type === 'attack' && (e.shieldBefore ?? 0) > 0);
}

/**
 * Construit teamA et teamB selon le type de test (1v1, 3v3, STRIP, HEAL, lowDef).
 */
function buildTeams(unitRow, skill) {
  const mainUnit = buildUnitForSimulation(unitRow);
  const exclude = shouldExcludeFromActiveTest(skill);
  const multiTarget = !exclude && needsMultiTargetSimulation(skill);
  const stripTest = !exclude && hasStripEffect(skill);
  const healTest = !exclude && hasHealEffect(skill);
  const shieldTest = !exclude && hasShieldEffect(skill);
  const lowDef = !exclude && hasLowMultDamage(skill);

  let teamA = [mainUnit];
  let teamB = [];
  const dummyOpts = {};
  if (lowDef) dummyOpts.lowDef = true;
  if (healTest) {
    dummyOpts.highSpeed = true;
    dummyOpts.highAttack = true;
  }

  if (stripTest) {
    teamB = [createEnemyBuffer(), createDummyEnemy(dummyOpts)];
  } else if (multiTarget) {
    teamA = [mainUnit, createFillerAlly(), createFillerAlly()];
    teamB = [createDummyEnemy(dummyOpts), createDummyEnemy(dummyOpts), createDummyEnemy(dummyOpts)];
  } else {
    teamB = [createDummyEnemy(dummyOpts)];
  }

  return { teamA, teamB, shieldTest };
}

/**
 * Simule et retourne { skillEvent, anomaly, detail, events }.
 */
function runSimulation(unitRow, skill) {
  const { teamA, teamB, shieldTest } = buildTeams(unitRow, skill);

  let log;
  try {
    log = simulateBattle(teamA, teamB, { seed: 42, maxRounds: 5, maxActions: 25 });
  } catch (err) {
    return {
      skillEvent: null,
      anomaly: true,
      detail: `Erreur simulation: ${err.message}`,
      events: []
    };
  }

  const events = log?.events ?? [];
  const firstActionOfUnit0 = events.find((e) => e.actor === 0 || e.actorId === 0);
  if (!firstActionOfUnit0) {
    return {
      skillEvent: null,
      anomaly: true,
      detail: "Aucune action enregistrée pour l'unité (index 0)",
      events
    };
  }

  if (firstActionOfUnit0.type !== 'skill') {
    return {
      skillEvent: null,
      anomaly: true,
      detail: `Pas d'event SKILL (type reçu: ${firstActionOfUnit0.type ?? '?'})`,
      events
    };
  }

  const effectsResultsByTarget = firstActionOfUnit0.effectsResultsByTarget;
  const valid = hasValidResults(effectsResultsByTarget, { checkShieldAmount: shieldTest });
  if (!valid.ok) {
    return {
      skillEvent: firstActionOfUnit0,
      anomaly: true,
      detail: valid.reason,
      events
    };
  }

  if (shieldTest) {
    const absorbed = hasShieldAbsorptionInEvents(events, 0);
    if (!absorbed) {
      return {
        skillEvent: firstActionOfUnit0,
        anomaly: true,
        detail: 'SHIELD appliqué mais aucune absorption détectée à l\'attaque suivante',
        events
      };
    }
  }

  return {
    skillEvent: firstActionOfUnit0,
    anomaly: false,
    detail: null,
    events
  };
}

async function main() {
  const rows = await query(
    `SELECT id, code, name, base_hp, base_attack, base_defense, base_speed, mastery,
            traits, skill_data, element, archetype, attack_type
     FROM units
     WHERE code NOT LIKE 'BOSS_%'
     ORDER BY name`
  );

  const reportRows = [];
  const advancedRows = [];

  for (const r of rows) {
    const skillData = parseJson(r.skill_data);
    const skill = getSkillObject(skillData);
    const unitName = r.name ?? r.code ?? '(sans nom)';
    const hasSkillWithEffects = !!(skill && Array.isArray(skill.effects) && skill.effects.length > 0);
    const excluded = shouldExcludeFromActiveTest(skill);

    const sim = runSimulation(r, skill);

    if (excluded) {
      reportRows.push({
        name: unitName,
        anomaly: 'Exclu',
        detail: 'PASSIVE / sans effets actifs / trigger onAttack-onDeath'
      });
      advancedRows.push({
        name: unitName,
        status: 'exclu',
        detail: 'Non testé (PASSIVE ou effets à trigger)'
      });
      continue;
    }

    if (sim.anomaly) {
      reportRows.push({ name: unitName, anomaly: 'Oui', detail: sim.detail ?? '—' });
      advancedRows.push({ name: unitName, status: 'anomalie', detail: sim.detail ?? '—' });
    } else if (!hasSkillWithEffects) {
      reportRows.push({
        name: unitName,
        anomaly: 'Non (pas d’effets déclarés)',
        detail: 'Unité sans skill.effects'
      });
      advancedRows.push({ name: unitName, status: 'ok', detail: 'OK (legacy/fallback)' });
    } else {
      reportRows.push({ name: unitName, anomaly: 'Non', detail: 'OK — event SKILL avec résultats valides' });
      advancedRows.push({ name: unitName, status: 'ok', detail: 'OK' });
    }
  }

  const sep = '|';
  const header = ['Nom unité', 'Anomalie', 'Détail'];
  const line = (arr) => sep + arr.map((c) => ` ${String(c).replace(/\|/g, ' ').replace(/\n/g, ' ')} `).join(sep) + sep;

  console.log('\n=== SIMULATION — Toutes les unités ===\n');
  console.log(line(header));
  console.log(sep + header.map(() => '---').join(sep) + sep);
  for (const row of reportRows) {
    console.log(line([row.name, row.anomaly, row.detail]));
  }
  const anomalyCount = reportRows.filter((x) => x.anomaly === 'Oui').length;
  const excludedCount = reportRows.filter((x) => x.anomaly === 'Exclu').length;
  console.log('\nTotal unités:', rows.length);
  console.log('Exclues:', excludedCount);
  console.log('Anomalies:', anomalyCount);

  const md = [
    '# Rapport de simulation — Toutes les unités',
    '',
    'Exclusions : PASSIVE, skills sans effets actifs, triggers onAttack/onDeath. 3v3 pour DAMAGE_MULTI/count>1. STRIP avec buff factice. HEAL avec caster blessé. SHIELD avec vérification absorption. DAMAGE mult<1 avec dummy DEF basse.',
    '',
    '| Nom unité | Anomalie | Détail |',
    '|-----------|----------|--------|',
    ...reportRows.map(
      (row) =>
        `| ${row.name} | ${row.anomaly} | ${(row.detail ?? '').replace(/\|/g, ' ').replace(/\n/g, ' ')} |`
    )
  ].join('\n');
  writeFileSync(join(process.cwd(), 'SIMULATION_REPORT.md'), md, 'utf8');

  const advancedMd = [
    '# Rapport de simulation avancé',
    '',
    'Règles : exclu PASSIVE/effets à trigger. 3v3 si DAMAGE_MULTI ou count>1. STRIP : buff sur cible avant test. HEAL : PV caster réduits. SHIELD : shieldAmount>0 + absorption. DAMAGE mult<1 : dummy DEF basse.',
    '',
    '| Nom unité | Statut | Détail |',
    '|-----------|--------|--------|',
    ...advancedRows.map(
      (row) =>
        `| ${row.name} | ${row.status} | ${(row.detail ?? '').replace(/\|/g, ' ').replace(/\n/g, ' ')} |`
    )
  ].join('\n');
  writeFileSync(join(process.cwd(), 'SIMULATION_REPORT_ADVANCED.md'), advancedMd, 'utf8');

  console.log('\nRapports écrits : SIMULATION_REPORT.md, SIMULATION_REPORT_ADVANCED.md');

  // --- Passifs : tests ON_ATTACK, ON_DEATH ---
  const passiveRows = [];
  const SUPPORTED_TRIGGERS = ['ON_ATTACK', 'ON_HIT', 'ON_DEATH', 'ON_KILL', 'ON_ACTION_START', 'ON_ACTION_END', 'ON_RECEIVE_DAMAGE', 'ON_DEAL_DAMAGE'];

  function getUnitPassives(skillData) {
    if (!skillData || typeof skillData !== 'object') return [];
    const top = Array.isArray(skillData.passives) ? skillData.passives : [];
    const fromSkill = Array.isArray(skillData.skill?.passives) ? skillData.skill.passives : [];
    const raw = top.length ? top : fromSkill;
    return raw.map((p) => {
      const t = (p.trigger ?? p.type ?? '').toString().toUpperCase();
      const trigger = t === 'SELF_RESURRECT' ? 'ON_DEATH' : t;
      return {
        trigger: SUPPORTED_TRIGGERS.includes(trigger) ? trigger : t,
        effects: Array.isArray(p.effects) ? p.effects : (p.effect ? [p.effect] : [])
      };
    }).filter((p) => p.trigger && (SUPPORTED_TRIGGERS.includes(p.trigger) || p.trigger === 'SELF_RESURRECT'));
  }

  for (const r of rows) {
    const skillData = parseJson(r.skill_data);
    const passives = getUnitPassives(skillData);
    const unitName = r.name ?? r.code ?? '(sans nom)';
    if (passives.length === 0) {
      passiveRows.push({ name: unitName, triggers: '—', status: '—', detail: 'Aucun passif' });
      continue;
    }
    const triggers = [...new Set(passives.map((p) => p.trigger))].join(', ');

    // Test ON_ATTACK : unit doit faire une attaque de base (skill en cd pour forcer basic).
    const hasOnAttack = passives.some((p) => p.trigger === 'ON_ATTACK');
    let onAttackOk = null;
    if (hasOnAttack) {
      const unitForSim = buildUnitForSimulation(r, { speed: 500 });
      unitForSim.skill_data = skillData && typeof skillData === 'object' ? { ...skillData, skill: skillData.skill ? { ...skillData.skill, cd_actions: 99 } : { type: 'GENERIC', cd_actions: 99, effects: [{ type: 'DAMAGE', mult: 1 }] } } : null;
      const teamA = [unitForSim];
      const teamB = [createDummyEnemy()];
      try {
        const log = simulateBattle(teamA, teamB, { seed: 42, maxRounds: 5, maxActions: 15 });
        const events = log?.events ?? [];
        const hasBasicAttack = events.some((e) => e.type === 'attack' && (e.actor === 0 || e.actorId === 0));
        const hasPassiveOnAttack = events.some((e) => e.type === 'passive' && (e.passiveType === 'ON_ATTACK' || e.passiveType === 'onAttack'));
        onAttackOk = hasBasicAttack ? hasPassiveOnAttack : 'no_basic_attack';
      } catch (err) {
        onAttackOk = false;
      }
    }

    // Test ON_DEATH (résurrection) : ennemi très fort tue notre unité, on vérifie résurrection.
    const hasOnDeath = passives.some((p) => p.trigger === 'ON_DEATH' || p.trigger === 'SELF_RESURRECT' || p.effects?.some((e) => (e?.type ?? '').toString().toUpperCase() === 'RESURRECT'));
    let onDeathOk = null;
    if (hasOnDeath) {
      const unitForSim = buildUnitForSimulation(r, { speed: 1 });
      const killer = {
        ...createDummyEnemy(),
        base_attack: 9999,
        base_speed: 600
      };
      killer.name = 'Killer';
      const teamA = [unitForSim];
      const teamB = [killer];
      try {
        const log = simulateBattle(teamA, teamB, { seed: 42, maxRounds: 5, maxActions: 20 });
        const events = log?.events ?? [];
        const hasPassiveDeath = events.some((e) => e.type === 'passive' && (e.passiveType === 'ON_DEATH' || e.passiveType === 'SELF_RESURRECT'));
        const hasResurrect = events.some((e) => e.type === 'passive' && e.effect === 'RESURRECT');
        onDeathOk = hasPassiveDeath || hasResurrect;
      } catch (err) {
        onDeathOk = false;
      }
    }

    let status = '—';
    let detail = '';
    if (hasOnAttack && hasOnDeath) {
      status = (onAttackOk === true ? 'ON_ATTACK ✓' : `ON_ATTACK ${onAttackOk === false ? '✗' : '?'}`) + ', ' + (onDeathOk ? 'ON_DEATH ✓' : 'ON_DEATH ✗');
      detail = [onAttackOk === true ? '' : 'ON_ATTACK non déclenché ou pas d’attaque de base', onDeathOk ? '' : 'ON_DEATH/RESURRECT non détecté'].filter(Boolean).join('; ') || 'OK';
    } else if (hasOnAttack) {
      status = onAttackOk === true ? 'OK' : (onAttackOk === false ? 'Échec' : '?');
      detail = onAttackOk === true ? 'ON_ATTACK déclenché' : (onAttackOk === false ? 'ON_ATTACK non déclenché' : 'Pas d’attaque de base observée');
    } else if (hasOnDeath) {
      status = onDeathOk ? 'OK' : 'Échec';
      detail = onDeathOk ? 'ON_DEATH/RESURRECT détecté' : 'ON_DEATH non déclenché';
    }

    passiveRows.push({ name: unitName, triggers, status, detail: detail || '—' });
  }

  const passiveMd = [
    '# Rapport de simulation — Passifs',
    '',
    'Tests des passifs ON_ATTACK (après attaque de base) et ON_DEATH (résurrection).',
    '',
    '| Nom unité | Triggers | Statut | Détail |',
    '|-----------|----------|--------|--------|',
    ...passiveRows.map(
      (row) =>
        `| ${row.name} | ${row.triggers} | ${row.status} | ${(row.detail ?? '').replace(/\|/g, ' ').replace(/\n/g, ' ')} |`
    )
  ].join('\n');
  writeFileSync(join(process.cwd(), 'PASSIVE_SIMULATION_REPORT.md'), passiveMd, 'utf8');
  console.log('Rapport passifs écrit : PASSIVE_SIMULATION_REPORT.md');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
