# Voir les changements directement (mode dev)

Pour que les modifications du code se reflètent tout de suite dans le navigateur, tout se lance en local.

## 1. Préparer la base MariaDB locale

- Hôte : `localhost`
- Base : `nexuscore`
- Utilisateur : `ladrio`
- Mot de passe : `cerise`
- Importer `database/schema.sql`, puis `database/seeds.sql` et les éventuels `patch_*.sql`

## 2. Démarrer le backend en mode dev

Dans un premier terminal :

```bash
cd /root/web/src/nexuscore.goodloss.fr/backend
npm run dev
```

Le backend écoute sur le port défini dans `backend/.env`, ici **http://localhost:3205**, et se recharge tout seul à chaque modification des fichiers.
Si tu veux des ports de secours en dev, ajoute explicitement `PORT_FALLBACKS=3001-3010,3100` dans l'environnement.

## 3. Démarrer le frontend en mode dev

Dans un second terminal :

```bash
cd /root/web/src/nexuscore.goodloss.fr/frontend
npm run dev
```

Le frontend (Vite) tourne sur **http://localhost:5173** avec rechargement à chaud : chaque sauvegarde met à jour la page.
Avec `VITE_API_TARGET=auto`, le proxy suit automatiquement le port runtime choisi par le backend.

## 4. Ouvrir le site

- Ouvre **http://localhost:5173** (ou l’URL de port forwarding si tu es en remote, ex. le lien proposé par Cursor pour le port 5173).

Tu peux modifier le code frontend ou backend : les changements sont visibles dès que tu sauvegardes.

---

**Résumé :**  
MariaDB locale + backend + frontend en `npm run dev` → pas de rebuild, rechargement direct.
