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

## Structure

- `database/schema.sql` : schéma MariaDB
- `backend/` : API Fastify, matchmaking, accès BDD
- `core/combatEngine.js` : moteur de combat pur JS
- `frontend/` : SPA Vue (login/register, dashboard, team builder, collection, combat viewer)

