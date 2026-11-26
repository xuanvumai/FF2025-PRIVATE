'use strict';

const express = require('express');
const pool = require('../database/pool');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

router.post('/simulate/:code', authenticate, async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const found = await client.query('SELECT * FROM rooms WHERE room_code=$1 FOR UPDATE', [String(req.params.code).toUpperCase()]);
    if (!found.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Room not found.' }); }
    const room = found.rows[0];
    if (String(room.owner_id) !== String(req.user.id) && req.user.role !== 'admin') {
      await client.query('ROLLBACK'); return res.status(403).json({ error: 'Only the room owner or admin can start a simulation.' });
    }
    if (room.status !== 'waiting') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Room is not waiting.' }); }

    const players = await client.query(
      `SELECT u.id,u.username FROM room_players rp JOIN users u ON u.id=rp.user_id
       WHERE rp.room_id=$1 ORDER BY rp.joined_at ASC`,
      [room.id]
    );
    if (players.rowCount < 2) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'At least 2 players are required.' }); }

    const ranked = players.rows.map((p) => ({ ...p, score: Math.floor(Math.random() * 1000) + 1 }))
      .sort((a,b) => b.score - a.score);
    const winner = ranked[0];
    const resultData = { mode: 'demo_simulation', players: ranked, winnerId: winner.id, winner: winner.username };
    const match = await client.query(
      `INSERT INTO matches(room_id,status,winner_id,result)
       VALUES($1,'finished',$2,$3::jsonb) RETURNING id,created_at`,
      [room.id, winner.id, JSON.stringify(resultData)]
    );

    for (const player of ranked) {
      const won = String(player.id) === String(winner.id);
      await client.query(
        `UPDATE users SET
         wins = wins + $1,
         losses = losses + $2,
         xp = xp + $3,
         level = GREATEST(1, 1 + ((xp + $3) / 100)::int)
         WHERE id=$4`,
        [won ? 1 : 0, won ? 0 : 1, won ? 50 : 20, player.id]
      );
    }
    await client.query("UPDATE rooms SET status='finished' WHERE id=$1", [room.id]);
    await client.query('COMMIT');
    return res.status(201).json({ matchId: match.rows[0].id, result: resultData, note: 'Demo simulation only; no real-time game client is connected.' });
  } catch (error) {
    await client.query('ROLLBACK');
    return next(error);
  } finally { client.release(); }
});

router.get('/history', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT m.id,m.status,m.result,m.created_at
       FROM matches m
       WHERE m.result->'players' @> $1::jsonb
       ORDER BY m.created_at DESC LIMIT 30`,
      [JSON.stringify([{ id: Number(req.user.id) }])]
    );
    return res.json({ matches: result.rows });
  } catch (error) { return next(error); }
});

module.exports = router;
