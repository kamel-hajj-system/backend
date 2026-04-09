const path = require('path');
const fs = require('fs');
const express = require('express');
const compression = require('compression');
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
 * Clickjacking mitigation: forbid embedding this site in iframes unless configured.
 * - Default: no framing (strongest). Override with CSP_FRAME_ANCESTORS, e.g. `'self'` if you embed your own UI.
 */
app.use((req, res, next) => {
  const ancestors =
    process.env.CSP_FRAME_ANCESTORS && String(process.env.CSP_FRAME_ANCESTORS).trim()
      ? String(process.env.CSP_FRAME_ANCESTORS).trim()
      : "'none'";
  res.setHeader('Content-Security-Policy', `frame-ancestors ${ancestors}`);
  if (ancestors === "'none'" || ancestors === 'none') {
    res.setHeader('X-Frame-Options', 'DENY');
  } else if (ancestors === "'self'" || ancestors === 'self') {
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  }
  next();
});

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

/** Gzip JSON and other compressible responses (smaller payloads over the wire). */
app.use(compression());

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
/** Default 32mb — Nusuk sync-save and similar bulk JSON payloads exceed Express's 100kb default. Override with JSON_BODY_LIMIT e.g. "50mb". */
const jsonBodyLimit = process.env.JSON_BODY_LIMIT || '32mb';
app.use(express.json({ limit: jsonBodyLimit }));
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

/** Must match prisma/migrations; used for P3005 one-time baselining. */
const PRISMA_BASELINE_MIGRATION = '20250331120000_baseline';

/**
 * True when this looks like a pre-Migrate database (has app tables) but the baseline row is missing.
 * Avoids P3005 without manual Dokploy env in the common case. Assumes DB already matches schema.prisma.
 */
async function needsAutoBaselineResolve(pool) {
  const { rows: hasUsers } = await pool.query(
    `SELECT 1 AS ok FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users' LIMIT 1`,
  );
  if (hasUsers.length === 0) return false;

  const { rows: hasMigTable } = await pool.query(
    `SELECT 1 AS ok FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '_prisma_migrations' LIMIT 1`,
  );
  if (hasMigTable.length === 0) return true;

  const { rows: hasBaselineRow } = await pool.query(
    `SELECT 1 AS ok FROM "_prisma_migrations" WHERE migration_name = $1 LIMIT 1`,
    [PRISMA_BASELINE_MIGRATION],
  );
  return hasBaselineRow.length === 0;
}

/** Run database/init.sql on startup, then apply Prisma migrations in order (see .cursor/rules/prisma-db-sync.mdc). */
async function ensureDatabase() {
  let shouldResolveBaseline = false;

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

    const skipAuto =
      process.env.PRISMA_SKIP_AUTO_BASELINE === 'true' ||
      process.env.PRISMA_SKIP_AUTO_BASELINE === '1';
    if (!skipAuto) {
      shouldResolveBaseline = await needsAutoBaselineResolve(pool);
    }
  } catch (err) {
    console.error('Database init on startup failed:', err.message);
  } finally {
    await pool.end();
  }
  try {
    const { execSync } = require('child_process');
    const backendRoot = path.resolve(__dirname, '..');
    const deployCmd = 'npx prisma migrate deploy';
    const skipMigrate =
      process.env.PRISMA_MIGRATE_DEPLOY_ON_START === 'false' ||
      process.env.PRISMA_MIGRATE_DEPLOY_ON_START === '0';

    if (skipMigrate) {
      console.log(
        'Skipping prisma migrate deploy on startup (PRISMA_MIGRATE_DEPLOY_ON_START is false). Apply migrations manually before serving traffic.',
      );
      return;
    }

    if (shouldResolveBaseline) {
      console.log(
        `[migrate] Existing database without baseline record; marking ${PRISMA_BASELINE_MIGRATION} as applied (avoids P3005).`,
      );
      try {
        execSync(`npx prisma migrate resolve --applied ${PRISMA_BASELINE_MIGRATION}`, {
          stdio: 'inherit',
          cwd: backendRoot,
          env: process.env,
        });
      } catch (resolveErr) {
        console.warn('[migrate] migrate resolve failed:', resolveErr.message);
      }
    }

    execSync(deployCmd, { stdio: 'inherit', cwd: backendRoot, env: process.env });
    console.log('Prisma migrate deploy OK.');
  } catch (err) {
    console.error('Prisma migrate deploy failed:', err.message);
    console.error(
      [
        'If the log mentions P3005: DB may not match schema.prisma; align with db push / SQL first.',
        `Or try: npx prisma migrate resolve --applied ${PRISMA_BASELINE_MIGRATION}`,
        'To skip auto-baseline (rare): PRISMA_SKIP_AUTO_BASELINE=true',
      ].join('\n'),
    );
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

