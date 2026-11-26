'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../database/pool');
const env = require('../config/env');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

function makeToken(user) {
  return jwt.sign(
    { id: String(user.id), email: user.email, username: user.username, role: user.role },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

router.post('/register', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Email is invalid.' });
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) return res.status(400).json({ error: 'Username must be 3-20 letters, numbers or underscores.' });
    if (password.length < 10) return res.status(400).json({ error: 'Password must contain at least 10 characters.' });

    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users(email, username, password_hash)
       VALUES($1,$2,$3)
       RETURNING id,email,username,role,level,xp,coins,wins,losses`,
      [email, username, hash]
    );
    const user = result.rows[0];
    await pool.query(
      `INSERT INTO inventory(user_id,item_code,item_name,quantity)
       VALUES($1,'starter_outfit','Starter Outfit',1),($1,'medkit','Medkit',2)
       ON CONFLICT(user_id,item_code) DO NOTHING`,
      [user.id]
    );
    return res.status(201).json({ token: makeToken(user), user });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Email or username already exists.' });
    return next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Email or password is incorrect.' });
    }
    return res.json({
      token: makeToken(user),
      user: {
        id: user.id, email: user.email, username: user.username, role: user.role,
        level: user.level, xp: user.xp, coins: user.coins, wins: user.wins, losses: user.losses
      }
    });
  } catch (error) { return next(error); }
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id,email,username,role,level,xp,coins,wins,losses,created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'User not found.' });
    return res.json({ user: result.rows[0] });
  } catch (error) { return next(error); }
});

module.exports = router;
