# Audit exhaustif — Actions et effets du moteur de combat

**Périmètre :** `core/combatEngine.js`, `core/effects.js`, `core/targeting.js`, `core/synergies.js`, `core/atb.js`, `backend/src/services/battleTeamService.js`, `backend/src/services/campaignService.js`, données DB (skills / debuffType).

---

## 1. Actions d’intention possibles

| Action | Où c’est déclenché | Cible | Loggé (event) | Loggé (battleLog) |
|--------|---------------------|--------|----------------|-------------------|
| **Attaque normale** | `performBasicAction` (combatEngine.js ~479) | 1 ennemi (ou provoker si PROVOKE) | Oui `type: 'attack', actionType: 'BASIC'` | Oui `basic_attack` |
| **Utilisation de skill** | `performSkillAction` (combatEngine.js ~632) | Selon skill / effects / resolveTargets | Oui `type: 'skill'` ou `type: 'attack', actionType: 'SKILL'` | Oui (par effet : shield, debuff, heal, atb_up, skill_damage) |
| **Pass / forcé basic** | Boucle principale (combatEngine.js ~1249) : `hasProvoke(actor)` → pas de skill | Ennemi (provoker) uniquement | Inclus dans l’attaque basic qui suit | Oui comme `basic_attack` |
| **Mort** | Conséquence des dégâts (hp ≤ 0), pas d’action volontaire | — | Non (pas d’event dédié) | Oui `actionType: 'death'` après l’attack qui tue |
| **Résurrection (passive)** | `applyDamageToTarget` (combatEngine.js ~432) : passive `SELF_RESURRECT` | Self | Oui `type: 'passive', passiveType: 'SELF_RESURRECT'` | Non (pas d’entrée battleLog) |
| **Résurrection (effet)** | `applySkillEffect` case `RESURRECT` (combatEngine.js ~159) | Allié mort (ALLY_DEAD_SINGLE) | Inclus dans event skill avec effects | Non (pas d’entrée battleLog dédiée) |
| **Contre-attaque** | `onAfterDamage` (combatEngine.js ~79) si cible a COUNTER_ATTACK | Source des dégâts | Oui via `performBasicAction` (event attack) | Oui comme `basic_attack` |
| **Début de tour** | Synthétique dans `buildBattleLog` | — | — | Oui `turn_start` |
| **Fin de combat** | Synthétique dans `buildBattleLog` | — | — | Oui `battle_end` |

---

## 2. Types de skills (`skill.type`)

| Type | Fichier / ligne | Cible possible | Résistable | Loggé (event) | Loggé (battleLog) |
|------|------------------|----------------|------------|----------------|-------------------|
| **GENERIC** | combatEngine.js ~638 (branch `skill.effects`) | Selon `effects[].target` (SELF, ENEMY_SINGLE, TEAM_ENEMY, etc.) | Par effet (ex. APPLY_DEBUFF → immunité) | Oui `type: 'skill'`, `effectsResultsByTarget` | Oui par effet (shield, debuff, buff, atb_up, heal si présent) |
| **DAMAGE_SINGLE** | combatEngine.js ~690 | 1 ennemi (chooseTarget) | Oui (invincibilité, miss) | Oui `type: 'attack', actionType: 'SKILL'` | Oui `skill_damage` |
| **SHIELD_SELF** | combatEngine.js ~752 | Self | Non | Oui `type: 'skill'` + value | Oui `shield` |
| **APPLY_DEBUFF** | combatEngine.js ~772 | 1 ennemi (chooseTarget) | Oui (IMMUNITY, boss immune si config) | Oui `type: 'skill'` + appliedDebuff/duration | Oui `debuff` |

---

## 3. Types d’effets dans `skill.effects[]` (`applySkillEffect`)

