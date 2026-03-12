# Audit moteur — Passifs

## 1. Où sont gérés les passifs ?

### combatEngine.js

| Emplacement | Rôle |
|-------------|------|
| **Lignes 1252-1273** | Construction des unités : `passives` est lu depuis `innerSkill?.passives` (i.e. `skill_data.skill.passives`). Chaque unité reçoit `passives: []` et `passiveCooldowns: {}`. |
| **Lignes 524-540** | Dans `applyDamageToTarget` : quand la cible meurt, recherche d’un passif `p.type === 'SELF_RESURRECT'`. Logique dédiée (percentHP, cd_actions, resurrectUnit). |
| **Lignes 706-712** | Dans `performBasicAction` : après l’attaque de base, boucle sur `actor.passives`, filtre `p.type === 'ON_ATTACK'`, applique `p.effect` via `applySkillEffect`. |
| **Lignes 747-752** | `decrementPassiveCooldowns(unit)` : décrémente les cooldowns stockés dans `unit.passiveCooldowns`. |
| **Lignes 1299-1302** | `state.passives[u.uid] = u.specPassive` : stocke le passif de spé (specA_passive / specB_passive) dans `state.passives`. **Jamais relu** dans la boucle de combat. |

### effects.js

- Aucune gestion spécifique des passifs. Les effets (buffs, debuffs, soins, etc.) sont utilisés par le moteur ; les passifs appellent `applySkillEffect` avec une config d’effet.

### synergies.js

- Aucun passif au sens « trigger + effects ». Synergies par traits (EXECUTIONERS, ARCANISTS, etc.) et `onKillSynergies` sont des mécaniques à part.

### battleTeamService.js (backend)

- **Ligne 253** : `unit.specPassive = spec === 'A' ? unit.specA_passive : unit.specB_passive` — le passif de spé est attaché à l’unité puis enregistré dans `state.passives` par le moteur, mais **le moteur n’exécute jamais `state.passives`**. Donc specA_passive / specB_passive ne sont pas joués en combat.

---

## 2. skill.type === 'PASSIVE' ?

- **Non.** Le moteur ne teste pas `skill.type === 'PASSIVE'`.
- Les passifs sont un **tableau** `unit.passives` (objets avec `type` / `trigger` et `effect` ou champs dédiés), pas un skill unique.

---

## 3. Triggers existants

| Trigger | Supporté ? | Où | Format actuel |
|--------|-------------|-----|----------------|
| **onAttack / ON_ATTACK** | Oui | `performBasicAction` (l.706) | `p.type === 'ON_ATTACK'`, `p.effect` (un seul effet) |
| **onDeath (cible meurt)** | Partiel | `applyDamageToTarget` (l.524) | `p.type === 'SELF_RESURRECT'` : résurrection uniquement, logique en dur (percentHP, cd_actions) |
| **onHit** | Non | — | — |
| **onKill** | Non | — | — |
| **onActionStart** | Non | — | — |
| **onActionEnd** | Non | — | — |
| **onReceiveDamage** | Non | — | — |

---

## 4. Types de passifs supportés

1. **ON_ATTACK**  
   - Un seul effet par passif (`p.effect`).  
   - Appliqué via `applySkillEffect(state, actor, target, p.effect)` après l’attaque de base.  
   - Pas de cooldown géré dans la boucle ON_ATTACK actuelle (seul SELF_RESURRECT utilise un cooldown).

2. **SELF_RESURRECT**  
   - Codé en dur : pas d’utilisation de `applySkillEffect`.  
   - Champs : `percentHP` / `percent`, `cd_actions`.  
   - Équivalent sémantique à un passif **ON_DEATH** (quand la cible est la même que l’acteur) avec effet RESURRECT.

---

## 5. Où vivent les passifs (données)

| Source | Structure | Utilisation moteur |
|--------|-----------|---------------------|
| **skill_data.skill.passives** | `Array<{ type, effect? }>` ou `{ type: 'SELF_RESURRECT', percentHP, cd_actions }` | Oui : chargé en `unit.passives`, exécuté pour ON_ATTACK et SELF_RESURRECT. |
| **skill_data.passives** (top level) | Non utilisé actuellement | Non lu. |
| **specA_passive / specB_passive** | Objet/JSON (affiché en bestiaire) | Enregistré dans `state.passives[uid]` mais **jamais exécuté**. |

