# Extraction moteur de combat — code brut (dead units)

---

## 1️⃣ BOUCLE PRINCIPALE DU COMBAT

### core/combatEngine.js (l.1262–1379)

```javascript
  while (actions < maxActions && rounds < maxRounds) {
    rounds += 1;

    for (;;) {
      const resultBefore = isBattleFinished(state.units);
      if (resultBefore) {
        const playerAlive = state.units.filter((u) => u.side === 'A' && u.alive !== false).length;
        const enemyAlive = state.units.filter((u) => u.side === 'B' && u.alive !== false).length;
        log.summary = {
          winner: resultBefore,
          reason: 'all_units_down',
          totalRounds: rounds,
          totalActions: actions,
          totalTurns: rounds,
          playerUnitsAlive: playerAlive,
          enemyUnitsAlive: enemyAlive
        };
        log.battleLog = buildBattleLog(state, log);
        return log;
      }

      advanceAtb(state.units);

      const actor = pickNextActor(state.units);
      if (!actor) {
        const resultAfter = isBattleFinished(state.units);
        if (resultAfter) {
          const playerAlive = state.units.filter((u) => u.side === 'A' && u.alive !== false).length;
          const enemyAlive = state.units.filter((u) => u.side === 'B' && u.alive !== false).length;
          log.summary = {
            winner: resultAfter,
            reason: 'all_units_down',
            totalRounds: rounds,
            totalActions: actions,
            totalTurns: rounds,
            playerUnitsAlive: playerAlive,
            enemyUnitsAlive: enemyAlive
          };
          log.battleLog = buildBattleLog(state, log);
          return log;
        }
        continue;
      }
      if (!actor.alive || actor.hp <= 0) {
        actor.atb = 0;
        if (state.logEvent) {
          state.logEvent(state, { type: 'skip_dead', actorId: actor.combatIndex ?? actor.uid });
        }
        continue;
      }

      const atbBefore = actor.atb;

      onUnitActionStartSynergies(state, actor, (e) => logEvent(state, e));

      const usedSkill = shouldUseSkill(actor) && !hasProvoke(actor);
      if (usedSkill) {
        const result = performSkillAction(state, actor, rounds, atbBefore, logEvent);
        if (!result) {
          performBasicAction(state, actor, rounds, atbBefore, rng, logEvent);
        }
      } else {
        performBasicAction(state, actor, rounds, atbBefore, rng, logEvent);
      }

      if (state.bossUid && actor.uid === state.bossUid) {
        state.counters.bossActions = (state.counters.bossActions || 0) + 1;
        const mod = state.bossModifier;
        const n = state.counters.bossActions;
        if (mod?.shieldEveryNActions?.n != null) {
          const period = Number(mod.shieldEveryNActions.n);
          if (period > 0 && n % period === 0) {
            const bossUnit = state.units.find((u) => u.uid === state.bossUid);
            if (bossUnit) {
              const pct = Number(mod.shieldEveryNActions.pctMaxHp ?? 0.2);
              const shieldVal = Math.round((bossUnit.maxHp || 1) * pct);
              const res = applyShield(bossUnit, shieldVal);
              logEvent(state, { type: 'BOSS_TRIGGER', subType: 'shieldEveryNActions', unit: state.bossUid, value: res?.applied ?? shieldVal });
            }
          }
        }
        if (mod?.silenceEveryNActions?.n != null) {
          const period = Number(mod.silenceEveryNActions.n);
          const duration = Number(mod.silenceEveryNActions.duration ?? 2);
          if (period > 0 && n % period === 0) {
            for (const u of state.units) {
              if (u.side === 'A') {
                applyEffect(u, { type: EffectType.SILENCE, value: 0, remainingActions: duration, isDebuff: true });
              }
            }
            logEvent(state, { type: 'BOSS_TRIGGER', subType: 'silenceEveryNActions', unit: state.bossUid, duration });
          }
        }
      }

      const result = isBattleFinished(state.units);
      if (result) {
        const playerAlive = state.units.filter((u) => u.side === 'A' && u.alive !== false).length;
        const enemyAlive = state.units.filter((u) => u.side === 'B' && u.alive !== false).length;
        log.summary = {
          winner: result,
          reason: 'all_units_down',
          totalRounds: rounds,
          totalActions: actions,
          totalTurns: rounds,
          playerUnitsAlive: playerAlive,
          enemyUnitsAlive: enemyAlive
        };
        log.battleLog = buildBattleLog(state, log);
        return log;
      }

      break;
    }
  }
```

