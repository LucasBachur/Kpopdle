const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const { DATABASE_URL, JWT_SECRET } = require('../config');

const router = express.Router();
const pool = new Pool({ connectionString: DATABASE_URL });

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

function issueTokens(userId, username) {
  const accessToken = jwt.sign({ userId, username }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
  const refreshToken = jwt.sign({ userId, username, type: 'refresh' }, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
  return { accessToken, refreshToken };
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'username, email and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'password must be at least 6 characters' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Email or username already taken' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const { rows } = await client.query(
      `INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id`,
      [username, email, passwordHash]
    );
    const userId = rows[0].id;

    const { createStarterCollection } = require('../services/collectionService');
    const starterCards = await createStarterCollection(userId, client);

    await client.query('COMMIT');
    const tokens = issueTokens(userId, username);
    return res.status(201).json({ userId, username, ...tokens, starterCards });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Registration failed' });
  } finally {
    client.release();
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }
  try {
    const { rows } = await pool.query(
      'SELECT id, username, password_hash FROM users WHERE email = $1',
      [email]
    );
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const tokens = issueTokens(user.id, user.username);
    return res.json({ userId: user.id, username: user.username, ...tokens });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: 'refreshToken is required' });
  }
  try {
    const payload = jwt.verify(refreshToken, JWT_SECRET);
    if (payload.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid token type' });
    }
    const accessToken = jwt.sign(
      { userId: payload.userId, username: payload.username },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );
    return res.json({ accessToken });
  } catch {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

module.exports = router;
