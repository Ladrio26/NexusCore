# Rapport – Économie et Gacha V1

## 1. Nouvelles tables (schema.sql)

### user_wallet
| Colonne   | Type    | Description        |
|-----------|---------|--------------------|
| user_id   | PK, FK → users | Id utilisateur |
| credits   | INT DEFAULT 0  | Monnaie standard  |
| cores     | INT DEFAULT 0 | Monnaie premium   |

### user_fragments
| Colonne   | Type    | Description        |
|-----------|---------|--------------------|
| user_id   | PK, FK → users | Id utilisateur |
| unit_id   | PK, FK → units | Id unité        |
| fragments | INT UNSIGNED   | Nombre de fragments |

Clé primaire : `(user_id, unit_id)`.

### gacha_pity
| Colonne        | Type           | Description              |
|----------------|----------------|--------------------------|
| user_id        | PK, FK → users | Id utilisateur           |
| banner_key     | VARCHAR(50) PK | Clé de la bannière       |
| total_pulls    | INT UNSIGNED   | Nombre total de tirages  |
| pity_epic      | INT UNSIGNED   | Tirages depuis dernier epic+ |
| pity_legendary | INT UNSIGNED   | Tirages depuis dernier legendary |
| pity_mythic    | INT UNSIGNED   | Réservé (future)         |

Clé primaire : `(user_id, banner_key)`.

---

## 2. Exemple curl – Pull

```bash
# 1) Login pour obtenir le token
TOKEN=$(curl -s -X POST http://127.0.0.1:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"votre@email.com","password":"votremotdepasse"}' \
  | jq -r '.token')

# 2) Tirage gacha (bannière "standard", 100 credits par pull)
curl -s -X POST http://127.0.0.1:3000/api/gacha/pull \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"bannerKey":"standard"}'
```

---

## 3. Exemple de réponse JSON – Pull réussi

```json
{
  "success": true,
  "unit": {
    "id": 3,
    "code": "fire_mage",
    "name": "Fire Mage",
    "rarity": "rare",
    "role": "backline",
    "attack_type": "magic",
    "element": "fire"
  },
  "rarity": "rare",
  "isNewUnit": true,
  "wallet": {
    "credits": 400,
    "cores": 0
  },
  "pity": {
    "total_pulls": 1,
    "pity_epic": 1,
    "pity_legendary": 1,
    "pity_mythic": 0
  }
}
```

Si l’unité est déjà possédée, le joueur reçoit des fragments à la place (pas de nouvelle `user_unit`) :

```json
{
  "success": true,
  "unit": {
    "id": 3,
    "code": "fire_mage",
    "name": "Fire Mage",
    "rarity": "rare",
    "role": "backline",
    "attack_type": "magic",
    "element": "fire"
  },
  "rarity": "rare",
  "isNewUnit": false,
  "fragments": 10,
  "wallet": { "credits": 300, "cores": 0 },
  "pity": {
    "total_pulls": 2,
    "pity_epic": 2,
    "pity_legendary": 2,
    "pity_mythic": 0
  }
}
```

Erreur (credits insuffisants) :

```json
{
  "success": false,
  "error": "INSUFFICIENT_CREDITS",
  "required": 100
}
```

---

## Routes protégées (auth)

- **POST /api/gacha/pull** – Body : `{ "bannerKey": "standard" }`
- **GET /api/wallet** – Retourne `{ "credits", "cores" }`
- **GET /api/fragments** – Retourne `{ "fragments": [ { unit_id, fragments, code, name, rarity } ] }`
- **GET /api/gacha/pity?bannerKey=standard** – Retourne les compteurs pity

Les nouveaux utilisateurs ont 0 credits ; on peut créditer un compte via SQL, ex. :

```sql
INSERT INTO user_wallet (user_id, credits, cores) VALUES (1, 1000, 0)
ON DUPLICATE KEY UPDATE credits = credits + 1000;
```
