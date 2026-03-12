# Rapport Frontend Campagne (map nodes)

## 1. Routes et navigation

- **Route** : `/campaign` (meta: `requiresAuth: true`).
- **Navbar** : lien « Campagne » ajouté dans `App.vue` (entre Sanctuaire et Déconnexion).

## 2. API utilisées

- **GET** `/api/campaign/status?mode=normal|hard`  
  - En cas de succès : `{ unlocked, requiredUnits?, mode, seasonKey?, chapters }`.  
  - En cas de verrou (moins de 5 unités) : **403** avec body `{ error: "CAMPAIGN_LOCKED", requiredUnits: 5 }`.
- **GET** `/api/campaign/rewards?chapter=&stage=&mode=`  
  - Retourne les récompenses template du stage : `{ credits, cores, fragments, ascension_essence }`.
- **POST** `/api/campaign/start`  
  - Body : `{ mode, chapter, stage, team: [ { user_unit_id, position: "front"|"back" } ] }`.  
  - Réponse : `{ success, winner, battleLog, rewardsGranted, rewardsPreview, progressUpdated, wallet }`.
- **GET** `/api/team`  
  - Retourne l’équipe sauvegardée (team builder) : `{ frontlineSlots, backlineSlots }`.  
  - Utilisée pour construire le payload `team` de `/campaign/start`.

## 3. Vues et composants

### CampaignView.vue

- **Toggle Normal / Hard** : deux boutons pour le mode ; en Hard, badge « Instable ce mois-ci ».
- **Locked** : si `GET /campaign/status` renvoie 403 (CAMPAIGN_LOCKED), affichage d’un **overlay** avec message « Campagne verrouillée » (au moins N unités) et bouton **Aller au Sanctuaire** (lien vers `/sanctuary`).
- **Onglets chapitres** : Ch. 1 … Ch. 10 ; affichage du **ChapterMap** du chapitre sélectionné.
- Charge au montage : statut campagne + équipe (GET /team) pour construire `campaignTeam`.
- **StageModal** : ouverte au clic sur un node ; après combat, émission de `battle-done` pour rafraîchir le statut.

### ChapterMap.vue

- **10 nodes** en zigzag (positions alternées en Y : index pair = bas, impair = haut).
- **Lignes SVG** entre nodes consécutifs (9 segments).
- **État du node** (classe CSS) :
  - **locked** : stage non disponible (stage précédent non cleared).
  - **available** : jouable ; **available + boss** : stage 10 (style boss).
  - **cleared** : stage complété ; **cleared + boss** : boss complété.
- **Clic node** → émission `open-stage` avec `{ chapter, stage, stageInfo }` → ouverture de la modal.

### StageModal.vue

- **En-tête** : Chapitre X – Stage Y, badge **Boss** si stage 10, bouton fermer.
- **Récompenses first clear** : chargement via GET `/campaign/rewards` ; affichage credits, cores, fragments, essence. Mention « XP répétable à chaque victoire ».
- **Équipe** : si pas d’équipe (`campaignTeam` vide) → message « Crée une équipe » avec lien Team Builder ; bouton **Combattre** désactivé.
- **Bouton Combattre** : désactivé si pas d’équipe, stage non available ou combat en cours. Pendant l’appel à POST `/campaign/start` : loader + bouton désactivé (« Combat en cours… »).
- **Après combat** : bloc résultat (Victoire / Défaite), récompenses réellement obtenues (`rewardsGranted`), sinon mention XP. Bouton **Fermer** qui ferme la modal et déclenche le refresh du statut (parent écoute `battle-done`).

## 4. Équipe campagne (V1)

- **Source** : équipe sauvegardée du **Team Builder** (GET `/api/team` → `frontlineSlots`, `backlineSlots`).
- **Format envoyé** à POST `/campaign/start` :  
  `team: [ { user_unit_id, position: "front" }, ... , { user_unit_id, position: "back" }, ... ]`.  
  Ordre : d’abord tous les frontline, puis tous les backline.
- Si aucune équipe (tableau vide) : message « Crée une équipe » dans la modal, pas d’envoi de combat.

## 5. Hard : badge « Instable ce mois-ci »

- Affiché à côté du bouton **Hard** quand le mode Hard est sélectionné, et éventuellement en bandeau sous le header.
- **variantKey** (A/B/C) : non renvoyé par le backend dans le statut ; affichage optionnel si l’API le fournit plus tard.

## 6. Build

- Après modifications : `npm run build` dans `frontend/` (build Vite OK).

## 7. Fichiers modifiés / ajoutés

| Fichier | Action |
|---------|--------|
| `frontend/src/router.ts` | Route `/campaign` + import `CampaignView` |
| `frontend/src/App.vue` | Lien navbar « Campagne » |
| `frontend/src/views/CampaignView.vue` | Nouveau |
| `frontend/src/views/ChapterMap.vue` | Nouveau |
| `frontend/src/views/StageModal.vue` | Nouveau |
| `backend/src/routes/team.js` | GET `/team` (équipe par défaut) |
| `backend/src/routes/campaign.js` | GET `/campaign/rewards` (template récompenses) |
