# Nexus Core Arena — Récapitulatif projet

Document de référence pour (re)comprendre le projet, le lancer en local et retrouver les fonctionnalités du jeu.

---

## 1. Stack technique

| Composant | Techno | Rôle |
|-----------|--------|------|
| **Frontend** | Vue 3 + Vue Router + Vite + Axios | SPA : auth, dashboard, équipes, collection, bestiaire, sanctuaire (gacha), campagne, combat |
| **Backend** | Node.js + Fastify | API REST, auth JWT, matchmaking, simulation de combat, BDD |
| **Base de données** | MariaDB 11 | users, units, user_units, teams, matchmaking, campagnes, etc. |
| **Moteur de combat** | JS pur | `core/combatEngine.js` (utilisé par le backend pour batailles et campagne) |

En production, Nginx sert le frontend (fichiers statiques) et reverse-proxy `/api/` vers le backend.

---

## 2. Structure des dossiers

```
nexuscore.goodloss.fr/
├── backend/           # API Fastify
│   ├── src/
│   │   ├── index.js   # Point d'entrée, enregistrement des routes
│   │   ├── config/    # db.js (MySQL)
│   │   ├── middleware/ # auth.js (JWT)
│   │   ├── routes/    # auth, ranked, battle, collection, team, gacha, units, sanctuary, campaign
│   │   └── services/  # matchmaking, xp, gacha, campaign, battleTeam, ascension...
├── frontend/          # SPA Vue
│   ├── src/
│   │   ├── api.ts     # Axios baseURL /api, intercepteur token
│   │   ├── router.ts  # Routes (login, register, dashboard, team-builder, collection, bestiaire, sanctuary, campaign, battle/:id)
│   │   ├── App.vue
│   │   └── views/     # Une vue par écran
├── core/              # Moteur de combat partagé
│   └── combatEngine.js  # computeScaledStats(), simulateBattle()
├── database/
│   ├── schema.sql    # Schéma BDD
│   ├── seeds.sql     # Données initiales
│   └── patch_*.sql   # Migrations/patches
└── PROJET_RECAP.md   # Ce fichier
```

---

## 3. Build

### 3.1 Frontend (obligatoire pour déployer le site)

**À chaque déploiement ou mise à jour du frontend**, exécuter le build **dans le dossier servi par Nginx** pour que les changements soient visibles sur le site :

```bash
cd /mnt/hdd/web/src/nexuscore.goodloss.fr/frontend
npm install   # si besoin
npm run build
```

- Sortie : `frontend/dist/` (index.html + assets).
- Nginx sert ce dossier (config : `root /mnt/hdd/web/src/nexuscore.goodloss.fr/frontend/dist`). Si tu développes ailleurs (ex. `/root/web/...`), il faut soit lancer ce build dans le chemin ci‑dessus, soit copier/synchroniser le `dist/` généré vers ce chemin. **Sans ça, le site en prod affichera l’ancienne version du frontend.**

### 3.2 Backend

```bash
cd backend
npm install
# .env ou variables : DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, PORT
node src/index.js
```

- Le backend écoute sur `PORT` (défaut 3000).

---

## 4. Lancer / relancer la stack

1. Démarrer MariaDB (local ou distant) et créer la BDD `nexuscore` (schema + seeds).
2. Backend : `cd backend && npm run dev` (avec `backend/.env` ou variables pour la BDD).
3. Frontend : soit servir `frontend/dist/` avec Nginx, soit `cd frontend && npm run dev` pour le dev (Vite).

---

## 5. Configuration Nginx (rappel)

- **Domaine :** `nexuscore.goodloss.fr`
- **Racine :** `root` pointe vers le dossier contenant les fichiers du front buildé (ex. `.../frontend/dist`).
- **API :** `location /api/` → `proxy_pass http://127.0.0.1:3000/;` (le préfixe `/api` est retiré, le backend reçoit ex. `GET /bestiary`).

---

## 6. API Backend (résumé)

Toutes les routes protégées nécessitent un JWT (header `Authorization: Bearer <token>`).

