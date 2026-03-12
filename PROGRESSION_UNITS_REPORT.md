# Rapport – Progression des unités

## 1. Nouvelle structure `user_units`

Colonnes (après migration) :

| Colonne         | Type           | Description                          |
|-----------------|----------------|--------------------------------------|
| id              | BIGINT UNSIGNED| PK                                   |
| user_id         | BIGINT UNSIGNED| FK users                             |
| unit_id         | BIGINT UNSIGNED| FK units                             |
| level           | INT UNSIGNED   | Niveau (défaut 1, max 50)            |
| xp              | INT UNSIGNED   | XP courants pour le niveau actuel   |
| specialization  | VARCHAR(20)    | NULL = pas de spé, sinon bonus x1.25 |
| ascension_count | INT UNSIGNED   | Défaut 0                             |
| fatigue         | INT            | …                                    |
| injury_level    | TINYINT        | …                                    |
| is_injured      | TINYINT(1)     | …                                    |
| created_at      | DATETIME       | …                                    |
| updated_at      | DATETIME       | …                                    |

**Migration :** exécuter `database/migrate_user_units_progression.sql` pour ajouter `specialization` et `ascension_count` sur une base existante.

---

## 2. Service XP

**Fichier :** `backend/src/services/xpService.js`

- **getXpRequired(level)**  
  `100 + (level * level * 12)`  
  Ex. : level 1 → 112, level 2 → 148, level 10 → 1300.

- **addXp(userUnitId, amount)**  
  Charge la user_unit, ajoute l’XP, puis tant que `xp >= xpRequired` et `level < 50` :  
  `xp -= xpRequired`, `level++`.  
  Sauvegarde et retourne `{ level, xp, levelsGained }`.

- **grantXpToSurvivors(userUnitIds, amountPerUnit)**  
  Pour la campagne : appelle `addXp` pour chaque id avec le même montant.

---

## 3. Exemple montée de niveau

- Niveau 1, 0 XP, on ajoute 200 XP.  
  Requis niveau 1 → 2 : 112.  
  Après : 200 - 112 = 88 XP, level 2.  
  Requis niveau 2 → 3 : 148. 88 < 148 ⇒ stop.  
  **Résultat :** `level: 2, xp: 88, levelsGained: 1`.

- Même unité, on ajoute 500 XP.  
  88 + 500 = 588.  
  588 - 148 = 440 (level 3), 440 - 208 = 232 (level 4), 232 - 282 impossible.  
  **Résultat :** `level: 4, xp: 232, levelsGained: 2`.

---

## 4. Stats dynamiques (scaling)

**Fonction :** `computeScaledStats(unit, userUnit)` (exportée depuis `core/combatEngine.js`).

- **scale** = `1 + (userUnit.level * 0.02)`  
  Ex. : level 10 → 1.2, level 50 → 2.0.
- Si **specialization** non null/non vide : `scale *= 1.25`.
- Retour : `maxHp`, `attack`, `defense`, `speed`, `mastery` = arrondi(base * scale).

**Utilisation :** Dans `simulateBattle`, avant d’appliquer archétype et fatigue, chaque unité avec `level >= 1` reçoit ses stats via `applyScaledStatsToUnit` (qui appelle `computeScaledStats`). Les unités envoyées au combat doivent donc avoir `level` (et optionnellement `specialization`, `base_hp`, etc.) pour que le scaling soit appliqué.

**Exemple avant/après scaling**

- Unit base : base_hp 3000, base_attack 200, base_defense 150, base_speed 100.  
  userUnit : level 10, specialization null.

  scale = 1 + 10*0.02 = 1.2  
  → maxHp 3600, attack 240, defense 180, speed 120.

- Même base, userUnit : level 10, specialization `"dps"`.

  scale = 1.2 * 1.25 = 1.5  
  → maxHp 4500, attack 300, defense 225, speed 150.

---

## 5. XP après combat

**Ranked (dans `POST /battle/simulate`)**  
Quand `userAId`, `userBId` sont présents et qu’il y a un gagnant (A ou B) :

- Équipe gagnante : **50 XP** par unité.
- Équipe perdante : **20 XP** par unité.
- Pour chaque unité : si **fatigue > 50**, XP divisé par 2 (25 / 10).
- Les unités doivent avoir `id` ou `user_unit_id` (et optionnellement `fatigue`) dans les snapshots `teamA` / `teamB`.

**Campagne**  
Pas de route campagne dans le projet actuel. Quand une route campagne existera, après victoire appeler par exemple :

```js
import { grantXpToSurvivors } from '../services/xpService.js';
await grantXpToSurvivors(survivantUserUnitIds, xpParUnite);
```

---

## 6. Endpoint GET /collection

Réponse enrichie par unité :

- **level**, **xp**, **xp_required** (getXpRequired(level)), **specialization**
- Plus : ascension_count, fatigue, injury_level, is_injured, unit_id, code, name, rarity, role, base_hp, etc.

Exemple fragment :

```json
{
  "units": [
    {
      "user_unit_id": 1,
      "level": 5,
      "xp": 80,
      "xp_required": 400,
      "specialization": null,
      "ascension_count": 0,
      "unit_id": 1,
      "name": "Guardian Aegis",
      "base_hp": 4200,
      ...
    }
  ]
}
```
