## Database - Kamel System

This directory contains the SQL initialization script for the **Kamel System** PostgreSQL database.

### Requirements

- PostgreSQL server installed locally (e.g. on `localhost:5432`).
- A database created for this project, for example `kamel_system`.

### Tables

The `init.sql` script currently defines one table:

- **users**
  - `id` `SERIAL PRIMARY KEY`
  - `username` `TEXT NOT NULL`
  - `password` `TEXT NOT NULL`

This table is intended for simple testing and demo purposes.

### Initializing the Database

1. Create the database (if it does not exist), from a terminal:

   ```bash
   createdb kamel_system
   ```

   Or use your preferred admin GUI to create a database with the name you want.

2. Run the initialization script:

   ```bash
   psql -d kamel_system -f backend/database/init.sql
   ```

   Adjust the database name, host, port, user, or password via your local PostgreSQL configuration or `psql` flags if needed.

### Connecting from the Backend

The backend reads all connection information from environment variables:

- `DATABASE_URL` (optional)
- `PGHOST`
- `PGPORT`
- `PGUSER`
- `PGPASSWORD`
- `PGDATABASE`
- `DB_SSL`

For local development, a typical `.env` (not committed) for the backend might look like:

```bash
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=postgres
PGDATABASE=kamel_system
DB_SSL=false
```

Make sure these values match the database and credentials you set up when running `init.sql`.

