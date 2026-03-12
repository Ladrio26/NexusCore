# Rapport : Effets d’animation par rareté (Sanctuaire)

## 1. Structure

- Quand un pull est résolu, **resultRarity** est stocké (ref) avec la rareté en minuscules (`common`, `uncommon`, `rare`, `epic`, `legendary`, `mythic`).
- L’overlay reçoit une **classe dynamique** : `overlayClass = "rarity-" + resultRarity` (ex. `rarity-legendary`, `rarity-mythic`).
- La fermeture de l’overlay n’est possible qu’après la fin de l’animation (~1,8 s) : **canClose** passe à `true` après 1800 ms.

---

## 2. Classes CSS ajoutées

### Communes à l’overlay / reveal

- **.rarity-common**, **.rarity-uncommon**, **.rarity-rare**, **.rarity-epic**, **.rarity-legendary**, **.rarity-mythic**  
  Appliquées sur l’overlay et sur la carte selon `resultRarity`.

### Legendary

- **.rarity-legendary** — appliquée sur l’overlay et le bloc reveal.
- **.legendary-halo** — halo doré derrière la carte (radial-gradient or/orange, rotation 4s infinite).
- **.legendary-particles** — conteneur des particules.
- **.legendary-particle** — petits cercles (10) animés vers l’extérieur (--particle-x, --particle-y, délai échelonné).
- **.flash-legendary** — flash doré (0,2 s) pendant la phase flash.

### Mythic

- **.rarity-mythic** — appliquée sur l’overlay et le bloc reveal.
- **.mythic-bg** — fond en gradient rouge/violet animé (keyframes mythic-bg-shift).
- **.mythic-halo** — double anneau (rouge + ::before blanc), glow pulsant (mythic-glow-pulse).
- **.mythic-title** — libellé "MYTHIC" avec animation letter-spacing (mythic-title-spacing).
- **.flash-mythic** — triple flash rapide (keyframes flash-mythic-triple).

### Animations de reveal

- **reveal-shake-legendary** — secousse légère (translateX ±3 px, 0,3 s).
- **reveal-shake-mythic** — secousse forte (translateX ±6 px + scale 1,05), puis retour à 1.
- **reveal-in-mythic** — apparition avec scale 1,05 → 1.

---

## 3. Logique JS

- **resultRarity** (ref) : mis à jour au moment du pull réussi avec `(data.rarity ?? 'common').toLowerCase()`.
- **overlayClass** (computed) : `'rarity-' + resultRarity`.
- **canClose** (ref) : à `false` à l’ouverture, passé à `true` après `setTimeout(..., 1800)` au début de l’animation. Le bouton "Fermer" est `disabled` tant que `!canClose`.
- **particleStyle(n)** : pour chaque particule legendary (n = 1..10), calcule `--particle-x` et `--particle-y` à partir de l’angle (répartition 360°) pour un mouvement radial, et `--particle-delay` pour un effet décalé.
- **closeOverlay** : ne fait rien si `!canClose`, sinon ferme et réinitialise `resultRarity`, `phase`, `canClose`.

---

## 4. Tester en forçant la rareté

Pour tester **legendary** ou **mythic** sans dépendre du tirage :

1. **Option temporaire dans le code**  
   Dans `invoke()`, après `if (data.success)`, forcer la rareté avant de l’afficher :
   ```ts
   const rarity = (data.rarity ?? 'common').toLowerCase();
   resultRarity.value = 'legendary';  // ou 'mythic'
   ```
   Puis faire un pull : l’animation et les effets s’afficheront comme pour legendary/mythic.

2. **Option sans modifier l’appel API**  
   Toujours après `if (data.success)`, remplacer par exemple par :
   ```ts
   resultRarity.value = 'mythic';  // test mythic
   pullResult.value = {
     ...data,
     unit: data.unit ?? { name: 'Unité de test' },
     rarity: 'mythic'
   };
   ```
   Ainsi le texte et le style correspondent à la rareté de test.

3. **Vérifications**  
   - Legendary : halo doré tournant, 10 particules vers l’extérieur, flash doré, secousse ±3 px, bouton "Fermer" actif après ~1,8 s.  
   - Mythic : fond gradient animé, double halo pulsant, triple flash, secousse ±6 px + scale, titre "MYTHIC" avec letter-spacing, même délai avant fermeture.

---

## 5. Contraintes respectées

- Aucun plugin externe ; CSS pur + transitions/keyframes.
- Durée totale ~1,8 s (charge 0,9 s + flash 0,3 s + reveal 0,6 s) ; fermeture possible après 1,8 s.
- Particules : 10 pour legendary (≤ 20).
- Fichier modifié : `frontend/src/views/SanctuaryView.vue` uniquement.
