# Audit technique — Pipeline Skills (sans modification de code)

**Date :** 2026-02-26  
**Périmètre :** merge des spé, effets (APPLY_DEBUFF, ATB_UP, REDUCE_ATB, RESURRECT, PASSIVE, SELF_RESURRECT, ON_ATTACK, STRIP), cibles, ordre des effets, RNG.  
**Contrainte :** audit uniquement, aucune modification.

---

## 1. Audit du merge des spécialisations

### Où le skill est chargé

- **DB → équipe :** `backend/src/services/battleTeamService.js` — `buildTeamFromDb` charge `u.skill_data`, `u.specA_skill_modifier`, `u.specB_skill_modifier` depuis la DB et les attache à chaque unité.
- **Application de la spé :** dans `buildTeamFromDb`, après construction de l’unité et avant `computeScaledStats` :
  - si `specialization === 'A'` et `specA_skill_modifier` est un objet :  
    `unit.skill_data = deepMergeSkill(unit.skill_data, unit.specA_skill_modifier)` ;
  - si `specialization === 'B'` : idem avec `specB_skill_modifier`.
- **Moteur :** `core/combatEngine.js` (moteur complet à la racine du projet). Dans `simulateBattle`, chaque unité reçoit :
  - `skill: normalizeSkill(u.skill || u.skillData || u.skill_data)`.

Donc le skill “chargé” par le moteur est **tout l’objet `skill_data`** (après merge), pas uniquement `skill_data.skill`.  
`normalizeSkill` renvoie l’objet tel quel s’il est un objet (pas de déréférencement de `.skill`). Donc **`actor.skill` = `{ skill: {...}, description: {...}, noyau?: ... }`**, alors que le moteur suppose **`actor.skill` = `{ type, effects, cd_actions, ... }`** (objet skill “plat”).  
Conséquence : la branche `if (Array.isArray(skill.effects) && skill.effects.length > 0)` est **jamais prise** avec la structure actuelle des données, car `skill.effects` est `undefined` (les effets sont dans `skill.skill.effects`).

### Où sont appliqués specA_skill_modifier / specB_skill_modifier

- Uniquement dans **`battleTeamService.buildTeamFromDb`**, avant le calcul des stats, via `deepMergeSkill(unit.skill_data, unit.specA_skill_modifier)` ou `specB_skill_modifier`.
- Le moteur ne lit ni `specA_skill_modifier` ni `specB_skill_modifier` ; il ne reçoit que l’unité déjà “mergée”.

### Shallow ou deep ?

- **Merge shallow (un seul niveau).**  
  `deepMergeSkill` fait :
  ```js
  return { ...baseObj, ...modObj };
  ```
  Donc une seule fusion au niveau racine de `skill_data`. Pas de fusion récursive des sous-objets.

### Peut-on ajouter un effet sans supprimer les autres ?

- **Non**, avec le merge actuel.  
  Pour “ajouter” un effet (ex. Druide Marin Spé B : ajouter ATB_UP en plus du SLOW), le modifier doit fournir une clé `skill` **complète** qui remplace entièrement `base.skill`.  
  Si on fait `specB_skill_modifier = { skill: { type: 'GENERIC', cd_actions: 3, effects: [ SLOW, ATB_UP ] } }`, alors après merge, `skill_data.skill` = ce nouvel objet et les deux effets sont bien présents.  
  En revanche, on ne peut pas faire un merge “deep” du tableau `effects` (par ex. push d’un effet) : il n’existe pas de logique qui fusionne `base.skill.effects` avec `mod.skill.effects`.

### Peut-on modifier seulement remainingActions ou chance sans écraser le reste ?

- **Modifier uniquement au niveau racine de `skill_data` : oui**, si le moteur lisait ces champs.  
  Ex. `specA_skill_modifier = { chance: 0.75 }` → après merge, `skill_data.chance === 0.75`.  
  Mais `remainingActions` est **à l’intérieur** d’un effet dans `skill.effects[0]`. Un merge shallow ne permet pas de modifier uniquement `effects[0].remainingActions` sans fournir tout `skill` (ou tout `effects`).  
  Donc en pratique : **modifier seulement `remainingActions` ou `chance` d’un effet sans réécrire tout le `skill` (ou tout le tableau `effects`) : non** avec le merge actuel.

### Exemple concret — Druide Marin (ajout ATB_UP en Spé B)

- En base : `skill_data.skill.effects` = `[ { APPLY_DEBUFF SLOW ... } ]`.
- Spé B : `specB_skill_modifier` = `{ skill: { type: 'GENERIC', cd_actions: 3, effects: [ { ...SLOW... }, { type: 'ATB_UP', percent: 0.15 } ] } }`.
- Après merge shallow : `skill_data.skill` est **remplacé** par l’objet du modifier. On obtient bien deux effets (SLOW + ATB_UP).  
  Donc **l’ajout d’un effet est possible uniquement en fournissant le `skill` complet dans le modifier**, pas par fusion de tableaux.

