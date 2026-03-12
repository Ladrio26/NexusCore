# Rapport – Sécurisation du scaling combat

## 1. Payload sécurisé (ce que le client envoie)

Le client **ne doit envoyer que** des identifiants et positions. Aucune stat ni base stat.

**Exemple de body accepté :**

```json
{
  "userAId": 2,
  "userBId": 3,
  "teamA": [
    { "user_unit_id": 1, "position": "front" },
    { "user_unit_id": 2, "position": "front" },
    { "user_unit_id": 5, "position": "back" }
  ],
  "teamB": [
    { "user_unit_id": 10, "position": "front" },
    { "user_unit_id": 11, "position": "front" },
    { "user_unit_id": 13, "position": "back" }
  ],
  "config": { "seed": 42 },
  "isGhost": false
}
```

- **userAId**, **userBId** : obligatoires (équipes construites côté serveur à partir de la DB).
- **teamA** / **teamB** : tableaux de `{ user_unit_id, position }`.
- **position** : uniquement `"front"` ou `"back"`.
- Champs **interdits** dans chaque slot : `base_hp`, `base_attack`, `base_defense`, `base_speed`, `attack`, `defense`, `speed`, `mastery`. Si l’un d’eux est présent → **400 BAD REQUEST** avec `error: "CLIENT_STATS_FORBIDDEN"`.

---

## 2. Objet unité construit côté serveur

Pour chaque `user_unit_id`, le serveur charge **user_units** (level, xp, specialization, fatigue, …) et **units** (base_hp, base_attack, base_defense, base_speed, mastery, traits, element, archetype, skill_data, …), puis applique **computeScaledStats** et construit un objet prêt pour le moteur de combat.

**Exemple d’objet unité construit (après scaling) :**

```json
{
  "id": 1,
  "user_unit_id": 1,
  "position": "front",
  "rangeType": "melee",
  "name": "Guardian Aegis",
  "code": "GUARD_WATER_TANK",
  "element": "water",
  "archetype": "CAC_TANK",
  "role": "tank",
  "base_hp": 4200,
  "base_attack": 180,
  "base_defense": 220,
  "base_speed": 95,
  "mastery": 0,
  "level": 10,
  "specialization": null,
  "fatigue": 0,
  "maxHp": 5040,
  "attack": 216,
  "defense": 264,
  "speed": 114,
  "traits": ["GUARDIANS", "TACTICIANS"],
  "skill_data": { "skill": { "type": "SHIELD_SELF", "mult": 0.25, "cd_actions": 4 } },
  "skillData": { "skill": { "type": "SHIELD_SELF", "mult": 0.25, "cd_actions": 4 } }
}
```

- Les stats de combat (**maxHp**, **attack**, **defense**, **speed**, **mastery**) sont **calculées côté serveur** à partir des bases et du level/spé (scale = 1 + level×0.02, ×1.25 si specialization non vide).
- Le client ne fournit jamais ces champs ; ils viennent uniquement de la DB et de `computeScaledStats`.

---

## 3. Confirmation : le client ne contrôle plus les stats

- **Validation** : avant toute construction d’équipe, le serveur vérifie qu’aucun slot de `teamA` ou `teamB` ne contient les champs interdits (`base_hp`, `base_attack`, `base_defense`, `base_speed`, `attack`, `defense`, `speed`, `mastery`). Présence d’un seul → **400** et arrêt.
- **Format** : seuls `user_unit_id` et `position` ("front" | "back") sont acceptés par slot.
- **Source des stats** : équipes reconstruites **uniquement** via `buildTeamFromDb(userId, slots)` qui lit **user_units** et **units** en base et applique **computeScaledStats**.
- **userAId / userBId** : obligatoires ; sans eux, la route répond **400 USER_IDS_REQUIRED** (pas de simulation avec des stats envoyées par le client).

En résumé : **les stats de combat sont entièrement déterminées par la DB et le serveur ; le client ne peut plus les influencer.**
