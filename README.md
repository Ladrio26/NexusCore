Nexus Core Arena
================

Base technique du jeu Nexus Core Arena.

## Stack

- Backend : Node.js + Fastify, MariaDB
- Frontend : Vue.js (SPA)
- Moteur de combat : module JS pur dans `core/combatEngine.js`

## Démarrage rapide (dev)

1. Installer les dépendances :
   - Backend : `cd backend && npm install`
   - Frontend : `cd frontend && npm install`
2. Préparer la base MariaDB locale :
   - Base : `nexuscore`
   - Hôte : `localhost`
   - Utilisateur : `ladrio`
   - Mot de passe : `cerise`
   - Importer `database/schema.sql`, puis `database/seeds.sql` et les éventuels `patch_*.sql`
3. Lancer le backend :
   - `cd backend && npm run dev`
4. Lancer le frontend :
   - `cd frontend && npm run dev`
5. Ouvrir l'application :
   - `http://localhost:5173`

## Vérifications rapides

- Backend : `cd backend && npm run smoke`
- Frontend : `cd frontend && npm run build`

Le backend utilise le port fixe configuré dans `backend/.env` (`3205` par défaut pour ce projet). Si tu veux des ports de secours en dev, ajoute explicitement `PORT_FALLBACKS=3001-3010,3100`. Le frontend peut suivre automatiquement via `VITE_API_TARGET=auto`.

## Déploiement (front)

- Le build produit `frontend/dist/build-id.json`. Pour que les joueurs voient vite une nouvelle version après déploiement, configure le serveur (ex. nginx) avec **`Cache-Control: no-store`** (ou équivalent) pour ce fichier, afin d’éviter un ancien `build-id` en cache navigateur.
- **Détection de nouvelle version (bannière)** : en `npm run dev`, le contrôle est **désactivé** par défaut. Pour le tester en local, ajoute dans `frontend/.env.local` : `VITE_CLIENT_BUILD_CHECK_DEV=true` (puis redémarre Vite), ou utilise `npm run build && npm run preview`. Intervalle optionnel : `VITE_BUILD_CHECK_INTERVAL_MS` (minimum 15000).

## Structure

- `database/schema.sql` : schéma MariaDB
- `backend/` : API Fastify, matchmaking, accès BDD
- `core/combatEngine.js` : moteur de combat pur JS
- `frontend/` : SPA Vue (login/register, dashboard, team builder, collection, combat viewer)