| effect.type | Fichier / ligne | Cible (resolveTargets) | Résistable | Loggé (event) | Loggé (battleLog) |
|-------------|-----------------|-------------------------|------------|----------------|-------------------|
| **APPLY_DEBUFF** | combatEngine.js ~136 | cfg.target (ex. ENEMY_SINGLE, RANDOM_ANY, TEAM_ENEMY) | Oui (IMMUNITY) | Oui dans skill event | Oui `debuff` (ou résisté) |
| **STRIP** | combatEngine.js ~151 | Déduit de resolveTargets | Non | Oui dans skill event (results) | Non (aucune entrée dédiée) |
| **REDUCE_ATB** | combatEngine.js ~155 | Déduit de resolveTargets | Oui (IMMUNITY sur target) | Oui dans skill event | Non (aucune entrée dédiée) |
| **RESURRECT** | combatEngine.js ~159 | ALLY_DEAD_SINGLE ou type RESURRECT | Non | Oui dans skill event | Non |
| **ATB_UP** | combatEngine.js ~164 | SELF / ALLY_SINGLE / etc. | Non | Oui dans skill event | Oui `atb_up` |
| **APPLY_BUFF** | combatEngine.js ~171 | Selon cfg.target | Non | Oui dans skill event | Oui `buff` |
| **SHIELD** | combatEngine.js ~185 | Selon cfg.target (souvent allié) | Réduction par ANTI_SHIELD (stats) | Oui dans skill event | Oui `shield` |
| **DEFEND** | combatEngine.js ~191 | Allié (meta.targetUid) | Non | Oui dans skill event | Non (aucune entrée dédiée) |
| **default** | combatEngine.js ~205 | — | — | Oui (applied: false) | Non |

**Note :** Il n’existe pas de case **HEAL** dans `applySkillEffect`. Les soins viennent des synergies (LIFESTEAL, DRUIDS SELF_REGEN) ou d’un futur effet HEAL non implémenté ici.

---

## 4. Debuffs / Buffs (EffectType et usage)

### 4.1 Définis dans `core/effects.js` (EffectType)

| Type | Utilisation principale | Cible typique | Résistable (application) | Loggé (battleLog) |
|------|-------------------------|---------------|---------------------------|-------------------|
| **SILENCE** | Boss silenceEveryNActions (combatEngine.js ~1283), DRUIDS cleanse | Ennemis (boss) / alliés (cleanse) | N/A (appliqué par script) | Non (BOSS_TRIGGER non détaillé) |
| **PROVOKE** | targeting.js hasProvoke, chooseTarget, getProvokerUnit ; DB (APPLY_DEBUFF debuffType: PROVOKE) | Ennemi | Oui (IMMUNITY) | Oui comme debuff si via skill |
| **ATK_DOWN** | getStatModifiers (effects.js ~108), DB | Ennemi / zone | Oui (IMMUNITY) | Oui comme debuff |
| **ATK_UP** | getStatModifiers | Allié | Non | Oui comme buff |
| **DEF_DOWN** | getStatModifiers, DB | Ennemi | Oui (IMMUNITY) | Oui comme debuff |
| **DEF_UP** | getStatModifiers | Allié | Non | Oui comme buff |
| **SHIELD** | applyShield, synergies (GUARDIANS, ARCANISTS) | Allié / self | Réduction par ANTI_SHIELD | Oui `shield` |
| **ANTI_SHIELD** | getStatModifiers (shieldAntiMul), DB, DRUIDS cleanse | Ennemi | Oui (IMMUNITY) | Oui comme debuff |
| **HEAL_BONUS** | getStatModifiers (healMul) | Allié | Non | — |
| **ANTI_HEAL** | getStatModifiers (healReceiveMul), DB, DRUIDS cleanse | Ennemi | Oui (IMMUNITY) | Oui comme debuff |
| **ATB_UP** | applySkillEffect, synergies (TACTICIANS, EXECUTIONERS) | Allié / self | Non | Oui `atb_up` ou via synergie |
| **ATB_DOWN** | getStatModifiers (non utilisé en dégâts ici) | — | — | — |
| **SLOW** | getStatModifiers (speedMul), DB | Ennemi | Oui (IMMUNITY) | Oui comme debuff |
| **SPEED** | getStatModifiers | Allié | Non | Oui comme buff |
| **IMMUNITY** | onBeforeApplyDebuff, onBeforeReduceAtb (combatEngine.js ~59–69) | — | N/A (bloque debuff/ATB) | — |
| **COUNTER_ATTACK** | onAfterDamage (combatEngine.js ~79) | — | N/A | Oui (contre-attaque = attack) |
| **RESURRECT** | applySkillEffect, targeting ALLY_DEAD_SINGLE | Allié mort | Non | Non |
| **INVINCIBILITY** | onBeforeDamage (combatEngine.js ~74) | — | N/A (bloque dégâts) | — |
| **BLIND** | getStatModifiers (blindChance), computeBasicDamage, DB, DRUIDS cleanse | Ennemi | Oui (IMMUNITY) | Oui comme debuff |
| **DEFEND** | findDefendProtector, applySkillEffect case DEFEND | Allié | Non | Non (redirect loggé en event seulement) |

