# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

Nexus Core Arena is a browser-based gacha/RPG game (French UI). It is a monorepo with three modules:
- `backend/` — Fastify REST API (port 3205)
- `frontend/` — Vue 3 SPA via Vite (port 5173)
- `core/` — Shared combat engine (pure JS, no dependencies)

See `README.md` for the full quick-start guide.

### Services

| Service | Command | Port |
|---------|---------|------|
| MariaDB | `sudo mkdir -p /run/mysqld && sudo chown mysql:mysql /run/mysqld && sudo mysqld_safe &` | 3306 |
| Backend | `cd backend && npm run dev` | 3205 |
| Frontend | `cd frontend && npm run dev` | 5173 |

### Database setup (one-time)

MariaDB must be running before the backend starts. The backend's `ensureDatabaseSchema()` auto-creates most tables and columns on startup, but the base schema must be imported first:

```bash
sudo mariadb -e "CREATE DATABASE IF NOT EXISTS nexuscore CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE USER IF NOT EXISTS 'ladrio'@'localhost' IDENTIFIED BY 'cerise'; GRANT ALL PRIVILEGES ON nexuscore.* TO 'ladrio'@'localhost'; FLUSH PRIVILEGES;"
mariadb -u ladrio -pcerise nexuscore < database/schema.sql
mariadb -u ladrio -pcerise nexuscore < database/seeds.sql
for patch in $(ls database/patch_*.sql | sort); do mariadb -u ladrio -pcerise nexuscore < "$patch" 2>/dev/null; done
```

The guild war tables (`guild_wars`, `guild_war_defenses`, `guild_elo`) are NOT in `schema.sql` — they are created by `ensureDatabaseSchema()` in `backend/src/config/db.js`. However, `ensureDatabaseSchema()` tries to ALTER `guild_war_defenses` before creating it. To avoid a startup crash, pre-create these tables manually or accept the first-attempt error and let the retry loop handle it (the function retries up to 10 times).

### Env files

Copy `.env.example` files before starting:
- `cp backend/.env.example backend/.env`
- `cp frontend/.env.example frontend/.env`

Default credentials work locally (user `ladrio`, password `cerise`, db `nexuscore`).

### Checks

- **Smoke tests**: `cd backend && npm run smoke` (requires backend + MariaDB running)
- **Frontend build**: `cd frontend && npm run build`
- No linter or formatter is configured in this project.

### Gotchas

- The backend uses `node --watch` for hot reload. If you install new npm packages, the watcher restarts automatically.
- The frontend Vite proxy reads the backend port from `.runtime/backend-port.json` (written by the backend at startup). Start the backend before the frontend for the proxy to work correctly.
- `patch_units_is_boss.sql` may fail with "Duplicate column name" if the schema already includes `is_boss` — this is safe to ignore.
