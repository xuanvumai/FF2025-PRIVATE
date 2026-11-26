'use strict';

const express = require('express');
const pool = require('../database/pool');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

router.post('/quick', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT r.room_code,r.title,r.max_players,COUNT(rp.user_id)::int AS player_count
       FROM rooms r LEFT JOIN room_players rp ON rp.room_id=r.id
       WHERE r.status='waiting' GROUP BY r.id
       HAVING COUNT(rp.user_id) < r.max_players
       ORDER BY COUNT(rp.user_id) DESC,r.created_at ASC LIMIT 1`
    );
    if (!result.rowCount) return res.status(404).json({ matched: false, message: 'No available room. Create one first.' });
    return res.json({ matched: true, room: result.rows[0] });
  } catch (error) { return next(error); }
});

module.exports = router;