### 4.2 DebuffType utilisés en base (exemples)

Présents dans les patches / seeds : **DEF_DOWN**, **ATK_DOWN**, **SLOW**, **ANTI_BUFF**, **ANTI_HEAL**, **ANTI_SHIELD**, **PROVOKE**.  
**ANTI_BUFF** n’est pas dans `EffectType` ; il est utilisé comme chaîne dans les données (skill_data) et passé à `applyStatus` via `cfg.debuffType || cfg.debuff || cfg.type`. Le moteur l’accepte comme type de status.

---

## 5. Passifs (unit.passives)

| passive.type | Fichier / ligne | Déclencheur | Cible | Loggé (event) | Loggé (battleLog) |
|--------------|-----------------|-------------|--------|----------------|-------------------|
| **SELF_RESURRECT** | combatEngine.js ~432 (applyDamageToTarget) | Mort (hp ≤ 0) | Self | Oui `type: 'passive', passiveType: 'SELF_RESURRECT'` | Non |
| **ON_ATTACK** | combatEngine.js ~598 (performBasicAction) | Après une attaque basic | Cible de l’attaque | Oui `type: 'passive', passiveType: 'ON_ATTACK'` | Non |

---

## 6. Événements système et synergies

| Event type | subType / détail | Fichier / ligne | Loggé (event) | Loggé (battleLog) |
|------------|-------------------|-----------------|----------------|-------------------|
| **redirect** | DEFEND | combatEngine.js ~401 | Oui | Non |
| **passive** | SELF_RESURRECT, ON_ATTACK | combatEngine.js ~444, ~602 | Oui | Non |
| **BOSS_TRIGGER** | phase2, shieldEveryNActions, silenceEveryNActions | combatEngine.js ~463, ~1273, ~1286 | Oui | Non (ignoré dans buildBattleLog sauf lastRound) |
| **SYNERGY_TRIGGER** | LIFESTEAL | combatEngine.js ~576 | Oui | Oui `heal` |
| **SYNERGY_TRIGGER** | FRONTLINE_SHIELD, START_ATB_BOOST, FIRST_ACTOR_BOOST_SLOWEST, SELF_REGEN, PERIODIC_CLEANSE, POST_SKILL_SHIELD, FIRST_KILL_ATB_BOOST | synergies.js | Oui | Non (aucune entrée battleLog) |

---

## 7. Ciblage (resolveTargets / chooseTarget)

Clés utilisées : **SELF**, **RESURRECTED**, **TEAM_ENEMY**, **ENEMY_SINGLE**, **RANDOM_ENEMY**, **LOWEST_HP_ENEMY**, **HIGHEST_ATK_ENEMY**, **HIGHEST_SPEED_ENEMY**, **TEAM_ALLY**, **ALLY_SINGLE**, **RANDOM_ALLY**, **LOWEST_HP_ALLY**, **HIGHEST_HP_ALLY**, **RANDOM_ANY**, **ALLY_DEAD_SINGLE** (implicite pour RESURRECT).  
+ **PROVOKE** : force la cible sur le provoker (chooseTarget / resolveTargets).

---

## 8. Tableau récapitulatif (TYPE | Origine | Cible | Résistable | Loggé)

