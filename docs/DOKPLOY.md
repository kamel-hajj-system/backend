# Deploying backend (Dokploy / Docker)

## `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` (express-rate-limit)

The API sits behind a reverse proxy that sets `X-Forwarded-For`. **Trust proxy is enabled by default when `NODE_ENV=production`**, so this error should be resolved after you redeploy.

- To **disable** (direct exposure only): set `TRUST_PROXY=0`.
- For **multiple proxy hops**: set `TRUST_PROXY=2` (or the correct number).

## `scheduled_notifications` table missing (P2021)

Production Postgres must match the Prisma schema. After pulling code that adds `ScheduledNotification`, run **once** (or on every deploy if you use this pattern):

```bash
cd /app   # or your backend root
npx prisma db push
npx prisma generate   # usually already done at image build
```

**Dokploy start command:** use sync + start so new tables are always applied:

```bash
npm run start:with-db
```

Default `npm start` does **not** run `db push` (avoids surprises on some setups).

## Environment

- `DATABASE_URL` (or `PG*` vars) must point at the same DB the app uses.
- `NODE_ENV=production`
- Strong `JWT_SECRET` (32+ chars)
