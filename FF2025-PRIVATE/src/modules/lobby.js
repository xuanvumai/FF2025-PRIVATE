'use strict';

const express = require('express');
const pool = require('../database/pool');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

router.get('/', authenticate, async (req, res, next) => {
  try {
    const [user, rooms, online] = await Promise.all([
      pool.query('SELECT username,level,xp,coins,wins,losses FROM users WHERE id=$1', [req.user.id]),
      pool.query(
        `SELECT r.room_code,r.title,r.status,r.max_players,COUNT(rp.user_id)::int AS player_count
         FROM rooms r LEFT JOIN room_players rp ON rp.room_id=r.id
         WHERE r.status='waiting' GROUP BY r.id ORDER BY r.created_at DESC LIMIT 20`
      ),
      pool.query("SELECT COUNT(*)::int AS total FROM users WHERE created_at > NOW() - INTERVAL '24 hours'")
    ]);
    return res.json({ player: user.rows[0], rooms: rooms.rows, activeAccountsLast24h: online.rows[0].total });
  } catch (error) { return next(error); }
});

module.exports = router;
