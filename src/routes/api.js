const express = require('express');
const { Pool } = require('pg');

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

router.get('/health', (req, res) => {
  res.json({ message: 'API router is working' });
});

router.get('/db-health', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT 1 AS ok');
    return res.json({
      status: 'ok',
      details: result.rows[0],
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      error: error.message,
    });
  }
});

router.get('/users/:id', async (req, res, next) => {
  const id = parseInt(req.params.id, 10);

  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid user id' });
  }

  try {
    const queryText = 'SELECT id, username FROM users WHERE id = $1';
    const values = [id];

    const result = await pool.query(queryText, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

