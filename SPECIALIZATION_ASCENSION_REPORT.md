# Rapport : Spécialisation définitive (ascension)

## 1. Nouvelle structure `units`

Colonnes ajoutées à la table **units** :

| Colonne | Type | Description |
|--------|------|-------------|
| `specA_bonus_stat` | VARCHAR(20) NULL | Nom de la stat qui reçoit +10% en spé A (attack, defense, hp, speed, mastery) |
| `specB_bonus_stat` | VARCHAR(20) NULL | Idem pour spé B |
| `specA_skill_modifier` | JSON NULL | Surcharge à fusionner avec `skill_data` pour la spé A |
| `specB_skill_modifier` | JSON NULL | Idem pour spé B |
| `specA_passive` | JSON NULL | Passif optionnel (rarité ≥ Rare) pour spé A |
| `specB_passive` | JSON NULL | Idem pour spé B |

**user_wallet** :

| Colonne | Type | Description |
|--------|------|-------------|
| `ascension_essence` | INT NOT NULL DEFAULT 0 | Ressource consommée pour ascension (1 par ascension) |

---

## 2. Exemple d’ascension

**Requête :** `POST /units/ascend` (authentifiée)

**Body :**
```json
{
  "userUnitId": 42,
  "specChoice": "A"
}
```

**Réponse succès (200) :**
```json
{
  "success": true,
  "userUnit": {
    "id": 42,
    "level": 1,
    "xp": 0,
    "specialization": "A",
    "ascension_count": 1
  },
  "message": "Spécialisation A appliquée. Niveau réinitialisé à 1."
}
```

**Réponse erreur (400) – niveau insuffisant :**
```json
{
  "success": false,
  "error": "LEVEL_REQUIRED",
  "message": "Niveau 50 requis (actuel: 45)."
}
```

**Réponse erreur (400) – essence insuffisante :**
```json
{
  "success": false,
  "error": "INSUFFICIENT_ESSENCE",
  "message": "Pas assez d'essence d'ascension (1 requis)."
}
```

---

## 3. Exemple de stat finale (scaling + bonus spé)

Formule :

- `scale = 1 + (level * 0.02)` ; si spécialisation active : `scale *= 1.25`.
- `stat_final = base_stat * scale`.
- Si spé et que la stat correspond à `specA_bonus_stat` / `specB_bonus_stat` : `stat_final *= 1.10`.

**Exemple :** unité niveau 20, spé A, `specA_bonus_stat = "attack"`, base_attack = 200.

- scale = 1 + 0.4 = 1.4 ; avec spé : 1.4 * 1.25 = 1.75.
- attack = 200 * 1.75 = 350 ; bonus stat attack : 350 * 1.10 = **385**.

Résultat : `attack: 385`, autres stats sans bonus supplémentaire.

---

## 4. Exemple de skill modifié

**skill_data original (unité) :**
```json
{
  "type": "DAMAGE_SINGLE",
  "mult": 1.2,
  "cd_actions": 2
}
```

**specA_skill_modifier (units) :**
```json
{
  "mult": 1.5,
  "cd_actions": 1
}
```

**skill_data après fusion (utilisé en combat) :**
```json
{
  "type": "DAMAGE_SINGLE",
  "mult": 1.5,
  "cd_actions": 1
}
```

La fusion est une surcharge clé par clé : les champs du modifier écrasent ceux du skill de base.

---

## 5. Passifs spé

Pour les unités de rareté **≥ Rare** avec une spécialisation (A ou B), le champ `specA_passive` ou `specB_passive` est injecté dans `state.passives[unit.uid]` au début du combat. Le moteur peut s’en servir pour des effets ultérieurs (aucune logique métier détaillée n’est appliquée dans ce premier volet).

---

## 6. Fichiers modifiés / ajoutés

- **DB :** `database/schema.sql`, `database/migrate_specialization.sql`
- **Service :** `backend/src/services/ascensionService.js`
- **Route :** `backend/src/routes/units.js` → `POST /units/ascend`
- **Combat :** `core/combatEngine.js` (`computeScaledStats`, `state.passives`)
- **Équipes :** `backend/src/services/battleTeamService.js` (SELECT spé, fusion skill, `specPassive`, `rarity`)
