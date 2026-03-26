// Gestion des synergies 2/4/6 (traits sur les unités).
//
// Traits supportés (tags dans unit.traits) :
// - GUARDIANS
// - BERSERKERS
// - EXECUTIONERS
// - ARCANISTS
// - DRUIDS
// - TACTICIANS

import { EffectType, applyShield, applyEffect } from './effects.js';

export function computeSynergyLevels(units) {
  const counts = new Map();
  for (const u of units) {
    if (!u.traits) continue;
    for (const t of u.traits) {
      counts.set(t, (counts.get(t) || 0) + 1);
    }
  }
  const levels = {};
  for (const [trait, count] of counts.entries()) {
    let lvl = 0;
    if (count >= 6) lvl = 6;
    else if (count >= 4) lvl = 4;
    else if (count >= 2) lvl = 2;
    if (lvl > 0) levels[trait] = lvl;
  }
  return levels;
}

export function applyPreBattleSynergies(state) {
  const teamA = state.units.filter((u) => u.side === 'A');
  const teamB = state.units.filter((u) => u.side === 'B');

  state.synergies = {
    A: computeSynergyLevels(teamA),
    B: computeSynergyLevels(teamB)
  };

  applyGuardianBonuses(state);
  applyBerserkerBonuses(state);
  applyExecutionerBonuses(state);
  applyArcanistBonuses(state);
  applyDruidBonuses(state);
  applyTacticianBonuses(state);

  // Compteurs / flags runtime
  state.counters = state.counters || {};
  state.counters.druidCleanseTicks = {};
}

function getLevels(state, side, trait) {
  return state.synergies?.[side]?.[trait] ?? 0;
}

function forSide(state, side, cb) {
  for (const u of state.units) {
    if (u.side === side) cb(u);
  }
}

function applyGuardianBonuses(state) {
  ['A', 'B'].forEach((side) => {
    const lvl = getLevels(state, side, 'GUARDIANS');
    if (!lvl) return;
    forSide(state, side, (u) => {
      if (lvl >= 2) {
        u.defense = Math.round(u.defense * 1.1);
      }
      if (lvl >= 6) {
        u.damageTakenMul = (u.damageTakenMul || 1) * 0.9;
      }
    });
  });
}

function applyBerserkerBonuses(state) {
  ['A', 'B'].forEach((side) => {
    const lvl = getLevels(state, side, 'BERSERKERS');
    if (!lvl) return;
    forSide(state, side, (u) => {
      if (lvl >= 2) {
        u.attack = Math.round(u.attack * 1.1);
      }
      if (lvl >= 4) {
        u.lifestealPercent = Math.max(u.lifestealPercent || 0, 0.05);
      }
      if (lvl >= 6) {
        // Sera utilisé par le système de compétences : premier BASIC après SKILL
        u.berserkerHasSkillBonus = false;
      }
    });
  });
}

function applyExecutionerBonuses(state) {
  ['A', 'B'].forEach((side) => {
    const lvl = getLevels(state, side, 'EXECUTIONERS');
    if (!lvl) return;
    forSide(state, side, (u) => {
      u.executionerLevel = lvl;
    });
  });
}

function applyArcanistBonuses(state) {
  ['A', 'B'].forEach((side) => {
    const lvl = getLevels(state, side, 'ARCANISTS');
    if (!lvl) return;
    forSide(state, side, (u) => {
      u.arcanistLevel = lvl;
      if (lvl >= 2) {
        u.mastery = Math.round((u.mastery || 0) * 1.1);
      }
      if (lvl >= 6 && u.skill) {
        // Réduction CD de 1 action (min 1) — u.skill (pas u.skills)
        const skill = u.skill?.skill ?? u.skill;
        if (skill && typeof skill === 'object') {
          const baseCd = skill.cd_actions ?? 1;
          skill.cd_actions = Math.max(1, baseCd - 1);
        }
      }
    });
  });
}