---

## 2. Audit du routing des cibles

### Où la cible est déterminée

- **Branche GENERIC (effets) :** `performSkillAction` appelle **une seule fois** `chooseTarget(state.units, actor)` puis applique **tous** les effets à cette **même** cible :
  ```js
  const target = chooseTarget(state.units, actor);
  for (const eff of skill.effects) {
    const res = applySkillEffect(state, actor, target, eff);
  }
  ```
- **`chooseTarget`** (`core/targeting.js`) : filtre `u.side !== actor.side && u.hp > 0`, puis applique provocation, front/back, rangeType melee/ranged. **Retourne toujours une seule unité ennemie.** Il n’existe **aucune** résolution de cible selon `eff.target` (TEAM_ENEMY, TEAM_ALLY, ALLY_SINGLE, RESURRECTED).

### Vérification par type de cible

| Target           | Où c’est censé être utilisé | Supporté ? | Détail |
|------------------|-----------------------------|------------|--------|
| **TEAM_ENEMY**   | Effet appliqué à chaque ennemi | **NON** | Une seule cible via `chooseTarget` (un ennemi). Aucune boucle sur “tous les ennemis”. |
| **TEAM_ALLY**    | Effet appliqué à chaque allié  | **NON**   | Aucune résolution “équipe alliée”. |
| **ALLY_SINGLE**  | Ex. RESURRECT 1 allié         | **NON**   | La cible passée à `applySkillEffect` est celle de `chooseTarget` = **ennemi**. Pour RESURRECT, il faudrait cibler un allié mort. |
| **RESURRECTED**  | Cible = unité qu’on vient de ressusciter | **NON** | Aucun lien entre l’effet RESURRECT et un effet ATB_UP ciblant “la même unité ressuscitée”. Pas de variable “last resurrected”. |
| (implicite ennemi) | Ciblage classique skill       | Oui       | `chooseTarget` retourne 1 ennemi. |

### ignoreTargetingRules

- Dans les **données** (ex. seeds/patch), les effets ont `ignoreTargetingRules: true` pour pouvoir cibler “n’importe quelle unité”.
- Dans le **moteur** : **non respecté**. `chooseTarget` est appelé sans aucun paramètre `effect` ou `ignoreTargetingRules`. La cible est toujours un ennemi selon les règles CAC/distance/provocation. Il n’y a pas de branche “si ignoreTargetingRules, choisir parmi toutes les unités (ou un allié)”.

**Synthèse :** Seul le ciblage “un ennemi” (sans distinction TEAM / ALLY / RESURRECTED) est supporté. TEAM_ENEMY, TEAM_ALLY, ALLY_SINGLE, RESURRECTED et ignoreTargetingRules sont **non supportés**.

---

## 3. Audit des types d’effets

### APPLY_DEBUFF

- **Handler :** `applySkillEffect` → `case 'APPLY_DEBUFF'` : appel à `onBeforeApplyDebuff` puis `applyStatus(..., isDebuff: true)`.
- **Chance :** Oui. En tête de `applySkillEffect`, `if (cfg.chance !== undefined)` puis `rollChance(state, cfg.chance)` ; si échec, retour `{ applied: false, missedByChance: true }`.
- **IMMUNITY :** Oui. `onBeforeApplyDebuff` utilise `targetHasStatus(target, EffectType.IMMUNITY)` ; si oui, `return { blocked: true }` et `applySkillEffect` retourne `{ applied: false, immune: true }`.
- **TEAM :** Non. Une seule cible (ennemi). Pas de boucle TEAM_ENEMY/TEAM_ALLY.

### ATB_UP

- **Handler dédié :** **Non.** Dans `applySkillEffect`, il n’y a pas de `case 'ATB_UP'`. Seuls sont gérés : APPLY_DEBUFF, STRIP, REDUCE_ATB, RESURRECT. Les autres tombent dans `default: return { applied: false }`.
- **Intégration au log :** N/A (effet non exécuté).
- **Conclusion : ATB_UP est non supporté** dans le pipeline effets GENERIC.

### REDUCE_ATB

- **Handler :** `applySkillEffect` → `case 'REDUCE_ATB'` appelle `applyReduceAtb(state, actor, target, cfg.percent)`.
- **applyReduceAtb :** fait `onBeforeReduceAtb(target)` (IMMUNITY), puis `target.atb = Math.max(0, before - amount)`. Donc **oui**, passage par une fonction dédiée.
- **IMMUNITY :** Oui. `onBeforeReduceAtb` bloque si la cible a IMMUNITY.

### RESURRECT

