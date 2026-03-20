# Deploying backend (Dokploy / Docker)

## `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` (express-rate-limit)

The API sits behind a reverse proxy that sets `X-Forwarded-For`. **Trust proxy is enabled by default when `NODE_ENV=production`**, so this error should be resolved after you redeploy.

- To **disable** (direct exposure only): set `TRUST_PROXY=0`.
- For **multiple proxy hops**: set `TRUST_PROXY=2` (or the correct number).

## `scheduled_notifications` table missing (P2021)

Your other tables (`notifications`, `users`, etc.) are fine; only **`scheduled_notifications`** (+ enum `NotificationScheduleKind`) is new for the scheduling feature.

### Option A (recommended)

From the backend app directory, against production `DATABASE_URL`:

```bash
npx prisma db push
```

Or use **`npm run start:with-db`** as the Dokploy start command so schema sync runs before `node`.

### Option B (SQL only)

If you cannot run Prisma in the container, execute `prisma/sql/add_scheduled_notifications.sql` once in the production DB (psql / hosting SQL console).

Default `npm start` does **not** run `db push` (avoids surprises on some setups).

## Environment

- `DATABASE_URL` (or `PG*` vars) must point at the same DB the app uses.
- `NODE_ENV=production`
- Strong `JWT_SECRET` (32+ chars)