function applyDruidBonuses(state) {
  ['A', 'B'].forEach((side) => {
    const lvl = getLevels(state, side, 'DRUIDS');
    if (!lvl) return;
    forSide(state, side, (u) => {
      u.druidLevel = lvl;
      // DRUIDS 2 : +5 % PV max (vitalité nature), équipe démarre à ce nouveau max
      if (lvl >= 2) {
        u.maxHp = Math.round(u.maxHp * 1.05);
        state.setUnitHp(u, u.maxHp);
      }
    });
  });
}

function applyTacticianBonuses(state) {
  ['A', 'B'].forEach((side) => {
    const lvl = getLevels(state, side, 'TACTICIANS');
    if (!lvl) return;
    forSide(state, side, (u) => {
      if (lvl >= 2) {
        u.speed = Math.round(u.speed * 1.05);
      }
    });
  });

  state.flags.tacticianFirstAllyActed = { A: false, B: false };
  state.flags.tacticianTeamBoostApplied = { A: false, B: false };
}

// === Hooks runtime appelés par le moteur de combat ===

export function applyStartOfBattleRuntimeEffects(state, logEvent) {
  // GUARDIANS 4 : bouclier léger sur frontline
  ['A', 'B'].forEach((side) => {
    const lvl = getLevels(state, side, 'GUARDIANS');
    if (lvl < 4) return;
    const shieldPct = 0.12;
    forSide(state, side, (u) => {
      if (u.position !== 'front' || !u.alive) return;
      const base = u.maxHp * shieldPct;
      const { applied, shieldBefore, shieldAfter } = applyShield(u, base);
      if (applied <= 0) return;
      logEvent({
        type: 'SYNERGY_TRIGGER',
        trait: 'GUARDIANS',
        level: lvl,
        side,
        subType: 'FRONTLINE_SHIELD',
        unit: u.combatIndex,
        value: applied,
        shieldBefore,
        shieldAfter
      });
    });
  });

  // Artefact IMMUNE : l'unité équipée commence avec le buff IMMUNITE pour 1 tour
  for (const u of state.units) {
    if (!u.alive) continue;
    const artifacts = u.equipped_artifacts || [];
    const hasImmuneArtifact = artifacts.some((a) => String(a?.stat_key || a?.statKey || '').toLowerCase() === 'immune');
    if (hasImmuneArtifact) {
      applyEffect(u, {
        type: EffectType.IMMUNITY,
        buffType: EffectType.IMMUNITY,
        remainingActions: 1,
        sourceId: 'artifact_immune'
      });
      logEvent({
        type: 'ARTIFACT_TRIGGER',
        artifact: 'immune',
        unit: u.combatIndex,
        buffType: EffectType.IMMUNITY,
        duration: 1
      });
    }
  }

  // TACTICIANS 6 : +20% ATB à toute l'équipe (après init ATB)
  ['A', 'B'].forEach((side) => {
    const lvl = getLevels(state, side, 'TACTICIANS');
    if (lvl < 6) return;
    forSide(state, side, (u) => {
      if (!u.alive) return;
      const before = u.atb;
      u.atb = before + 20;
      logEvent({
        type: 'SYNERGY_TRIGGER',
        trait: 'TACTICIANS',
        level: lvl,
        side,
        subType: 'START_ATB_BOOST',
        unit: u.combatIndex,
        atbBefore: before,
        atbAfter: u.atb
      });
    });
  });
}

export function onUnitActionStartSynergies(state, actor, logEvent) {
  const side = actor.side;
  const tacticianLevel = getLevels(state, side, 'TACTICIANS');
  if (tacticianLevel >= 4 && !state.flags.tacticianFirstAllyActed[side]) {
    state.flags.tacticianFirstAllyActed[side] = true;
    let slowest = null;
    forSide(state, side, (u) => {
      if (!u.alive) return;
      if (!slowest || u.speed < slowest.speed) slowest = u;
    });
    if (slowest) {
      const before = slowest.atb;
      slowest.atb = before + 30;
      state.flags.tacticianTeamBoostApplied[side] = true;
      logEvent({
        type: 'SYNERGY_TRIGGER',
        trait: 'TACTICIANS',
        level: tacticianLevel,
        side,
        subType: 'FIRST_ACTOR_BOOST_SLOWEST',
        source: actor.combatIndex,
        target: slowest.combatIndex,
        atbBefore: before,
        atbAfter: slowest.atb
      });
    }
  }
}

