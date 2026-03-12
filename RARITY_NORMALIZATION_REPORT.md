# Rapport : Normalisation des raretés

## 1. Valeurs autorisées (plateforme)

Les raretés sont **uniquement** les suivantes, en **minuscules** :

- `common`
- `uncommon`
- `rare`
- `epic`
- `legendary`
- `mythic`

---

## 2. DB

### schema.sql

- **units.rarity** : ENUM mis à jour en  
  `ENUM('common','uncommon','rare','epic','legendary','mythic') NOT NULL DEFAULT 'common'`

### Migration : database/migrate_rarity_enum.sql

- Modifie la colonne **units.rarity** pour utiliser le nouvel ENUM (ajout de `uncommon` et `mythic`).
- À exécuter sur une base existante pour aligner le schéma.

**Commande :**
```bash
mariadb -h localhost -P 3306 -uladrio -pcerise nexuscore < database/migrate_rarity_enum.sql
```

---

## 3. Units existantes / seeds

- Les seeds utilisaient déjà des raretés en minuscules (`epic`, `rare`). Aucune conversion de casse n’a été nécessaire dans les données existantes.
- **4 unités uncommon** ajoutées dans **seeds.sql** (pool distinct du common) :
  - UNCOM_WATER_AXE (Tidal Striker)
  - UNCOM_FIRE_SHIELD (Cinder Ward)
  - UNCOM_PLANT_VINE (Vine Caster)
  - UNCOM_NEUTRAL_BOW (Steady Archer)
- Insert avec `ON DUPLICATE KEY UPDATE rarity = VALUES(rarity)` pour éviter les conflits de code si les seeds sont relancés.

---

## 4. Gacha (backend)

### Suppression du mapping uncommon → common

- **RARITY_TO_DB** supprimé.
- Chaque rareté a son propre pool SQL :  
  `SELECT id FROM units WHERE rarity = ?`  
  avec la rareté tirée (common, uncommon, rare, epic, legendary, mythic).

### Table dupe → fragments

- **FRAGMENTS_PER_RARITY** couvre les 6 raretés :
  - common: 5, uncommon: 10, rare: 20, epic: 40, legendary: 80, mythic: 150

---

## 5. Validation backend

- **VALID_RARITIES** : liste des 6 raretés autorisées.
- **validateRarity(rarity)** :
  - normalise en minuscules ;
  - lève une erreur si la valeur n’est pas dans **VALID_RARITIES**.
- Utilisation :
  - dans **getUnitIdsByRarity(rarity)** avant la requête SQL ;
  - après le **SELECT** de l’unité par id, sur **unitRow.rarity**, pour rejeter toute rareté inconnue venant de la DB.

---

## 6. Fichiers modifiés

| Fichier | Modification |
|---------|--------------|
| database/schema.sql | ENUM **units.rarity** étendu à common, uncommon, rare, epic, legendary, mythic |
| database/migrate_rarity_enum.sql | **Créé** – ALTER TABLE pour le nouvel ENUM |
| database/seeds.sql | Ajout de 4 unités **uncommon** (INSERT + ON DUPLICATE KEY UPDATE) |
| backend/src/services/gachaService.js | Suppression RARITY_TO_DB ; VALID_RARITIES + validateRarity() ; getUnitIdsByRarity utilise directement la rareté ; validation de unitRow.rarity après lecture DB |

---

## 7. Ordre des opérations recommandé

1. Exécuter la migration :  
   `migrate_rarity_enum.sql`
2. (Optionnel) Réexécuter les seeds pour insérer les 4 uncommon si besoin :  
   ex. exécuter le bloc INSERT des units (seeds) ou le fichier seeds.sql selon votre procédure.
3. Redémarrer le backend (ou le conteneur) pour charger le nouveau code.

Après cela, la plateforme utilise partout les 6 raretés normalisées (minuscules, sans mapping uncommon → common).