### core/combatEngine.js — isBattleFinished (l.309–316)

```javascript
function isBattleFinished(units) {
  const aliveA = units.some((u) => u.side === 'A' && u.alive !== false);
  const aliveB = units.some((u) => u.side === 'B' && u.alive !== false);
  if (aliveA && aliveB) return null;
  if (aliveA && !aliveB) return 'A';
  if (!aliveA && aliveB) return 'B';
  return 'draw';
}
```

### core/atb.js — initializeAtb (l.18–29)

```javascript
export function initializeAtb(units) {
  const alive = units.filter((u) => u.alive !== false);
  const maxSpeed = alive.reduce((max, u) => (u.speed > max ? u.speed : max), 1);
  for (const u of units) {
    if (!u.alive) {
      u.atb = 0;
      continue;
    }
    const spd = u.speed || 1;
    u.atb = (100 * spd) / maxSpeed;
  }
}
```

### core/atb.js — advanceAtb (l.31–56)

```javascript
export function advanceAtb(units) {
  const alive = units.filter((u) => u.alive !== false);
  const waiting = alive.filter((u) => u.atb < 100);

  if (waiting.length === 0) {
    return;
  }

  let t = Infinity;
  for (const u of waiting) {
    const spd = u.speed || 1;
    const remaining = 100 - u.atb;
    const ti = remaining / spd;
    if (ti < t) t = ti;
  }

  if (!Number.isFinite(t) || t <= 0) {
    return;
  }

  for (const u of units) {
    if (!u.alive) continue;
    const spd = u.speed || 1;
    u.atb += spd * t;
  }
}
```

### core/atb.js — pickNextActor (l.58–71)

```javascript
export function pickNextActor(units) {
  const alive = units.filter((u) => u.alive !== false && u.atb >= 100);
  if (!alive.length) return null;

  alive.sort((a, b) => {
    const overflowA = a.atb - 100;
    const overflowB = b.atb - 100;
    if (overflowB !== overflowA) return overflowB - overflowA;
    if (b.speed !== a.speed) return b.speed - a.speed;
    return a.orderIndex - b.orderIndex;
  });

  return alive[0];
}
```

### core/combatEngine.js — performSkillAction début (l.688–749, extrait boucle effets + log)

```javascript
function performSkillAction(state, actor, round, atbBefore, logEventFn) {
  const skillContainer = actor.skill;
  const skill = skillContainer?.skill ?? skillContainer;
  if (!skill) return false;
  if (!actor.alive) return false;

  let event = null;

  if (Array.isArray(skill.effects) && skill.effects.length > 0) {
    const allTargetUids = [];
    const effectsResultsByTarget = [];

    for (const eff of skill.effects) {
      const targetKey = eff.target != null ? String(eff.target).toUpperCase() : '';
      const targets = targetKey === 'SELF' ? [actor] : resolveTargets(state, actor, eff);
      const effectResults = [];
      for (const target of targets) {
        if (!target.alive && eff.type !== 'RESURRECT') continue;
        const res = applySkillEffect(state, actor, target, eff);
        effectResults.push({ targetUid: target.uid, targetName: target.name, targetSide: target.side, ...res });
        if (!allTargetUids.includes(target.uid)) allTargetUids.push(target.uid);
      }
      effectsResultsByTarget.push({ ... });
    }

    const atbAfterActor = (actor.atb -= 100);
    event = { type: 'skill', ... };
    logEventFn(state, event);
    ...
    setUnitHp(actor, actor.hp, state);
    return true;
  }
  ...
}
```

### core/combatEngine.js — performBasicAction début (l.528–574)

```javascript
function performBasicAction(state, actor, arg2, arg3, arg4, arg5, options = {}) {
  ...
  if (!actor.alive) return;

  let target = forcedTarget;
  if (!target) {
    ...
    target = chooseTarget(state.units, actor, { state });
  }

  if (!target) return;

  const damageInfo = computeBasicDamage(state, actor, target, rng);
  const damageResult = applyDamageToTarget(state, actor, target, damageInfo.finalDamage, {
    isCounter: !!opts.isCounter
  });
  ...
}
```