| Route | Méthode | Description |
|-------|---------|-------------|
| `/health` | GET | Santé + test BDD (public) |
| `/auth/register` | POST | Inscription |
| `/auth/login` | POST | Connexion (retourne token) |
| `/auth/me` | GET | Utilisateur courant (protégé) |
| `/collection` | GET | Unités du joueur avec stats calculées (protégé) |
| `/team` | GET | Équipe actuelle (protégé) |
| `/team/update` | POST | Mise à jour de l’équipe (protégé) |
| `/team/presets` | GET | Préset d’équipes (protégé) |
| `/team/presets/save` | POST | Sauvegarde d’un préset (protégé) |
| `/bestiary` | GET | Toutes les unités + IDs possédés (protégé) |
| `/units/ascend` | POST | Ascension + choix spé A/B (protégé) |
| `/wallet` | GET | Portefeuille (crédits, cores, fragments) (protégé) |
| `/gacha/pity` | GET | Pity par bannière (protégé) |
| `/sanctuary/pull` | POST | Tirage gacha (protégé) |
| `/ranked/queue` | POST | Entrée en file ranked (protégé) |
| `/ranked/cancel` | POST | Annulation file (protégé) |
| `/ranked/status` | GET | Statut file (protégé) |
| `/battle/simulate` | POST | Simulation combat (équipes + optionnel userAId/userBId) (protégé si users) |
| `/battle/:id` | GET | Détail d’un combat (replay) |
| `/campaign/status` | GET | Statut campagne (protégé) |
| `/campaign/rewards` | GET | Récompenses de stage (protégé) |
| `/campaign/start` | POST | Lancer un stage campagne (protégé) |

---

## 7. Fonctionnalités du jeu (côté appli)

### 7.1 Authentification

- Inscription, connexion, token JWT.
- Routes protégées : dashboard, équipe, collection, bestiaire, sanctuaire, campagne, ranked.

### 7.2 Dashboard

- Vue d’accueil après connexion (résumé compte, lien vers ranked, etc.).

### 7.3 Collection

- Liste des unités possédées par le joueur (user_units).
- Affichage niveau, XP, spécialisation (A/B), fatigue, ascension.

### 7.4 Team Builder

- Composition d’équipe (frontline / backline).
- Présets d’équipes (sauvegarde/chargement).
- Données : `/team`, `/team/update`, `/team/presets`, `/team/presets/save`, `/collection`.

### 7.5 Bestiaire

- Liste de **toutes** les unités du jeu (gabarits).
- Encarts par unité : nom, type d’attaque (Mêlée/Distance/Magie), traits, élément.
- Possédées : encart mis en avant ; non possédées : plus sombres mais cliquables.
- Clic → modal avec : stats de base, rôle, archétype, **description de la compétence** (skill_data), et **spécialisations A/B** (bonus stat, modificateur de compétence, passif si présent).
- Données : `GET /bestiary` (units + ownedUnitIds).

### 7.6 Sanctuaire (Gacha)

- Tirages (pulls) pour obtenir des unités.
- Portefeuille : crédits, cores, fragments.
- Pity par bannière.
- Données : `/wallet`, `/gacha/pity`, `/sanctuary/pull`.

### 7.7 Campagne PvE

- Chapitres / stages (normal / hard selon les saisons).
- Équipe joueur vs équipe ennemie (générée selon le stage).
- Récompenses (premier clear), XP, fatigue.
- Données : `/campaign/status`, `/campaign/rewards`, `/campaign/start`.

### 7.8 Ranked (matchmaking)

- Mise en file pour un match classé.
- Annulation de file, statut (en file ou non).
- Simulation de combat côté backend (équipes construites depuis la BDD), ELO, etc.

### 7.9 Combat (simulation & replay)

- Simulation : `POST /battle/simulate` (équipes ou userAId/userBId).
- Replay : `GET /battle/:id` pour afficher un combat enregistré (vue BattleViewer).

### 7.10 Unités (données)

- **Units** : gabarits (rarité, rôle, type d’attaque, élément, archétype, base_*, mastery, traits, skill_data, specA/B bonus/modifier/passive).
- **User_units** : instances possédées (niveau, xp, spécialisation A ou B, ascension, fatigue).
- Ascension : choix de spécialisation (A ou B) via `/units/ascend`.

---

## 8. Points utiles pour un agent / relecture

- **Build frontend (déploiement)** : à chaque mise à jour du frontend, build **dans le dossier servi par Nginx** : `cd /mnt/hdd/web/src/nexuscore.goodloss.fr/frontend && npm install && npm run build`. Sinon le site en prod ne reflète pas les changements.
- **Backend** : Node + Fastify, port **3000** par défaut, BDD MariaDB locale.
- **Stack locale** : MariaDB sur `localhost:3306`, backend sur `3000`, frontend Vite sur `5173`.
- **Moteur de combat** : `core/combatEngine.js` est partagé entre le backend et les scripts métier.
- **Bestiaire** : données complètes (compétence + spé A/B) exposées par `GET /bestiary` et affichées dans la modal de BestiaireView.

Ce fichier peut être relu pour retrouver rapidement comment build, relancer la stack et ce que fait chaque partie du jeu.