- **Handler :** `applySkillEffect` → `case 'RESURRECT'` appelle `resurrectUnit(target, cfg.percent || 0.3)`.
- **Fonctionnement :** `resurrectUnit(unit, percentHP)` remet `unit.hp` à un pourcentage de maxHp, `unit.atb = 0`, vide buffs/debuffs. Donc **oui** pour la logique “ressusciter une unité”.
- **Cible :** La cible passée est celle de `chooseTarget` = **un ennemi vivant**. Pour RESURRECT, il faudrait une cible **allié mort** (ALLY_SINGLE parmi les morts). Donc **non** : le ciblage actuel est inadapté (on ne peut pas désigner un allié mort comme cible de la skill).
- **ATB reset :** Oui, `unit.atb = 0` dans `resurrectUnit`.

### PASSIVE

- **Exécution des passifs :** Dans `simulateBattle`, `state.passives[u.uid] = u.specPassive` est rempli à partir de `u.specPassive` (passifs de spé), **pas** à partir de `skill_data.skill.passives` (structure type `skill: { type: 'PASSIVE', passives: [ ... ] }`).
- Aucun code ne parcourt `actor.skill?.passives` ni n’exécute des passifs de type SELF_RESURRECT ou ON_ATTACK.
- **Conclusion :** Le type de skill **PASSIVE** avec un tableau `passives` (SELF_RESURRECT, ON_ATTACK, etc.) est **non supporté**. Seuls les passifs “spec” (specPassive) sont stockés dans `state.passives`, et encore sans être exécutés dans ce fichier pour SELF_RESURRECT/ON_ATTACK.

### SELF_RESURRECT

- **Déclenchement à la mort :** Aucun hook “on unit death” qui vérifierait un passif SELF_RESURRECT ou un CD et appellerait `resurrectUnit(actor, ...)`. Donc **non supporté**.
- **CD du passif :** Aucune structure pour stocker ou décrémenter un CD par passif (ex. `cd_actions` pour SELF_RESURRECT).

### ON_ATTACK

- **Hook attaque :** Dans `performBasicAction`, après `applyDamageToTarget`, il n’y a pas d’appel à un handler “ON_ATTACK” ou “après attaque”. Les synergies (ex. BERSERKERS lifesteal) sont gérées en dur, pas via une config d’effet ON_ATTACK.
- **STRIP après dégâts :** STRIP n’est invoqué que dans `applySkillEffect` (skill active), pas après une attaque de base. Donc **STRIP sur ON_ATTACK : non supporté**.
- **Plusieurs déclenchements :** N/A (mécanisme absent).

### STRIP

- **Handler :** `applySkillEffect` → `case 'STRIP'` appelle `applyStrip(state, target, cfg.count || 1)`.
- **applyStrip :** utilise `state?.rng || Math.random` pour choisir l’index du buff à retirer. Donc **si `state.rng` est fourni, c’est déterministe** ; sinon Math.random.
- **Appliqué correctement au target :** Oui pour une skill avec effets (si la branche GENERIC était utilisée avec la bonne forme de `actor.skill`).

---

## 4. Audit de l’ordre des effets

- Dans la branche GENERIC, les effets sont traités dans l’ordre du tableau :
  ```js
  for (const eff of skill.effects) {
    const res = applySkillEffect(state, actor, target, eff);
    results.push(res);
  }
  ```
  Donc **ordre du tableau respecté**.

- **Effet 1 modifie DEF, effet 2 fait DMG :** Les modificateurs de stats (buff/debuff) sont lus dans `getStatModifiers(target)` (ex. pour dégâts). Si un effet précédent a appliqué un debuff (ex. DEF_DOWN), les dégâts du suivant utiliseront la DEF modifiée **à condition** que ce soit le même `target` et que les deux effets soient dans la même skill. Pour une skill GENERIC avec plusieurs effets, oui, c’est séquentiel sur la même cible.

- **DMG puis debuff :** Si le premier effet faisait des dégâts et le second appliquait un debuff, l’ordre est bien DMG puis debuff. Pas de problème de séquence pour une même cible.

- **Limitation :** Aujourd’hui une seule cible pour toute la skill. Donc pas de “effet 1 sur A, effet 2 sur B” ; l’ordre ne s’applique qu’à une seule cible.

---

## 5. Audit du déterminisme RNG

- **rollChance :** utilise `state?.rng || Math.random`. Si le moteur est appelé avec `config.seed`, `state.rng = createRng(seed)` est défini. Donc **oui**, les chances (ex. APPLY_DEBUFF) utilisent un RNG seedé lorsque seed est fourni.

- **STRIP :** `applyStrip` utilise `state?.rng || Math.random` pour l’index du buff à retirer. Donc **oui** si `state.rng` est présent.

- **ATB_UP / REDUCE_ATB :** Pas de tirage aléatoire dans ces handlers ; pas de RNG. Déterministes.

