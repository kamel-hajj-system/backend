const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config();

const apiRouter = require('./routes/api');

const app = express();

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

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
  res.status(500).json({ error: 'Internal server error' });
});

/** Run database/init.sql on startup so "users" table exists (idempotent). */
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
    console.log('Database init OK (users table ready).');
  } catch (err) {
    console.error('Database init on startup failed:', err.message);
  } finally {
    await pool.end();
  }
}

ensureDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Backend server listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Startup failed:', err);
    process.exit(1);
  });