### core/targeting.js — chooseTarget (l.36–67)

```javascript
export function chooseTarget(units, actor, options = {}) {
  const enemies = units.filter((u) => u.side !== actor.side && u.alive !== false);
  if (!enemies.length) return null;
  ...
}
```

### core/targeting.js — resolveTargets début (l.92–93)

```javascript
export function resolveTargets(state, actor, cfg) {
  if (!actor?.alive) return [];
  ...
}
```

---

## 2️⃣ FONCTION D’APPLICATION DES DÉGÂTS

### core/combatEngine.js — clampHp (l.384–387)

```javascript
function clampHp(unit) {
  unit.hp = Math.max(0, Math.floor(unit.hp));
}
```

### core/combatEngine.js — killUnit (l.393–401)

```javascript
function killUnit(unit, state) {
  if (!unit.alive) return;
  unit.alive = false;
  unit.hp = 0;
  if (typeof unit.atb === 'number') unit.atb = 0;
  if (state?.logEvent) {
    state.logEvent(state, { type: 'ko', targetId: unit.uid, targetCombatIndex: unit.combatIndex });
  }
}
```

### core/combatEngine.js — setUnitHp (l.406–423)

```javascript
function setUnitHp(unit, newHp, state) {
  const prevAlive = unit.alive;
  unit.hp = newHp;
  clampHp(unit);

  if (unit.hp <= 0) {
    killUnit(unit, state);
  } else {
    if (!prevAlive) {
      unit.alive = true;
      if (typeof unit.atb === 'number') unit.atb = 0;
      if (state?.logEvent) {
        state.logEvent(state, { type: 'revive', targetId: unit.uid, amount: unit.hp });
      }
    }
  }
}
```

### core/combatEngine.js — applyDamageToTarget (l.425–527)

```javascript
function applyDamageToTarget(state, actor, target, baseFinalDamage, extraContext = {}) {
  if (!actor?.alive) {
    return { hpBefore: 0, hpAfter: 0, shieldBefore: 0, shieldAfter: 0, effectiveDamage: 0 };
  }
  if (!target?.alive) {
    return { hpBefore: target?.hp ?? 0, hpAfter: target?.hp ?? 0, shieldBefore: 0, shieldAfter: 0, effectiveDamage: 0 };
  }
  const pre = onBeforeDamage(target, { state, actor, baseFinalDamage, ...extraContext });
  if (pre.blocked) {
    const shieldBefore = target.shield ?? 0;
    const hpBefore = target.hp;
    const result = {
      hpBefore,
      hpAfter: hpBefore,
      shieldBefore,
      shieldAfter: shieldBefore,
      effectiveDamage: 0
    };
    onAfterDamage(actor, target, 0, { state, actor, baseFinalDamage, prevented: true, ...extraContext });
    return result;
  }

  let actualTarget = target;
  const defender = findDefendProtector(state, target);
  if (defender && defender.uid !== target.uid) {
    if (state.logEvent) {
      state.logEvent(state, {
        type: 'redirect',
        reason: 'DEFEND',
        from: target.uid,
        to: defender.uid
      });
    }
    actualTarget = defender;
  }

  let dmg = baseFinalDamage;
  const mod = state.bossModifier;
  const isBossTarget = state.bossUid != null && actualTarget.uid === state.bossUid;
  if (isBossTarget && mod?.damageReductionPct != null) {
    dmg = Math.max(0, Math.round(dmg * (1 - Number(mod.damageReductionPct))));
  }
  const shieldBefore = actualTarget.shield ?? 0;
  let remainingDamage = dmg;
  let shieldAfter = shieldBefore;
  if (remainingDamage > 0 && shieldBefore > 0) {
    const absorbed = Math.min(shieldBefore, remainingDamage);
    shieldAfter -= absorbed;
    remainingDamage -= absorbed;
  }
  const hpBefore = actualTarget.hp;
  const hpDamage = Math.min(actualTarget.hp, remainingDamage);
  setUnitHp(actualTarget, actualTarget.hp - hpDamage, state);
  actualTarget.shield = shieldAfter;

  let selfResurrected = false;
  if (!actualTarget.alive && Array.isArray(actualTarget.passives)) {
    const selfRes = actualTarget.passives.find((p) => p && String(p.type).toUpperCase() === 'SELF_RESURRECT');
    if (selfRes) {
      const cdKey = 'SELF_RESURRECT';
      const cd = actualTarget.passiveCooldowns?.[cdKey];
      if (cd === undefined || cd === 0) {
        const pct = selfRes.percentHP ?? selfRes.percent ?? 0.3;
        if (resurrectUnit(state, actualTarget, pct)) {
          actualTarget.passiveCooldowns = actualTarget.passiveCooldowns || {};
          actualTarget.passiveCooldowns[cdKey] = selfRes.cd_actions ?? 5;
          selfResurrected = true;
          if (state.logEvent) {
            state.logEvent(state, { type: 'passive', passiveType: 'SELF_RESURRECT', unit: actualTarget.uid, hpAfter: actualTarget.hp });
          }
        }
      }
    }
  }

  if (isBossTarget && mod?.atbOnHit?.amount != null) {
    actualTarget.atb = Math.min(100, (actualTarget.atb ?? 0) + Number(mod.atbOnHit.amount));
  }
  ...
  const result = {
    hpBefore,
    hpAfter: actualTarget.hp,
    shieldBefore,
    shieldAfter,
    effectiveDamage: hpDamage,
    selfResurrected
  };
  onAfterDamage(actor, actualTarget, result.effectiveDamage, { state, actor, baseFinalDamage, ...extraContext });
  return result;
}
```

