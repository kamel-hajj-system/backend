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

router.get('/users', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT id, username FROM users ORDER BY id ASC');
    return res.json(result.rows);
  } catch (error) {
    return next(error);
  }
});

router.post('/users', async (req, res, next) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }

  try {
    const insertQuery =
      'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username';
    const values = [username, password];

    const result = await pool.query(insertQuery, values);
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
});

router.delete('/users/:id', async (req, res, next) => {
  const id = parseInt(req.params.id, 10);

  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid user id' });
  }

  try {
    const deleteQuery = 'DELETE FROM users WHERE id = $1';
    const values = [id];

    const result = await pool.query(deleteQuery, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

