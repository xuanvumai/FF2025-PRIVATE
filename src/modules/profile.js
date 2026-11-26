'use strict';

const express = require('express');
const pool = require('../database/pool');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

router.get('/', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id,username,level,xp,coins,wins,losses,created_at
       FROM users WHERE id=$1`,
      [req.user.id]
    );
    return res.json({ profile: result.rows[0] || null });
  } catch (error) { return next(error); }
});

router.patch('/', authenticate, async (req, res, next) => {
  try {
    const username = String(req.body.username || '').trim();
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return res.status(400).json({ error: 'Username must be 3-20 letters, numbers or underscores.' });
    }
    const result = await pool.query(
      'UPDATE users SET username=$1 WHERE id=$2 RETURNING id,username,level,xp,coins,wins,losses',
      [username, req.user.id]
    );
    return res.json({ profile: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Username already taken.' });
    return next(error);
  }
});

module.exports = router;