---

## 3️⃣ GESTION DU STATUT alive / hp <= 0

### core/combatEngine.js — création des unités (l.1187–1209)

```javascript
  const units = [...teamA, ...teamB].map((u, idx) => {
    const rawSkill = u.skill || u.skillData || u.skill_data;
    const innerSkill = rawSkill && typeof rawSkill === 'object' ? (rawSkill.skill ?? rawSkill) : null;
    const passives = Array.isArray(innerSkill?.passives) ? innerSkill.passives : [];
    const hp = u.maxHp ?? 0;
    const alive = hp > 0;
    return {
      ...u,
      uid: `${u.side}-${idx}`,
      combatIndex: idx,
      orderIndex: idx,
      hp,
      atb: alive ? 0 : 0,
      alive,
      buffs: [],
      debuffs: [],
      ...
    };
  });
```

### core/combatEngine.js — écritures de hp / alive

- **clampHp** (l.386): `unit.hp = Math.max(0, Math.floor(unit.hp));`
- **killUnit** (l.395–396): `unit.alive = false;` puis `unit.hp = 0;`
- **setUnitHp** (l.409, 416): `unit.hp = newHp;` puis éventuellement `unit.alive = true;` (revive)

### core/combatEngine.js — resurrectUnit (l.675–686)

```javascript
function resurrectUnit(state, unit, percentHP = 0.3) {
  if (!unit || unit.alive) return false;
  const maxHp = unit.maxHp || unit.base_hp || 0;
  if (maxHp <= 0) return false;
  const newHp = Math.max(1, Math.floor(maxHp * percentHP));
  setUnitHp(unit, newHp, state);
  unit.atb = 0;
  unit.buffs = [];
  unit.debuffs = [];
  if (state) state.lastResurrectedUnit = unit;
  return true;
}
```

### core/combatEngine.js — applySkillEffect gardes (l.127–130)

```javascript
function applySkillEffect(state, actor, target, effectConfig) {
  const cfg = effectConfig || {};
  if (!actor.alive) return { applied: false };
  if (cfg.type !== 'RESURRECT' && !target.alive) return { applied: false };
  ...
}
```

### core/combatEngine.js — applyDamageToTarget gardes (l.426–430)

```javascript
  if (!actor?.alive) {
    return { hpBefore: 0, hpAfter: 0, shieldBefore: 0, shieldAfter: 0, effectiveDamage: 0 };
  }
  if (!target?.alive) {
    return { hpBefore: target?.hp ?? 0, hpAfter: target?.hp ?? 0, shieldBefore: 0, shieldAfter: 0, effectiveDamage: 0 };
  }
```

### core/targeting.js — getProvokerUnit (l.26)

```javascript
  if (!provoker || provoker.side === unit.side || provoker.hp <= 0) return null;
```

### core/synergies.js — écritures directes hp (fallback si pas state.setUnitHp)

- l.138: `else u.hp = u.maxHp;` (DRUIDS 2)
- l.255: `else actor.hp = newHp;` (DRUIDS 4 regen)
