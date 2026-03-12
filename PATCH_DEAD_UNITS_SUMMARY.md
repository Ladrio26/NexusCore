# Patch global unités mortes — résumé

## Fichiers modifiés

| Fichier | Modifications |
|---------|---------------|
| **core/combatEngine.js** | setUnitHp refactor (seul point d’écriture hp/alive), suppression clampHp et killUnit, boucle principale (guard `!actor.alive`, log debug DEAD UNIT ABOUT TO ACT, test HP/ALIVE DESYNC), isBattleFinished et tous les filtres `u.alive !== false` → `u.alive`, findDefendProtector, applyDamageToTarget (guard atbOnHit pour alive), performBasicAction (enemies filter), stateSnapshot (alive) |
| **core/atb.js** | initializeAtb, advanceAtb, pickNextActor : filtres `u.alive !== false` → `u.alive` |
| **core/targeting.js** | getProvokerUnit `provoker.hp <= 0` → `!provoker.alive`, chooseTarget et resolveTargets `u.alive !== false` → `u.alive`, resolveTargets : ajout `allowDead`, `filterAlive()`, tous les retours de cibles passent par `filterAlive()` sauf ALLY_DEAD_SINGLE |
| **core/effects.js** | applyEffect : guard `if (!target.alive) return` en tête, applyHeal / applyShield `target.alive === false` → `!target.alive` |
| **core/synergies.js** | DRUIDS 2 : suppression `else u.hp = u.maxHp`, uniquement `state.setUnitHp(u, u.maxHp)`, GUARDIANS 4 `u.hp <= 0` → `!u.alive`, TACTICIANS 6 `if (!u.alive) return` avant atb, onUnitActionStartSynergies `u.hp <= 0` → `!u.alive`, DRUIDS 4 regen : suppression `else actor.hp = newHp`, uniquement `state.setUnitHp(actor, newHp)` |

---

## Suppressions d’écritures directes sur `hp`

| Fichier | Avant | Après |
|---------|--------|--------|
| **core/combatEngine.js** | clampHp(unit) écrivait `unit.hp = Math.max(0, Math.floor(unit.hp))` ; killUnit écrivait `unit.hp = 0` et `unit.alive = false` | Logique intégrée dans setUnitHp ; plus d’appels à clampHp ni killUnit |
| **core/synergies.js** | `else u.hp = u.maxHp` (DRUIDS 2) | Supprimé, uniquement `state.setUnitHp(u, u.maxHp)` |
| **core/synergies.js** | `else actor.hp = newHp` (DRUIDS 4 regen) | Supprimé, uniquement `state.setUnitHp(actor, newHp)` |

Aucune autre écriture directe sur `hp` dans le projet core (effects.js ne fait que lire `target.hp` pour calculer et retourner `hpAfter` ; le moteur applique via setUnitHp).

---

## Confirmation : plus de `hp <= 0` comme critère de vie

- **Vie** : partout on utilise désormais `u.alive` (ou `!u.alive` pour mort).
- **Fichiers concernés** :
  - **combatEngine.js** : isBattleFinished, boucle principale, findDefendProtector, performBasicAction (enemies), stateSnapshot, applyDamageToTarget (boss atbOnHit) — critère de vie = `u.alive`. La seule utilisation restante de `hp <= 0` est **à l’intérieur de setUnitHp** pour décider d’appeler la logique de mort (alive = false, atb = 0, log ko).
  - **atb.js** : initializeAtb, advanceAtb, pickNextActor — filtres sur `u.alive`.
  - **targeting.js** : getProvokerUnit `!provoker.alive`, chooseTarget et resolveTargets filtrent sur `u.alive`.
  - **effects.js** : applyEffect, applyHeal, applyShield — guards sur `!target.alive`.
  - **synergies.js** : GUARDIANS 4, TACTICIANS 6, onUnitActionStartSynergies — `!u.alive` à la place de `u.hp <= 0`.

- **Log debug** : dans la boucle principale, si `actor.hp <= 0 || !actor.alive` on fait `console.error('DEAD UNIT ABOUT TO ACT', actor)`.
- **Test runtime** : après sélection de l’acteur, `invalidUnits = state.units.filter(u => u.hp > 0 && !u.alive)` ; si `invalidUnits.length > 0` alors `console.error('HP/ALIVE DESYNC', invalidUnits)`.

---

## Règles en vigueur

1. **Unité vivante** : `u.alive === true` uniquement (plus de critère sur `hp` en dehors de setUnitHp).
2. **Modification de hp** : uniquement via `setUnitHp(unit, newHp, state)` (ou `state.setUnitHp(unit, newHp)`).
3. **setUnitHp** : met à jour `unit.hp`, puis si `unit.hp <= 0` met `alive = false`, `atb = 0` et log ko ; sinon `alive = true` et log revive si passage mort → vivant.
4. **Ciblage** : resolveTargets retourne des cibles vivantes sauf si `cfg.targetDead === true` (ex. RESURRECT / ALLY_DEAD_SINGLE).
5. **Acteur** : pickNextActor filtre `u.alive && u.atb >= 100` ; avant d’exécuter un tour, guard `if (!actor.alive) { actor.atb = 0; continue; }`.