| TYPE | Origine | Cible | Résistable | Loggé (battleLog) |
|------|---------|--------|------------|-------------------|
| basic_attack | performBasicAction | Ennemi (ou provoker) | Oui (miss, invincibilité) | Oui |
| skill_damage | performSkillAction (DAMAGE_SINGLE) | Ennemi | Oui | Oui |
| skill (GENERIC) | performSkillAction (effects[]) | Selon effet | Selon effet | Oui (décomposé en effets) |
| shield | SHIELD_SELF ou effect SHIELD | Self / allié | ANTI_SHIELD (stats) | Oui |
| heal | SYNERGY_TRIGGER LIFESTEAL (ou effet si ajouté) | Self (lifesteal) | Non | Oui (LIFESTEAL uniquement) |
| debuff | APPLY_DEBUFF (skill ou effect) | Ennemi / any | Oui (IMMUNITY) | Oui |
| buff | APPLY_BUFF | Allié / self | Non | Oui |
| atb_up | ATB_UP effect | Allié / self | Non | Oui |
| death | Conséquence dégâts | — | — | Oui |
| turn_start | buildBattleLog | — | — | Oui |
| battle_end | buildBattleLog | — | — | Oui |
| STRIP | applySkillEffect | Cible skill | Non | Non |
| REDUCE_ATB | applySkillEffect | Cible skill | Oui (IMMUNITY) | Non |
| RESURRECT | applySkillEffect | Allié mort | Non | Non |
| DEFEND | applySkillEffect | Allié | Non | Non (redirect loggé en event) |
| SELF_RESURRECT | Passive | Self | Non | Non |
| ON_ATTACK | Passive | Cible attaque | Selon effet | Non |
| BOSS_TRIGGER (phase2, shield, silence) | Boss mod | Joueur / boss | N/A | Non |
| SYNERGY (FRONTLINE_SHIELD, START_ATB_BOOST, …) | synergies.js | Équipe / unité | N/A | Non (sauf LIFESTEAL) |
| Contre-attaque | onAfterDamage + COUNTER_ATTACK | Source des dégâts | Oui (comme basic) | Oui (basic_attack) |

---

## 9. Effets définis mais peu ou pas loggés / non utilisés en skill

- **STRIP** : implémenté dans `applySkillEffect`, pas d’entrée battleLog ; usage en DB non vérifié.
- **REDUCE_ATB** : idem, pas d’entrée battleLog.
- **RESURRECT** (effet skill) : pas d’entrée battleLog.
- **DEFEND** (effet skill) : pas d’entrée battleLog ; seul le redirect est en event.
- **HEAL** : aucun case HEAL dans `applySkillEffect` ; soins uniquement via synergies (LIFESTEAL, SELF_REGEN).
- **ATB_DOWN** : dans EffectType et getStatModifiers, pas de branche dans le moteur ATB actuel (avancement ATB non réduit par stat).
- **IMMUNITY**, **INVINCIBILITY** : utilisés en vérification (blocage debuff/dégâts), pas appliqués par les skills vus en DB ; applicables via APPLY_DEBUFF/APPLY_BUFF si les données le prévoient.
- **BOSS_TRIGGER** (tous subTypes) et **SYNERGY_TRIGGER** (sauf LIFESTEAL) : pas convertis en entrées battleLog.
- **passive** (SELF_RESURRECT, ON_ATTACK) : pas d’entrées battleLog.
- **redirect** (DEFEND) : pas d’entrée battleLog.

---

## 10. Résumé

- **Actions d’intention** : attaque normale, skill (GENERIC / DAMAGE_SINGLE / SHIELD_SELF / APPLY_DEBUFF), pass (PROVOKE), mort, résurrection (passive + effet), contre-attaque. Début/fin de tour sont synthétiques dans le log.
- **Effets skills** : APPLY_DEBUFF, STRIP, REDUCE_ATB, RESURRECT, ATB_UP, APPLY_BUFF, SHIELD, DEFEND. Pas de HEAL direct dans `applySkillEffect`.
- **EffectType** : 20 types (dont IMMUNITY, INVINCIBILITY, COUNTER_ATTACK, DEFEND) ; tous peuvent être appliqués via APPLY_DEBUFF/APPLY_BUFF si les données le prévoient.
- **Loggé dans battleLog** : basic_attack, skill_damage, shield, heal (LIFESTEAL), debuff, buff, atb_up, death, turn_start, battle_end. Non loggés : STRIP, REDUCE_ATB, RESURRECT, DEFEND, passifs, BOSS_TRIGGER, autres SYNERGY_TRIGGER, redirect.

Ce document peut servir de base pour refondre le système de logs (quels events convertir en entrées battleLog, quels libellés, etc.).
