/**
 * Run database/init.sql against the database configured in .env.
 * Usage: npm run db:init (from backend directory)
 */
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

const initPath = path.join(__dirname, '..', 'database', 'init.sql');
const sql = fs.readFileSync(initPath, 'utf8');

pool
  .query(sql)
  .then(() => {
    console.log('Database init completed (users table created if not exists).');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Database init failed:', err.message);
    process.exit(1);
  })
  .finally(() => pool.end());
