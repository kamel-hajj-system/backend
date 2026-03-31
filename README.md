## Backend - Kamel System

This is the Node.js + Express backend for **Kamel System**. It exposes a small JSON API and is prepared to connect to a PostgreSQL database.

### Tech Stack

- **Runtime**: Node.js
- **Framework**: Express
- **Database**: PostgreSQL (`pg` driver)
- **Other**: `cors`, `dotenv`

### Environment Variables

All database configuration is read from `process.env`. No credentials should be hard-coded in the codebase.

You can use either a single connection string or individual parameters:

- `DATABASE_URL` (optional, full Postgres connection string)
- `PGHOST`
- `PGPORT`
- `PGUSER`
- `PGPASSWORD`
- `PGDATABASE`
- `DB_SSL` (set to `true` to enable SSL, anything else to disable)
- `PORT` (optional, backend port, defaults to `5000`)
- `FRONTEND_BUILD_PATH` (optional; in production set to the path where the frontend build is in the container, e.g. `/app/frontend/dist`)
- **User module (JWT):** `JWT_SECRET` (required in production), `JWT_EXPIRES_IN` (default `7d`), `LOGIN_RATE_LIMIT_MAX`, `SENSITIVE_RATE_LIMIT_MAX`
- **Super Admin:** `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` (required in production; in development default to `superadmin`/`superadmin` if unset). Set these in your server (e.g. Dokploy → Environment). The seed creates/updates the super admin user using these values.
- **Web Push (optional):** `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` (e.g. `mailto:support@yourdomain.com`). Generate keys with `npm run vapid:keys` in this folder, then set the three variables in Dokploy. Without them, in-app notifications still work; device push is disabled until configured. After changing the schema, run `npx prisma db push` (or your migration flow).

Example `.env` (do **not** commit this file; copy from `.env.example`):

```bash
PORT=5000
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=postgres
PGDATABASE=kamel_system
DB_SSL=false
```

### Install Dependencies

From the `backend` directory:

```bash
npm install
```

This installs `express`, `cors`, `dotenv`, `pg`, and `nodemon`.

### Running the Server

From the `backend` directory:

```bash
npm start
```

or in development with automatic restarts:

```bash
npm run dev
```

The server listens on:

- `http://localhost:5000` by default, or the port specified in `PORT`.

### Database: Migrate and seed (for local testing)

From the `backend` directory:

```bash
# 1. Run migrations (creates/updates tables including groups)
npm run db:migrate

# 2. Seed permissions, default permissions, shifts, and super admin user
npm run db:seed
```

Or in one step: `npm run db:setup` (runs ensure-migrations then seed).

After seeding you get: permissions list (for “Assign permissions”), default permissions for Company/Service Center, shifts, and super admin user (email/password from `SUPER_ADMIN_EMAIL`/`SUPER_ADMIN_PASSWORD`; in dev they default to `superadmin`/`superadmin` if unset). Locations are not seeded—use your existing Location table; groups use Group.locationId to link to locations.

### API Endpoints

- **GET** `/api/health` – Backend running check.
- **GET** `/api/health` (via router) – API router check.
- **GET** `/api/db-health` – Database connectivity check.

**User Management Module** (see `modules/users/README.md`):

- **POST** `/api/users/login` – Login (returns JWT).
- **GET** `/api/users` – List users (auth required).
- **GET** `/api/users/:id` – Get user by ID (auth required).
- **POST** `/api/users` – Create user (Admin).
- **PATCH** `/api/users/:id` – Update user (auth required).
- **DELETE** `/api/users/:id` – Soft delete user (Admin).
- **POST** `/api/users/:id/change-password` – Change password (auth required).
- **POST** `/api/users/:id/assign-role` – Assign role (Admin).
- **POST** `/api/users/:id/assign-permissions` – Assign permissions (Admin).

Super admin is created/updated by the seed using `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` from the environment. In production, set these in your server (e.g. Dokploy → Environment section).

### Serving the Frontend

The backend is configured to serve the built React frontend from:

- `../frontend/build`

Steps:

1. From the `frontend` directory, run:

   ```bash
   npm install
   npm run build
   ```

2. Start the backend (`npm start` from `backend`).

3. Visit `http://localhost:5000` in your browser. All non-API routes are served via the `frontend/build/index.html` file.

### Dokploy / Deployment Notes

- Ensure that all required environment variables are configured in your Dokploy environment, including **SUPER_ADMIN_EMAIL** and **SUPER_ADMIN_PASSWORD** (no default in production).
- **Frontend path:** The backend looks for the built frontend at `<app root>/frontend/dist` (e.g. `/app/frontend/dist`). Build the frontend in your pipeline and copy the `dist` output there, or set `FRONTEND_BUILD_PATH` to a different path.
- **Database:** This project syncs schema with Prisma using `db push` (not migration deploy by default). After deploying backend changes that touch `prisma/schema.prisma`, run:
  - `cd /app && npx prisma db push`
  - then check logs for Prisma errors and test affected endpoints.
- Keep `PRISMA_DB_PUSH_ACCEPT_DATA_LOSS` unset/false in production. Do not use data-loss mode unless explicitly approved after backup.
- For each schema change, update `docs/db-change-plan.md` and follow its checklist.
- Expose the backend port (default `5000`) from your container.

