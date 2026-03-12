# Rapport : Verrouillage chapitres campagne et correctifs

## 1. Logique de verrouillage

### Mode Normal
- **Chapitre 1** : toujours disponible.
- **Chapitre N (N > 1)** : disponible uniquement si le **stage 10 (boss) du chapitre N-1** est cleared en mode normal.

### Mode Hard
- **Chapitre 1** : toujours disponible dès le début (ne dépend pas du mode Normal) ; le niveau 1 du chapitre 1 Hard est jouable immédiatement.
- **Chapitre N (N > 1)** : disponible si le **stage 10 (boss) du chapitre N-1** est cleared en **mode Hard** (même saison). Même logique de déblocage que le Normal, mais basée sur la progression Hard.

Les stages à l’intérieur d’un chapitre restent gérés comme avant (stage 1 toujours jouable dans le chapitre, stage S > 1 si le stage S-1 est cleared dans ce chapitre). Un stage n’est considéré comme available que si le chapitre est lui-même disponible (`chapterAvailable`) et que le stage précédent est cleared.

---

## 2. Modifications backend

### campaignService.js
- **getCampaignStatus** :
  - Chargement du **progression normal** en plus de la progression du mode courant, pour calculer `chapterAvailable`.
  - Pour chaque chapitre, `chapterAvailable` :
    - Normal : `true` pour ch 1, sinon `true` si le boss (stage 10) du chapitre N-1 est cleared en normal.
    - Hard : `true` si le boss (stage 10) du chapitre N est cleared en normal et que `seasonKey` est défini.
  - Chaque `chapters[c]` contient désormais `{ chapterAvailable, stages }`.
  - Un stage est `available` seulement si `chapterAvailable` est vrai et (stage 1 ou stage précédent cleared).
- **isChapterAvailable(userId, chapter, mode, seasonKey)** (nouvelle fonction) :
  - Vérifie uniquement si le chapitre est débloqué (requêtes sur `campaign_progress_normal`).
  - Utilisée par POST `/campaign/start` pour refuser l’accès aux chapitres non débloqués.
- **isStageAvailable** : retourne `false` si le chapitre n’est pas disponible (`!ch.chapterAvailable`).

### routes/campaign.js
- **POST /campaign/start** :
  - Après la vérification `isCampaignUnlocked`, appel à **isChapterAvailable(userId, ch, m, seasonKey)**.
  - Si le chapitre n’est pas disponible :
    - **403** avec `{ error: "CHAPTER_LOCKED", message: "Chapitre non débloqué" }`.
  - Aucune simulation ni lecture de stage si le chapitre est verrouillé (sécurité côté serveur, pas de bypass possible).

---

## 3. Modifications frontend

### CampaignView.vue
- **Type** : `chapters[c]` inclut `chapterAvailable: boolean`.
- **Sélecteur de chapitres (chapter-tabs)** :
  - Si `!status.chapters[c].chapterAvailable` :
    - Bouton avec classe **locked** : opacité réduite, `pointer-events: none`, `cursor: not-allowed`, filtre grayscale.
    - **Badge 🔒** affiché à côté du libellé "Ch. N".
    - Attribut **title** (tooltip) : "Termine le chapitre précédent pour débloquer".
    - **disabled** pour l’accessibilité.
  - Clic : `@click` ne fait rien si le chapitre n’est pas disponible (`status?.chapters?.[c]?.chapterAvailable && (chapter = c)`).
- **Animation** : les onglets débloqués (`:not(.locked)`) ont une animation légère **chapterUnlockFade** (fade-in 0.5s) au chargement.
- **Style** : `.map-wrap` avec `overflow: visible` et léger `padding-top` pour éviter toute coupure du contenu (badge Boss).

### ChapterMap.vue
- Aucun changement de logique métier ; uniquement le correctif visuel du badge Boss.

---

## 4. Fix du badge "BOSS"

### Problème
Le texte "BOSS" au-dessus du node du stage 10 était coupé en haut (overflow du conteneur ou viewBox SVG trop juste).

### Solution appliquée
- **ViewBox SVG** : passage de `"0 0 520 120"` à **`"0 -28 520 148"`** pour ajouter 28 unités en haut et un peu en bas, sans déplacer la zone utile par rapport à l’affichage.
- **Positions des nodes** : toutes les ordonnées `y` sont décalées de **+28** dans `nodePos()` (ex. 70 → 98, 30 → 58), pour que les cercles et le texte "BOSS" (toujours à `y - 28`) restent au même endroit visuel mais dans la nouvelle viewBox.
- **Conteneurs** :
  - `.chapter-map` : `overflow: visible`, léger `padding-top: 2px`.
  - `.map-svg` : `overflow: visible`.
  - `.map-wrap` (CampaignView) : `overflow: visible`, `padding-top: 1.75rem`.

Résultat : le badge "BOSS" est entièrement visible, sans clipping ni coupure.

---

## 5. Récapitulatif des fichiers modifiés

| Fichier | Modifications |
|---------|----------------|
| `backend/src/services/campaignService.js` | getCampaignStatus + chapterAvailable, isChapterAvailable, isStageAvailable |
| `backend/src/routes/campaign.js` | Import isChapterAvailable, vérification chapitre avant simulation, 403 CHAPTER_LOCKED |
| `frontend/src/views/CampaignView.vue` | Type chapterAvailable, onglets verrouillés (locked, 🔒, tooltip, disabled), animation fade, overflow map-wrap |
| `frontend/src/views/ChapterMap.vue` | viewBox, nodePos +28, overflow visible, padding-top |

---

## 6. Build et déploiement

- Frontend : `npm run build` dans `frontend/`.
- Backend : redémarrer le serveur Node local si besoin (`cd backend && npm run dev`).

Aucune migration base de données : uniquement logique applicative et affichage.