export function onUnitActionEndSynergies(state, actor, logEvent) {
  const side = actor.side;
  const druidLevel = actor.druidLevel || 0;

  // DRUIDS 4 : regen X% PV max à chaque action du druide (uniquement si l'acteur est druide)
  if (druidLevel >= 4 && actor.traits?.includes('DRUIDS')) {
    const regenPct = 0.03;
    const base = Math.round(actor.maxHp * regenPct);
    if (base > 0) {
      const heal = base;
      const before = actor.hp;
      const newHp = Math.min(actor.maxHp, actor.hp + heal);
      state.setUnitHp(actor, newHp);
      logEvent({
        type: 'SYNERGY_TRIGGER',
        trait: 'DRUIDS',
        level: druidLevel,
        side,
        subType: 'SELF_REGEN',
        unit: actor.combatIndex,
        hpBefore: before,
        hpAfter: actor.hp,
        value: heal
      });
    }
  }

  // DRUIDS 6 : cleanse périodique toutes les 2 actions de la cible
  const anyDruidSix = getLevels(state, side, 'DRUIDS') >= 6;
  if (anyDruidSix) {
    const key = actor.uid;
    const counters = state.counters.druidCleanseTicks;
    counters[key] = (counters[key] || 0) + 1;
    if (counters[key] >= 2 && (actor.debuffs && actor.debuffs.length > 0)) {
      counters[key] = 0;
      const priority = [
        EffectType.BLIND,
        EffectType.SILENCE,
        EffectType.SLOW,
        EffectType.ANTI_HEAL,
        EffectType.ANTI_SHIELD,
        EffectType.ANTI_BUFF,
        EffectType.ATK_DOWN,
        EffectType.DEF_DOWN,
        EffectType.PROVOKE,
        EffectType.DOT
      ];
      let removed = null;
      for (const p of priority) {
        const idx = actor.debuffs.findIndex((d) => d.type === p);
        if (idx !== -1) {
          removed = actor.debuffs[idx];
          actor.debuffs.splice(idx, 1);
          break;
        }
      }
      if (removed) {
      logEvent({
        type: 'SYNERGY_TRIGGER',
        trait: 'DRUIDS',
        level: 6,
        side,
        subType: 'PERIODIC_CLEANSE',
        unit: actor.combatIndex,
        removedType: removed.type
      });
      }
    }
  }
}

export function onSkillUsedSynergies(state, actor, logEvent) {
  const side = actor.side;
  const lvl = getLevels(state, side, 'ARCANISTS');
  if (lvl < 4 || !actor.traits?.includes('ARCANISTS')) return;

  const shieldPct = 0.08;
  const base = actor.maxHp * shieldPct;
  const { applied, shieldBefore, shieldAfter } = applyShield(actor, base);
  if (applied <= 0) return;

  logEvent({
    type: 'SYNERGY_TRIGGER',
    trait: 'ARCANISTS',
    level: lvl,
    side,
    subType: 'POST_SKILL_SHIELD',
    unit: actor.combatIndex,
    value: applied,
    shieldBefore,
    shieldAfter
  });
}

export function onKillSynergies(state, killer, victim, logEvent) {
  const side = killer.side;
  // EXECUTIONERS 6 : à chaque élimination par un Bourreau → +40 ATB au tueur (uniquement si le tueur est bourreau)
  if (killer.executionerLevel >= 6 && killer.traits?.includes('EXECUTIONERS')) {
    const before = killer.atb;
    killer.atb = before + 40;
    logEvent({
      type: 'SYNERGY_TRIGGER',
      trait: 'EXECUTIONERS',
      level: 6,
      side,
      subType: 'KILL_ATB_BOOST',
      killer: killer.combatIndex,
      victim: victim.combatIndex,
      atbBefore: before,
      atbAfter: killer.atb
    });
  }
}