- **Résumé :** Dès que `config.seed` est fourni, `state.rng` est créé et utilisé par rollChance et applyStrip. Il n’y a pas de `Math.random()` utilisé en dehors de ces cas (sauf fallback si `state.rng` absent). Donc **RNG déterministe** pour les effets qui en utilisent, sous réserve que le moteur reçoive bien un seed.

---

## 6. Résumé tableau

| Feature | Supporté | Partiellement | Non supporté | Commentaire |
|--------|----------|---------------|--------------|-------------|
| Merge spé (shallow) | ✅ | | | Remplace toute clé (ex. `skill`) ; pas de merge deep. |
| Merge spé (ajout effet) | | ✅ | | Possible en fournissant tout `skill` dans le modifier. |
| Merge spé (modif 1 champ dans effet) | | | ❌ | Impossible sans réécrire tout `skill` ou tout `effects`. |
| Structure skill (skill_data.skill vs skill plat) | | | ❌ | Moteur attend `actor.skill` plat ; reçoit `{ skill, description }` → GENERIC jamais pris. |
| Cible TEAM_ENEMY | | | ❌ | Une seule cible ennemi. |
| Cible TEAM_ALLY | | | ❌ | Non implémenté. |
| Cible ALLY_SINGLE | | | ❌ | chooseTarget = ennemi uniquement. |
| Cible RESURRECTED | | | ❌ | Pas de notion “dernière unité ressuscitée”. |
| ignoreTargetingRules | | | ❌ | Non lu par le moteur. |
| APPLY_DEBUFF (chance, IMMUNITY) | ✅ | | | OK. TEAM non. |
| ATB_UP | | | ❌ | Pas de case dans applySkillEffect. |
| REDUCE_ATB (+ IMMUNITY) | ✅ | | | OK. |
| RESURRECT (logique) | ✅ | | | OK. |
| RESURRECT (cible allié mort) | | | ❌ | Cible = ennemi. |
| PASSIVE (type skill) | | | ❌ | Passifs skill non exécutés. |
| SELF_RESURRECT | | | ❌ | Aucun hook mort / CD passif. |
| ON_ATTACK (STRIP, ATB_UP…) | | | ❌ | Aucun hook “après attaque”. |
| STRIP | ✅ | | | OK (RNG seedé si state.rng). |
| Ordre des effets | ✅ | | | Séquentiel sur une cible. |
| RNG seedé (rollChance, STRIP) | ✅ | | | OK si config.seed. |

---

## 7. Conclusion

### Le moteur est-il prêt à recevoir les 100 unités ?

**Non.** Plusieurs blocages majeurs :

1. **Forme de `actor.skill` :** Le moteur suppose `actor.skill = { type, effects, cd_actions, ... }`. En pratique, après `buildTeamFromDb` et `simulateBattle`, `actor.skill` = tout `skill_data` (avec `.skill` et `.description`). La branche GENERIC à effets n’est donc jamais exécutée. Il faut soit que le build d’équipe expose `unit.skill = skill_data.skill`, soit que le moteur utilise `actor.skill?.skill ?? actor.skill` pour la logique (type, effects, cd).
2. **Cibles :** TEAM_ENEMY, TEAM_ALLY, ALLY_SINGLE, RESURRECTED et ignoreTargetingRules ne sont pas gérés ; une seule cible ennemi par skill.
3. **ATB_UP** absent du switch des effets.
4. **PASSIVE / SELF_RESURRECT / ON_ATTACK** non branchés (pas d’exécution des `skill.passives`, pas de hook mort, pas de hook après attaque).

### Points à corriger en priorité

1. **Alignement structure skill :** S’assurer que le moteur reçoit (ou dérive) un objet skill “plat” (`type`, `effects`, `cd_actions`) pour que la branche GENERIC s’exécute.
2. **Résolution des cibles par effet :** En fonction de `eff.target` (TEAM_ENEMY, ALLY_SINGLE, etc.), résoudre la ou les cibles et appeler `applySkillEffect` pour chaque cible concernée (et pour RESURRECT, cibler un allié mort si ALLY_SINGLE).
3. **Implémenter ATB_UP** dans `applySkillEffect` (et éventuellement target RESURRECTED = dernière unité ressuscitée dans le même tour).
4. **PASSIVE / SELF_RESURRECT / ON_ATTACK :** Décider où exécuter les passifs (init combat, à la mort, après basic attack) et brancher la lecture de `skill.passives` + CD et triggers.

**Note :** Les routes battle/campaign importent `simulateBattle` depuis `../../core/combatEngine.js`. Selon la structure du projet (backend/src vs racine), ce chemin peut pointer vers `backend/core/combatEngine.js` (stub) ou vers le moteur complet à la racine. Si c’est le stub, aucun de la logique ci-dessus ne s’exécute en production ; il faudra alors aussi basculer l’import sur le moteur complet.
