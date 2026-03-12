# Format snapshot replay (combat engine)

Pour que le visualiseur affiche correctement les deux équipes avec CAC/DISTANCE et couleurs, le **moteur de combat** doit envoyer un snapshot avec une propriété **`units`** (tableau plat) contenant toutes les infos suivantes par unité :

```ts
snapshot.units = units.map(u => ({
  id: u.id,
  name: u.name,
  element: u.element,
  team: u.team,              // "ALLY" | "ENEMY"
  role: u.role,              // "CAC" | "DISTANCE" (ex. dérivé de u.attack_type)
  hp: u.hp,
  maxHp: u.maxHp,
  atb: u.atb,
  buffs: u.buffs,
  debuffs: u.debuffs,
  isDead: u.isDead
}))
```

- **`team`** : requis pour séparer alliés et ennemis (sinon le front déduit de la side A/B des unités initiales).
- **`role`** : requis pour séparer front (CAC) et back (DISTANCE). Si absent, le front déduit de `position: 'front' | 'back'` des unités initiales.

Le front accepte aussi l’ancien format `snapshot.teams` (tableau de `{ id, units }`) et aplatit les unités en interne.
