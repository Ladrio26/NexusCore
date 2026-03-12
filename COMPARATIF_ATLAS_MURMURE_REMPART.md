# Comparatif : Murmure des Abysses vs Atlas des Profondeurs vs Rempart Primordial

Source : `database/patch_batch5_water_tanks.sql` (skill_data brut).

---

## 1) Murmure des Abysses

- **skill.type** : `GENERIC`
- **skill.effects** (JSON complet) :
```json
[
  {
    "type": "SHIELD",
    "percentMaxHp": 0.10,
    "remainingActions": 1,
    "target": "SELF"
  }
]
```
- **skill.cd_actions** : `3`
- **skill.percent / skill.value / skill.mult** : non présents au niveau skill (dans l’effet : percentMaxHp = 0.10)
- **target de chaque effet** : `SELF`
- **buffType / debuffType** : non présents

---

## 2) Atlas des Profondeurs

- **skill.type** : `GENERIC`
- **skill.effects** (JSON complet) :
```json
[
  {
    "type": "SHIELD",
    "percentMaxHpCaster": 0.15,
    "remainingActions": 1,
    "target": "TEAM_ALLY"
  }
]
```
- **skill.cd_actions** : `3`
- **skill.percent / skill.value / skill.mult** : non présents au niveau skill (dans l’effet : percentMaxHpCaster = 0.15)
- **target de chaque effet** : `TEAM_ALLY`
- **buffType / debuffType** : non présents

---

## 3) Rempart Primordial

- **skill.type** : `GENERIC`
- **skill.effects** (JSON complet) :
```json
[
  {
    "type": "SHIELD",
    "percentMaxHpCaster": 0.20,
    "remainingActions": 2,
    "target": "TEAM_ALLY"
  }
]
```
- **skill.cd_actions** : `3`
- **skill.percent / skill.value / skill.mult** : non présents au niveau skill (dans l’effet : percentMaxHpCaster = 0.20)
- **target de chaque effet** : `TEAM_ALLY`
- **buffType / debuffType** : non présents

---

## Tableau comparatif

| Nom                    | skill.type | has effects | effects content                                                                 | cd_actions |
|------------------------|-----------|-------------|----------------------------------------------------------------------------------|------------|
| Murmure des Abysses   | GENERIC   | Oui         | 1 effet : SHIELD, **percentMaxHp: 0.10**, target **SELF**                        | 3          |
| Atlas des Profondeurs | GENERIC   | Oui         | 1 effet : SHIELD, **percentMaxHpCaster: 0.15**, target **TEAM_ALLY**             | 3          |
| Rempart Primordial    | GENERIC   | Oui         | 1 effet : SHIELD, **percentMaxHpCaster: 0.20**, target **TEAM_ALLY**             | 3          |

---

## Différence structurelle qui explique le comportement

Dans `combatEngine.js`, le case `SHIELD` de `applySkillEffect` utilise uniquement :

- `cfg.percentMaxHp ?? cfg.percent ?? 0`
- puis `maxHp = target.maxHp` et `amount = maxHp * pct`.

Donc :

- **Murmure** : `percentMaxHp: 0.10` est lu → `pct = 0.10` → bouclier = 10 % des PV max de la cible (soi-même) → **fonctionne**.
- **Atlas** et **Rempart** : seul `percentMaxHpCaster` est présent dans les effets ; **`percentMaxHp` n’est jamais renseigné** → `pct = 0` → `amount = 0` → **aucun bouclier appliqué**.

En résumé : le moteur ne prend en charge que **percentMaxHp** (et éventuellement **percent**), pas **percentMaxHpCaster**. Les compétences “bouclier équipe basé sur les PV max du lanceur” ne sont donc pas supportées telles quelles dans le moteur actuel, ce qui explique pourquoi Murmure (SELF + percentMaxHp) fonctionne et pas Atlas ni Rempart (TEAM_ALLY + percentMaxHpCaster).
