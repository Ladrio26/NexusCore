# Rapport : Sanctuaire d'Invocation (frontend)

## Fichiers touchés

| Fichier | Modification |
|---------|---------------|
| `frontend/src/views/SanctuaryView.vue` | **Créé** — Page unique avec 3 portails, wallet, pity, appels `POST /api/sanctuary/pull`, overlay et animation gacha (charge → flash → reveal) |
| `frontend/src/router.ts` | Route `/sanctuary` avec `SanctuaryView` ; `/gacha` → redirect vers `/sanctuary` ; import de `SanctuaryView` à la place de `GachaView` |
| `frontend/src/App.vue` | Lien nav « Gacha » renommé en « Sanctuaire », `to="/gacha"` → `to="/sanctuary"` |

L’ancienne vue `GachaView.vue` n’est plus utilisée par le router mais le fichier est conservé (optionnel : suppression ou archivage).

---

## Build

Le frontend est servi par Nginx depuis `frontend/dist`. Après toute modification du frontend :

```bash
cd web/src/nexuscore.goodloss.fr/frontend
npm run build
```

Ou depuis la racine du projet :

```bash
cd web/src/nexuscore.goodloss.fr && npm run build --prefix frontend
```

Les assets générés sont dans `frontend/dist/`. Si Nginx pointe déjà sur ce dossier, un rechargement de la page suffit (pas besoin de redémarrer Nginx sauf changement de config).

---

## Tester rapidement

1. **Démarrer le backend** (et la DB locale) si besoin :  
   `cd backend && npm run dev`

2. **Build du frontend** :  
   `cd frontend && npm run build`

3. **Ouvrir l’app** (selon ta config Nginx) :  
   https://nexuscore.goodloss.fr (ou l’URL utilisée pour le frontend).

4. **Se connecter**, puis aller dans **Sanctuaire** (ancien « Gacha »).  
   - Vérifier le wallet en haut (credits, cores, fragments, essence ascension).  
   - Tester **Invoquer x1** sur chaque portail (Standard 100 credits, Noyau 10 cores, Résonance 100 fragments).  
   - Vérifier l’animation : overlay → portail (couleur selon rareté) → flash → carte avec nom, rareté, « Nouvelle unité ! » ou « Dupe → +X fragments » → Fermer.

5. **Compatibilité** : aller sur `/gacha` doit rediriger vers `/sanctuary`.

---

## Détails techniques

- **API** : `POST /api/sanctuary/pull` avec body `{ type: "standard" | "core" | "resonance" }`. Réponse : `wallet`, `pity` (standard), `unit`, `rarity`, `isNewUnit`, `fragmentsGained`.
- **Chargement initial** : au mount, `GET /api/wallet` et `GET /api/gacha/pity?bannerKey=standard` pour afficher le wallet et le pity Standard.
- **Animation** : CSS uniquement (transitions + keyframes). Couleurs portail/reveal : common gris/brun, uncommon vert, rare bleu, epic violet, legendary or, mythic rouge.