Rien n’est codé en dur **par nom d’unité** ; en revanche, **par type de passif** : SELF_RESURRECT a une branche dédiée (résurrection + cooldown) au lieu de passer par un effet générique.

---

## 6. Exemples JSON attendus (état actuel)

### ON_ATTACK (un effet)

```json
{
  "type": "ON_ATTACK",
  "effect": {
    "type": "STRIP",
    "target": "ENEMY_SINGLE",
    "count": 1
  }
}
```

### SELF_RESURRECT

```json
{
  "type": "SELF_RESURRECT",
  "percentHP": 0.3,
  "cd_actions": 5
}
```

### Format actuel de skill_data (côté moteur)

```json
{
  "skill": {
    "type": "GENERIC",
    "cd_actions": 3,
    "effects": [ ... ]
  },
  "description": { "skill": "", "specA": "", "specB": "" }
}
```

Les passifs sont attendus dans `skill.passives` (tableau), pas à la racine de `skill_data`.

---

## 7. Incohérences détectées

1. **Trigger vs type** : Le moteur utilise `p.type` comme trigger (ON_ATTACK, SELF_RESURRECT). Pas de clé `trigger` explicite ; le nom du type sert de trigger.
2. **Un seul effet par passif** : ON_ATTACK n’accepte qu’un `p.effect` (objet), pas un tableau `effects`.
3. **SELF_RESURRECT non générique** : Résurrection et cooldown sont codés en dur au lieu d’utiliser un effet RESURRECT + un cooldown générique.
4. **specA_passive / specB_passive** : Présents en base et exposés au front, mais jamais déclenchés par le moteur.
5. **Cooldown** : Seul SELF_RESURRECT utilise `passiveCooldowns[cdKey]`. ON_ATTACK n’a pas de cooldown unifié (pas de clé par passif).
6. **Source des passifs** : Lecture uniquement depuis `skill_data.skill.passives`, pas depuis `skill_data.passives` (racine).

---

## 8. Recommandation — Format unifié

- **Emplacement** : `skill_data.passives` à la **racine** de `skill_data` (et compatibilité avec `skill_data.skill.passives` en fallback).
- **Structure par passif** :
  - `trigger` : un des triggers officiels (ON_ATTACK, ON_HIT, ON_DEATH, ON_KILL, ON_ACTION_START, ON_ACTION_END, ON_RECEIVE_DAMAGE).
  - `effects` : **tableau** d’effets, chacun conforme à `SUPPORTED_EFFECTS` (même sémantique que le skill actif).
  - `cooldown` (optionnel) : nombre d’actions avant réactivation (≥ 0).
- **Exécution** : Un seul handler générique `handlePassiveTrigger(triggerType, actor, context)` qui :
  - filtre les passifs de l’acteur par `trigger === triggerType`,
  - respecte le cooldown par passif (clé dérivée de l’index ou d’un id),
  - pour chaque effet du passif, appelle `applySkillEffect(state, actor, target, effectConfig)` en résolvant la cible selon le contexte (attaquant, cible, victime, etc.).
- **SELF_RESURRECT** : Remplacer par un passif `trigger: "ON_DEATH"` avec `effects: [{ type: "RESURRECT", percentHp: 0.5 }]` et `cooldown: 5`.
- **specA_passive / specB_passive** : Soit les fusionner dans le même format (tableau de passifs) et les injecter dans `skill_data.passives` côté service d’équipe, soit les faire exécuter par le même `handlePassiveTrigger` en les fusionnant avec `unit.passives` avant le combat.

---

## 9. Résumé

| Élément | État |
|--------|------|
| Triggers réellement supportés | ON_ATTACK, SELF_RESURRECT (équivalent ON_DEATH pour soi) |
| Triggers manquants | ON_HIT, ON_KILL, ON_ACTION_START, ON_ACTION_END, ON_RECEIVE_DAMAGE |
| Format | Un effet par passif pour ON_ATTACK ; SELF_RESURRECT en dur |
| specA_passive / specB_passive | Stockés mais non exécutés |
| Codage en dur par nom d’unité | Aucun |
| Codage en dur par type | SELF_RESURRECT (résurrection + cooldown) |

**Conclusion** : Les passifs sont partiellement supportés et incohérents (trigger/type, un effet vs tableau, SELF_RESURRECT dédié). Une normalisation avec `trigger` + `effects[]` + `cooldown` et un handler unique `handlePassiveTrigger` est recommandée.
