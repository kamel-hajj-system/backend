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

Example `.env` (do **not** commit this file):

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

### API Endpoints

- **GET** `/api/health`  
  Returns:

  ```json
  { "message": "Backend is running" }
  ```

- **GET** `/api/health` (via router `/api` + `/health`)  
  Returns:

  ```json
  { "message": "API router is working" }
  ```

- **GET** `/api/users/:id`  
  Example endpoint demonstrating a PostgreSQL query using **prepared statements**:

  - Validates `id` as an integer.
  - Uses `SELECT ... WHERE id = $1` with `[$1]` parameters to prevent SQL injection.

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

- Ensure that all required environment variables are configured in your Dokploy environment.
- **Frontend path:** Set `FRONTEND_BUILD_PATH` to the path inside the container where the frontend build is (e.g. `/app/frontend/dist`). Build the frontend in your pipeline and copy the `dist` output to that path so the backend can serve it.
- **Database:** Run the DB init once so the `users` table exists: in the backend container run `npm run db:init`, or run `database/init.sql` against your production database.
- Expose the backend port (default `5000`) from your container.

