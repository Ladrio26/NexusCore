# Rapport : Sanctuaire d’Invocation (backend)

## 1. Tables

### user_wallet (économie)

| Colonne           | Type    | Description                          |
|------------------|---------|--------------------------------------|
| user_id          | BIGINT  | PK, référence users(id)              |
| credits          | INT     | DEFAULT 0 — monnaie standard         |
| cores            | INT     | DEFAULT 0 — noyau                    |
| fragments        | INT     | DEFAULT 0 — fragments universels     |
| ascension_essence| INT     | DEFAULT 0 — essence d’ascension      |

Toute la conversion **dupe → fragments** est créditée dans `user_wallet.fragments` (universel). La table `user_fragments` (par unité) est conservée pour une future V2 mais n’est plus utilisée pour les tirages.

### gacha_pity (par bannière)

| Colonne       | Type    | Description                    |
|---------------|---------|--------------------------------|
| user_id       | BIGINT  | PK                             |
| banner_key    | VARCHAR(50) | PK — `standard`, `core`, `resonance` |
| total_pulls   | INT     | Nombre total de tirages        |
| pity_epic     | INT     | Compteur vers Epic (standard)  |
| pity_legendary| INT     | Compteur vers Legendary        |
| pity_mythic   | INT     | Compteur vers Mythic           |

Le pity (Epic à 10, Legendary à 60, Mythic à 200) s’applique **uniquement** à la bannière `standard`.

---

## 2. Pools (taux et coûts)

### Bannière Standard (`type: "standard"`)

- **Coût :** 100 credits  
- **Taux :**  
  - Commun 49,9 %  
  - PeuCommun 30 %  
  - Rare 15 %  
  - Epique 4 %  
  - Legendaire 1 %  
  - Mythique 0,1 %  
- **Pity :** Epic garanti à 10, Legendary à 60, Mythic à 200  
- **Dupe :** → fragments universels (voir tableau ci‑dessous)

### Bannière Core (`type: "core"`)

- **Coût :** 10 cores  
- **Taux :** Commun 50 %, PeuCommun 40 %, Rare 10 %  
- **Pity :** aucun (V1)  
- **Dupe :** → fragments universels

### Bannière Résonance (`type: "resonance"`)

- **Coût :** 100 fragments (`user_wallet.fragments`)  
- **Taux :** Rare 90 %, Epique 10 %  
- **Pity :** aucun (V1)  
- **Dupe :** → fragments universels

---

## 3. Dupe → fragments (universel)

Quand l’unité tirée est **déjà possédée** :

- on **n’ajoute pas** de ligne dans `user_units` ;
- on **ajoute** des fragments dans `user_wallet.fragments` selon la rareté tirée ;
- la réponse contient `isNewUnit: false`, `fragmentsGained` et le `wallet` mis à jour (dont `fragments`).

Table fixe (fragments gagnés par dupe) :

| Rareté    | Fragments |
|-----------|-----------|
| Commun    | 5         |
| PeuCommun | 10        |
| Rare      | 20        |
| Epique    | 40        |
| Legendaire| 80        |
| Mythique  | 150       |

---

## 4. Exemples de réponses JSON

### POST /sanctuary/pull — succès (nouvelle unité, standard)

```json
{
  "success": true,
  "type": "standard",
  "cost": { "credits": 100 },
  "unit": {
    "id": 4,
    "code": "BERS_PLANT_DPS",
    "name": "Thorn Reaver",
    "rarity": "rare",
    "role": "assassin",
    "attack_type": "melee",
    "element": "plant"
  },
  "rarity": "rare",
  "isNewUnit": true,
  "fragmentsGained": 0,
  "wallet": {
    "credits": 1900,
    "cores": 50,
    "fragments": 200,
    "ascension_essence": 0
  },
  "pity": {
    "total_pulls": 1,
    "pity_epic": 1,
    "pity_legendary": 1,
    "pity_mythic": 1
  }
}
```

### POST /sanctuary/pull — succès (dupe, résonance)

```json
{
  "success": true,
  "type": "resonance",
  "cost": { "fragments": 100 },
  "unit": {
    "id": 7,
    "code": "ARCANIST_WATER_MAGE",
    "name": "Tidal Sage",
    "rarity": "epic",
    "role": "support",
    "attack_type": "magic",
    "element": "water"
  },
  "rarity": "epic",
  "isNewUnit": false,
  "fragmentsGained": 40,
  "wallet": {
    "credits": 2000,
    "cores": 50,
    "fragments": 140,
    "ascension_essence": 0
  }
}
```

### GET /wallet

```json
{
  "credits": 2000,
  "cores": 50,
  "fragments": 200,
  "ascension_essence": 0
}
```

### Erreur — fonds insuffisants

```json
{
  "success": false,
  "error": "INSUFFICIENT_FRAGMENTS",
  "required": 100
}
```

---

## 5. Commandes curl de test

Récupérer un token (après inscription ou connexion) :

```bash
# Connexion (adapter email/password si besoin)
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user1@example.com","password":"votre_mot_de_passe"}' \
  | jq -r '.token')
```

Puis (en supposant que `$TOKEN` est défini) :

```bash
# Pull bannière standard (100 credits)
curl -s -X POST http://localhost:3000/sanctuary/pull \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"type":"standard"}' | jq

# Pull bannière core (10 cores)
curl -s -X POST http://localhost:3000/sanctuary/pull \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"type":"core"}' | jq

# Pull bannière résonance (100 fragments)
curl -s -X POST http://localhost:3000/sanctuary/pull \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"type":"resonance"}' | jq
```

Pour vérifier le wallet après les tirages :

```bash
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/wallet | jq
```

---

## 6. Migration et seeds

- **Migration :** `database/migrate_sanctuary_wallet.sql` — ajoute `fragments` et `ascension_essence` à `user_wallet` si besoin.
- **Seeds :** `database/seeds.sql` — crédite le user 1 avec `credits=2000`, `cores=50`, `fragments=200` (et user 2 avec des valeurs de test plus basses).
