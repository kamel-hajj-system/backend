const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const cookieParser = require('cookie-parser');

dotenv.config();

// Security: require a strong JWT secret in production.
if (process.env.NODE_ENV === 'production') {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === 'change-me-in-production' || String(secret).length < 32) {
    console.error('Startup failed: JWT_SECRET must be set to a strong value in production.');
    process.exit(1);
  }
}

// Prisma expects DATABASE_URL; build from PG* vars if not set (no change to existing config).
if (!process.env.DATABASE_URL && process.env.PGHOST) {
  const user = process.env.PGUSER || '';
  const pass = process.env.PGPASSWORD ? `:${encodeURIComponent(process.env.PGPASSWORD)}` : '';
  const host = process.env.PGHOST;
  const port = process.env.PGPORT || '5432';
  const db = process.env.PGDATABASE || 'postgres';
  const ssl = process.env.DB_SSL === 'true' ? '?sslmode=require' : '';
  process.env.DATABASE_URL = `postgresql://${user}${pass}@${host}:${port}/${db}${ssl}`;
}

const apiRouter = require('./routes/api');
const { startScheduledNotificationsWorker } = require('./scheduledNotificationsWorker');

const app = express();

const PORT = process.env.PORT || 5001;

/**
 * Reverse proxies (Dokploy, Traefik, Nginx) send X-Forwarded-For.
 * express-rate-limit requires trust proxy to be set when that header is present (ERR_ERL_UNEXPECTED_X_FORWARDED_FOR).
 * - Production: trust 1 hop by default (set TRUST_PROXY=0 to disable).
 * - TRUST_PROXY=2 (number): trust two hops if you have multiple proxies.
 */
(function configureTrustProxy() {
  const raw = process.env.TRUST_PROXY;
  if (raw === 'false' || raw === '0') return;

  let hops = 0;
  if (raw === 'true' || raw === '1') {
    hops = 1;
  } else if (raw !== undefined && raw !== '' && !Number.isNaN(Number(raw))) {
    hops = Math.max(1, parseInt(String(raw), 10));
  } else if (process.env.NODE_ENV === 'production') {
    hops = 1;
  }

  if (hops > 0) {
    app.set('trust proxy', hops);
  }
})();

// Security: restrict CORS in production by allowlist
const corsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (corsOrigins.length === 0) return cb(null, true);
      if (corsOrigins.includes(origin)) return cb(null, true);
      return cb(new Error('CORS blocked'), false);
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (req, res) => {
  res.json({ message: 'Backend is running' });
});

app.use('/api', apiRouter);

// Frontend path: env var, or production layout (/app/frontend/dist), or local layout (repo/frontend/dist).
const prodPath = path.resolve(__dirname, '..', 'frontend', 'dist');
const localPath = path.resolve(__dirname, '..', '..', 'frontend', 'dist');
const frontendBuildPath =
  process.env.FRONTEND_BUILD_PATH ||
  (fs.existsSync(prodPath) ? prodPath : localPath);

app.use(express.static(frontendBuildPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(frontendBuildPath, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  const isDev = process.env.NODE_ENV !== 'production';
  res.status(500).json({
    error: 'Internal server error',
    ...(isDev && { details: err.message }),
  });
});

/** Run database/init.sql on startup, then Prisma migrations for user module. */
async function ensureDatabase() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    host: process.env.PGHOST,
    port: process.env.PGPORT,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  try {
    const initPath = path.join(__dirname, '..', 'database', 'init.sql');
    const sql = fs.readFileSync(initPath, 'utf8');
    await pool.query(sql);
    console.log('Database init OK.');
  } catch (err) {
    console.error('Database init on startup failed:', err.message);
  } finally {
    await pool.end();
  }
  // Ensure Prisma schema is applied (dev: use db push, no migrations)
  try {
    const { execSync } = require('child_process');
    // In production, do NOT auto-apply schema changes unless explicitly allowed.
    // This prevents accidental destructive schema changes on boot.
    if (process.env.NODE_ENV === 'production') {
      const allowPush = process.env.PRISMA_DB_PUSH_ON_START === 'true';
      const acceptDataLoss = process.env.PRISMA_DB_PUSH_ACCEPT_DATA_LOSS === 'true';
      if (!allowPush) {
        console.log('Skipping Prisma db push on startup (production).');
        return;
      }
      const cmd = `npx prisma db push${acceptDataLoss ? ' --accept-data-loss' : ''}`;
      execSync(cmd, {
        stdio: 'inherit',
        cwd: path.resolve(__dirname, '..'),
        env: process.env,
      });
      console.log('Prisma db push OK.');
      return;
    }

    // Non-production: Prisma often requires --accept-data-loss for harmless changes (e.g. adding UNIQUE on `code`).
    // Opt out (stricter): PRISMA_DB_PUSH_ACCEPT_DATA_LOSS=false
    const devAcceptDataLoss = process.env.PRISMA_DB_PUSH_ACCEPT_DATA_LOSS !== 'false';
    const devCmd = `npx prisma db push${devAcceptDataLoss ? ' --accept-data-loss' : ''}`;
    execSync(devCmd, {
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '..'),
      env: process.env,
    });
    console.log('Prisma db push OK.');
  } catch (err) {
    console.error('Prisma db push failed:', err.message);
    throw err;
  }
}

ensureDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Backend server listening on port ${PORT}`);
      startScheduledNotificationsWorker();
    });
  })
  .catch((err) => {
    console.error('Startup failed:', err);
    process.exit(1);
  });

