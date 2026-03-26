# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Nexus Core Arena is a French-language browser-based gacha/RPG game. See `README.md` for quick-start and structure overview.

| Service | Port | Command |
|---------|------|---------|
| Backend (Fastify API) | 3205 | `cd backend && npm run dev` |
| Frontend (Vue SPA, Vite) | 5173 | `cd frontend && npm run dev` |
| MariaDB | 3306 | system service (`sudo mysqld_safe &`) |

### MariaDB setup

MariaDB must be running before starting the backend. Start it with:

```bash
sudo mysqld_safe &
```

Database: `nexuscore`, user: `ladrio`, password: `cerise` (matches `backend/.env`).

If the database is empty, import schema and seeds:

```bash
mariadb -u ladrio -pcerise nexuscore < database/schema.sql
mariadb -u ladrio -pcerise nexuscore < database/seeds.sql
for f in database/patch_*.sql; do mariadb -u ladrio -pcerise nexuscore < "$f" 2>&1; done
```

The backend's `ensureDatabaseSchema()` in `backend/src/config/db.js` auto-creates many tables (guild wars, dungeons, custom units, etc.) on startup. However, it expects the `guild_war_defenses` table to already exist for an ALTER TABLE migration. If this table is missing (fresh DB from schema+seeds only), the backend will fail in a retry loop. Pre-create it by running the guild war table CREATE statements manually, or simply start the backend after the full schema is imported — `ensureDatabaseSchema()` will handle the rest.

### Checks

- **Smoke test**: `cd backend && npm run smoke` — tests health, auth, and admin routes via Fastify inject (no running server needed)
- **Frontend build**: `cd frontend && npm run build` — Vite production build
- No ESLint or TypeScript linting is configured in this project

### Notes

- `.env` files are gitignored. Copy from `.env.example` in both `backend/` and `frontend/` for local dev.
- The frontend uses `VITE_API_TARGET=auto` to auto-discover the backend port at dev time via `.runtime/backend-port.json`.
- The backend uses `node --watch` for hot-reload in dev mode.
